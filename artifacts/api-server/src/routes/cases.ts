import { Router, type IRouter } from "express";
import { eq, desc, sql, and, ne, gte, lte, isNull, or, inArray, like } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import multer from "multer";
import { db, leaveCasesTable, hrDecisionsTable, auditLogTable, organizationsTable, caseAccessTokensTable, caseDocumentsTable, usersTable, employeesTable } from "@workspace/db";
import {
  ListCasesQueryParams,
  CreateCaseBody,
  GetCaseParams,
  AnalyzeCaseParams,
  AnalyzeCaseBody,
  TransitionCaseParams,
  TransitionCaseBody,
  RecordHrDecisionParams,
  RecordHrDecisionBody,
  GetCaseAuditLogParams,
  GetAiRecommendationParams,
  SendNoticesParams,
  SendNoticesBody,
} from "@workspace/api-zod";
import { analyzeEligibility, getEventTransition } from "../lib/eligibility";
import { requireAuth, requireHrAccess, requireOrgId, verifyToken, logCrossOrgAttempt, type AuthenticatedRequest, type JwtPayload } from "../lib/jwtAuth";
import { encryptDocContent, decryptDocContent } from "../lib/encryptedFields";
import { generateAiRecommendation } from "../lib/aiRecommendation";
import { sendNoticeEmail, sendMagicLinkEmail, sendNewCaseNotificationEmail, getAppUrl, type EmailAttachment } from "../lib/email";
import { buildMedCertPdf, isBase64Pdf, toPdfBase64, toPdfBuffer } from "../lib/pdfUtils.js";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function generateCaseNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  return `LOA-${year}${month}${day}-${rand}`;
}

async function logAudit(
  entityId: string,
  action: string,
  actor: string,
  metadata?: Record<string, unknown>,
  organizationId?: string,
): Promise<void> {
  await db.insert(auditLogTable).values({
    entity: "leave_case",
    entityId,
    action,
    actor,
    metadata: metadata ?? null,
    organizationId: organizationId ?? "",
  });
}

function isOrgAuthorized(
  userOrgId: string | null,
  caseOrgId: string | null,
  req?: import("express").Request,
  sub?: string,
): boolean {
  if (!userOrgId) return true; // super-admin path
  if (caseOrgId === userOrgId) return true;
  // Cross-tenant attempt: log for breach detection
  if (req && sub) logCrossOrgAttempt(req, sub, userOrgId, caseOrgId);
  return false;
}

async function fetchCaseDetail(caseId: string) {
  const [leaveCase] = await db
    .select()
    .from(leaveCasesTable)
    .where(eq(leaveCasesTable.id, caseId));

  if (!leaveCase) return null;

  const decisions = await db
    .select()
    .from(hrDecisionsTable)
    .where(eq(hrDecisionsTable.leaveCaseId, caseId))
    .orderBy(desc(hrDecisionsTable.decidedAt));

  const auditEntries = await db
    .select()
    .from(auditLogTable)
    .where(eq(auditLogTable.entityId, caseId))
    .orderBy(desc(auditLogTable.createdAt));

  let assignedToName: string | null = null;
  if (leaveCase.assignedToUserId) {
    const [assignedUser] = await db
      .select({ firstName: usersTable.firstName, lastName: usersTable.lastName })
      .from(usersTable)
      .where(eq(usersTable.id, leaveCase.assignedToUserId))
      .limit(1);
    if (assignedUser) {
      assignedToName = `${assignedUser.firstName} ${assignedUser.lastName}`.trim();
    }
  }

  return {
    ...leaveCase,
    hrDecisions: decisions,
    auditLog: auditEntries,
    assignedToName,
  };
}

// GET /cases  (requires auth — scoped to caller's org)
router.get("/cases", requireAuth, async (req, res): Promise<void> => {
  const authed = req as AuthenticatedRequest;
  const parsed = ListCasesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { state, limit, offset } = parsed.data;

  const orgFilter = authed.user.organizationId
    ? eq(leaveCasesTable.organizationId, authed.user.organizationId)
    : undefined;

  const stateFilter = state ? eq(leaveCasesTable.state, state) : undefined;
  const notDeletedFilter = isNull(leaveCasesTable.deletedAt);

  const filters = [notDeletedFilter, orgFilter, stateFilter].filter(Boolean) as ReturnType<typeof eq>[];
  const whereClause = filters.length > 1 ? and(...filters) : filters[0];

  let query = db.select().from(leaveCasesTable).$dynamic();
  let countQuery = db
    .select({ count: sql<number>`count(*)::int` })
    .from(leaveCasesTable)
    .$dynamic();

  if (whereClause) {
    query = query.where(whereClause);
    countQuery = countQuery.where(whereClause);
  }

  const cases = await query
    .orderBy(desc(leaveCasesTable.updatedAt))
    .limit(limit ?? 50)
    .offset(offset ?? 0);

  const [{ count }] = await countQuery;

  res.json({
    cases,
    total: count,
    limit: limit ?? 50,
    offset: offset ?? 0,
  });
});

// POST /cases  (public — employee portal; org resolved via orgSlug query param or JWT)
router.post("/cases", async (req, res): Promise<void> => {
  try {
    const body = req.body as Record<string, unknown>;
    const parsed = CreateCaseBody.safeParse(body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const data = parsed.data;
    const caseNumber = generateCaseNumber();

    // Resolve org: prefer ?org=slug (employee portal), then fall back to JWT org (HR dashboard)
    let organizationId: string | null = null;
    const orgSlug = typeof req.query["org"] === "string" ? req.query["org"] : null;
    if (orgSlug) {
      const [org] = await db
        .select({ id: organizationsTable.id, isActive: organizationsTable.isActive })
        .from(organizationsTable)
        .where(eq(organizationsTable.slug, orgSlug));
      if (!org || !org.isActive) {
        res.status(404).json({ error: "Organization not found" });
        return;
      }
      organizationId = org.id;
    } else {
      // No slug — check if the request carries a valid HR user JWT
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith("Bearer ")) {
        const payload = verifyToken(authHeader.slice(7));
        if (payload?.organizationId) {
          organizationId = payload.organizationId;
        }
      }
    }

    if (!organizationId) {
      res.status(400).json({ error: "Organization could not be determined for this case." });
      return;
    }

    const [newCase] = await db
      .insert(leaveCasesTable)
      .values({
        organizationId,
        caseNumber,
        employeeNumber: data.employeeNumber,
        employeeFirstName: data.employeeFirstName ?? null,
        employeeLastName: data.employeeLastName ?? null,
        employeeEmail: data.employeeEmail ?? null,
        state: "INTAKE",
        displayStatus: "Case Received",
        requestedStart: data.requestedStart,
        requestedEnd: data.requestedEnd ?? null,
        leaveReasonCategory: data.leaveReasonCategory,
        intermittent: data.intermittent ?? false,
      })
      .returning();

    await logAudit(newCase.id, "CASE_CREATED", data.submittedBy);

    // If no email was provided (e.g. employee used portal lookup and email was masked),
    // fall back to the email stored in the employees table for this employee number.
    let resolvedEmail = data.employeeEmail ?? null;
    if (!resolvedEmail && data.employeeNumber && organizationId) {
      try {
        const [emp] = await db
          .select({ personalEmail: employeesTable.personalEmail, workEmail: employeesTable.workEmail })
          .from(employeesTable)
          .where(
            and(
              eq(employeesTable.organizationId, organizationId),
              eq(employeesTable.employeeId, data.employeeNumber),
              eq(employeesTable.isActive, true)
            )
          )
          .limit(1);
        resolvedEmail = emp?.personalEmail || emp?.workEmail || null;
        if (resolvedEmail) {
          // Persist the resolved email on the case record
          await db.update(leaveCasesTable).set({ employeeEmail: resolvedEmail }).where(eq(leaveCasesTable.id, newCase.id));
          logger.info({ caseId: newCase.id }, "Resolved employee email from employees table");
        }
      } catch (err) {
        logger.warn({ err, caseId: newCase.id }, "Employee email fallback lookup failed");
      }
    }

    // Send magic link / confirmation email to employee if email is available
    if (resolvedEmail) {
      try {
        const token = randomBytes(64).toString("hex");
        // expiresAt is null — the token stays valid until the case is CLOSED or CANCELLED.
        // resolveToken() in portal.ts enforces this by checking case state.
        await db.insert(caseAccessTokensTable).values({
          caseId: newCase.id,
          token,
          employeeEmail: resolvedEmail,
          expiresAt: null,
        });

        const magicLinkUrl = `${getAppUrl()}/leave/portal?token=${token}`;
        await sendMagicLinkEmail(resolvedEmail, newCase.caseNumber, magicLinkUrl);
        logger.info({ caseId: newCase.id }, "Confirmation/magic-link email sent");
      } catch (err) {
        logger.warn({ err, caseId: newCase.id }, "Magic link email failed — case still created");
      }
    }

    // Notify all active HR users in the org about the new case
    if (organizationId) {
      try {
        const hrUsers = await db
          .select({ email: usersTable.email, firstName: usersTable.firstName })
          .from(usersTable)
          .where(
            and(
              eq(usersTable.organizationId, organizationId),
              eq(usersTable.isActive, true),
            ),
          );

        const employeeName = [data.employeeFirstName, data.employeeLastName].filter(Boolean).join(" ") || data.employeeNumber;
        const caseUrl = `${getAppUrl()}/cases/${newCase.id}`;

        const REASON_LABELS: Record<string, string> = {
          own_health: "Employee's own serious health condition",
          care_family: "Care for a seriously ill family member",
          pregnancy_disability: "Pregnancy disability",
          bonding: "Bonding with a new child",
          personal: "Personal",
        };
        const leaveReason = REASON_LABELS[data.leaveReasonCategory] ?? data.leaveReasonCategory;

        for (const hrUser of hrUsers) {
          await sendNewCaseNotificationEmail({
            to: hrUser.email,
            hrFirstName: hrUser.firstName,
            caseNumber: newCase.caseNumber,
            employeeName,
            leaveReason,
            requestedStart: data.requestedStart,
            requestedEnd: data.requestedEnd ?? null,
            caseUrl,
          }).catch((err) => logger.warn({ err, to: hrUser.email }, "New case HR notification email failed"));
        }

        logger.info({ caseId: newCase.id, hrUserCount: hrUsers.length }, "New case notification sent to HR users");
      } catch (err) {
        logger.warn({ err, caseId: newCase.id }, "New case HR notification failed — case still created");
      }
    }

    res.status(201).json(newCase);
  } catch (err) {
    logger.error({ err }, "POST /cases — unexpected error creating case");
    res.status(500).json({ error: "Failed to create case. Please try again." });
  }
});

// GET /cases/calendar?start=YYYY-MM-DD&end=YYYY-MM-DD (requires auth)
// IMPORTANT: Must be registered BEFORE /cases/:caseId or Express will match "calendar" as a caseId
router.get("/cases/calendar", requireAuth, async (req, res): Promise<void> => {
  const authed = req as AuthenticatedRequest;

  const startParam = typeof req.query["start"] === "string" ? req.query["start"] : null;
  const endParam = typeof req.query["end"] === "string" ? req.query["end"] : null;

  if (!startParam || !endParam) {
    res.status(400).json({ error: "start and end query params are required (YYYY-MM-DD)." });
    return;
  }

  const orgFilter = authed.user.organizationId
    ? eq(leaveCasesTable.organizationId, authed.user.organizationId)
    : undefined;

  const notDeleted = isNull(leaveCasesTable.deletedAt);
  // Cases that overlap the requested window
  const overlapFilter = and(
    lte(leaveCasesTable.requestedStart, endParam),
    or(
      isNull(leaveCasesTable.requestedEnd),
      gte(leaveCasesTable.requestedEnd, startParam),
    ),
  );

  const filters = [notDeleted, overlapFilter, orgFilter].filter(Boolean) as ReturnType<typeof eq>[];
  const whereClause = filters.length > 1 ? and(...filters) : filters[0];

  let query = db
    .select({
      caseId: leaveCasesTable.id,
      caseNumber: leaveCasesTable.caseNumber,
      employeeFirstName: leaveCasesTable.employeeFirstName,
      employeeLastName: leaveCasesTable.employeeLastName,
      leaveReasonCategory: leaveCasesTable.leaveReasonCategory,
      requestedStart: leaveCasesTable.requestedStart,
      requestedEnd: leaveCasesTable.requestedEnd,
      state: leaveCasesTable.state,
      intermittent: leaveCasesTable.intermittent,
    })
    .from(leaveCasesTable)
    .$dynamic();

  if (whereClause) {
    query = query.where(whereClause);
  }

  const cases = await query.orderBy(leaveCasesTable.requestedStart);
  res.json({ cases });
});

// GET /cases/:caseId
router.get("/cases/:caseId", requireAuth, async (req, res): Promise<void> => {
  const authed = req as AuthenticatedRequest;

  const params = GetCaseParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const detail = await fetchCaseDetail(params.data.caseId);

  if (!detail) {
    res.status(404).json({ error: "Case not found" });
    return;
  }

  if (!isOrgAuthorized(authed.user.organizationId, detail.organizationId, req, authed.user.sub)) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  res.json(detail);
});

// POST /cases/:caseId/analyze
router.post("/cases/:caseId/analyze", requireAuth, async (req, res): Promise<void> => {
  const authed = req as AuthenticatedRequest;

  const params = AnalyzeCaseParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = AnalyzeCaseBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [leaveCase] = await db
    .select()
    .from(leaveCasesTable)
    .where(eq(leaveCasesTable.id, params.data.caseId));

  if (!leaveCase) {
    res.status(404).json({ error: "Case not found" });
    return;
  }

  if (!isOrgAuthorized(authed.user.organizationId, leaveCase.organizationId, req, authed.user.sub)) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  if (leaveCase.state === "CANCELLED" || leaveCase.state === "CLOSED") {
    res.status(400).json({
      error: `Analysis cannot be run on a ${leaveCase.state.toLowerCase()} case.`,
    });
    return;
  }

  let priorPersonalLeavesThisYear = 0;
  if (leaveCase.leaveReasonCategory === "personal") {
    const leaveStartDate = new Date(leaveCase.requestedStart);
    const twelveMonthsAgo = new Date(leaveStartDate);
    twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);
    const twelveMonthsAgoStr = twelveMonthsAgo.toISOString().slice(0, 10);

    const [{ count: priorCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(leaveCasesTable)
      .where(
        and(
          eq(leaveCasesTable.employeeNumber, leaveCase.employeeNumber),
          eq(leaveCasesTable.leaveReasonCategory, "personal"),
          ne(leaveCasesTable.state, "CANCELLED"),
          ne(leaveCasesTable.id, leaveCase.id),
          gte(leaveCasesTable.requestedStart, twelveMonthsAgoStr),
        ),
      );
    priorPersonalLeavesThisYear = priorCount;
  }

  const analysisResult = analyzeEligibility({
    leaveStartDate: new Date(leaveCase.requestedStart),
    requestedStart: leaveCase.requestedStart,
    requestedEnd: leaveCase.requestedEnd,
    leaveReasonCategory: leaveCase.leaveReasonCategory,
    avgHoursPerWeek: body.data.avgHoursPerWeek,
    employeeHireDate: body.data.employeeHireDate,
    employeeCount: body.data.employeeCount,
    intermittent: leaveCase.intermittent,
    priorPersonalLeavesThisYear,
  });

  const nextState = analysisResult.requiresHrReview
    ? "HR_REVIEW_QUEUE"
    : "ELIGIBILITY_ANALYSIS";

  let analyzeDisplayStatus: string;
  if (leaveCase.state === "ELIGIBILITY_ANALYSIS" || leaveCase.state === "HR_REVIEW_QUEUE") {
    // Override / re-run
    analyzeDisplayStatus = "Pending Additional Review";
  } else {
    // First analysis from INTAKE
    const hasEligible = analysisResult.eligiblePrograms?.some((p: { eligible?: boolean }) => p.eligible === true) ?? false;
    analyzeDisplayStatus = hasEligible ? "Reviewed - Eligible" : "Reviewed - Ineligible";
  }

  const [updated] = await db
    .update(leaveCasesTable)
    .set({
      state: nextState,
      displayStatus: analyzeDisplayStatus,
      analysisResult: analysisResult as unknown as Record<string, unknown>,
      updatedAt: new Date(),
    })
    .where(eq(leaveCasesTable.id, params.data.caseId))
    .returning();

  await logAudit(updated.id, `ANALYZE_${nextState}`, body.data.analyzedBy);

  const detail = await fetchCaseDetail(updated.id);
  res.json(detail);
});

// POST /cases/:caseId/transition
router.post("/cases/:caseId/transition", requireAuth, async (req, res): Promise<void> => {
  const authed = req as AuthenticatedRequest;

  const params = TransitionCaseParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = TransitionCaseBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [leaveCase] = await db
    .select()
    .from(leaveCasesTable)
    .where(eq(leaveCasesTable.id, params.data.caseId));

  if (!leaveCase) {
    res.status(404).json({ error: "Case not found" });
    return;
  }

  if (!isOrgAuthorized(authed.user.organizationId, leaveCase.organizationId, req, authed.user.sub)) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const targetState = getEventTransition(body.data.event);
  if (!targetState) {
    res.status(400).json({ error: `Unknown event: ${body.data.event}` });
    return;
  }

  const validTransitions: Record<string, string[]> = {
    INTAKE: ["ELIGIBILITY_ANALYSIS"],
    ELIGIBILITY_ANALYSIS: ["HR_REVIEW_QUEUE", "NOTICE_DRAFTED"],
    HR_REVIEW_QUEUE: ["NOTICE_DRAFTED", "INTAKE"],
    NOTICE_DRAFTED: ["CLOSED", "CANCELLED"],
  };

  const allowed = validTransitions[leaveCase.state] ?? [];
  if (!allowed.includes(targetState)) {
    res.status(400).json({
      error: `Cannot transition from '${leaveCase.state}' to '${targetState}' via event '${body.data.event}'.`,
    });
    return;
  }

  let transitionDisplayStatus: string | undefined;
  if (body.data.event === "ROUTE_HR_REVIEW") {
    transitionDisplayStatus = "Pending Additional Review";
  } else if (body.data.event === "CANCEL") {
    transitionDisplayStatus = "Cancelled";
  }
  // DRAFT_NOTICE: displayStatus handled by send-notices

  const [updated] = await db
    .update(leaveCasesTable)
    .set({
      state: targetState,
      ...(transitionDisplayStatus !== undefined ? { displayStatus: transitionDisplayStatus } : {}),
      updatedAt: new Date(),
    })
    .where(eq(leaveCasesTable.id, params.data.caseId))
    .returning();

  await logAudit(
    updated.id,
    `TRANSITION_${leaveCase.state}_TO_${targetState}`,
    body.data.actor,
  );

  const detail = await fetchCaseDetail(updated.id);
  res.json(detail);
});

// POST /cases/:caseId/hr-decision
router.post(
  "/cases/:caseId/hr-decision",
  requireAuth,
  async (req, res): Promise<void> => {
    const authed = req as AuthenticatedRequest;

    const params = RecordHrDecisionParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const body = RecordHrDecisionBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }

    const [leaveCase] = await db
      .select()
      .from(leaveCasesTable)
      .where(eq(leaveCasesTable.id, params.data.caseId));

    if (!leaveCase) {
      res.status(404).json({ error: "Case not found" });
      return;
    }

    if (!isOrgAuthorized(authed.user.organizationId, leaveCase.organizationId, req, authed.user.sub)) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const allowedDecisionStates = ["HR_REVIEW_QUEUE", "ELIGIBILITY_ANALYSIS", "NOTICE_DRAFTED"];
    if (!allowedDecisionStates.includes(leaveCase.state)) {
      res.status(400).json({
        error: `HR decisions can only be recorded on active cases. Current state: ${leaveCase.state}`,
      });
      return;
    }

    await db.insert(hrDecisionsTable).values({
      leaveCaseId: leaveCase.id,
      decisionType: body.data.decisionType,
      decidedBy: body.data.decidedBy,
      decisionNotes: body.data.decisionNotes ?? null,
    });

    let nextState = "NOTICE_DRAFTED";
    let hrDecisionDisplayStatus: string;
    if (body.data.decisionType === "APPROVE") {
      hrDecisionDisplayStatus = "Approved — Notice Pending";
    } else if (body.data.decisionType === "APPROVE_PARTIAL") {
      nextState = "NOTICE_DRAFTED";
      hrDecisionDisplayStatus = "Partially Approved — Notice Pending";
    } else if (body.data.decisionType === "DENY") {
      hrDecisionDisplayStatus = "Denied — Notice Pending";
    } else {
      // REQUEST_MORE_INFO
      nextState = "INTAKE";
      hrDecisionDisplayStatus = leaveCase.assignedToUserId ? "In Review" : "Case Received";
    }

    const [updated] = await db
      .update(leaveCasesTable)
      .set({
        state: nextState,
        displayStatus: hrDecisionDisplayStatus,
        updatedAt: new Date(),
      })
      .where(eq(leaveCasesTable.id, leaveCase.id))
      .returning();

    await logAudit(
      updated.id,
      `HR_DECISION_${body.data.decisionType}`,
      body.data.decidedBy,
    );

    const detail = await fetchCaseDetail(updated.id);
    res.status(201).json(detail);
  },
);

// GET /cases/:caseId/audit-log
router.get(
  "/cases/:caseId/audit-log",
  requireAuth,
  async (req, res): Promise<void> => {
    const authed = req as AuthenticatedRequest;

    const params = GetCaseAuditLogParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [leaveCase] = await db
      .select({ organizationId: leaveCasesTable.organizationId })
      .from(leaveCasesTable)
      .where(eq(leaveCasesTable.id, params.data.caseId));

    if (!leaveCase) {
      res.status(404).json({ error: "Case not found" });
      return;
    }

    if (!isOrgAuthorized(authed.user.organizationId, leaveCase.organizationId, req, authed.user.sub)) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const entries = await db
      .select()
      .from(auditLogTable)
      .where(eq(auditLogTable.entityId, params.data.caseId))
      .orderBy(desc(auditLogTable.createdAt));

    res.json({ entries, total: entries.length });
  },
);

// POST /cases/:caseId/ai-recommendation
router.post(
  "/cases/:caseId/ai-recommendation",
  requireAuth,
  async (req, res): Promise<void> => {
    const authed = req as AuthenticatedRequest;

    try {
      const params = GetAiRecommendationParams.safeParse(req.params);
      if (!params.success) {
        res.status(400).json({ error: params.error.message });
        return;
      }

      const [leaveCase] = await db
        .select()
        .from(leaveCasesTable)
        .where(eq(leaveCasesTable.id, params.data.caseId));

      if (!leaveCase) {
        res.status(404).json({ error: "Case not found" });
        return;
      }

      if (!isOrgAuthorized(authed.user.organizationId, leaveCase.organizationId, req, authed.user.sub)) {
        res.status(403).json({ error: "Access denied" });
        return;
      }

      if (!leaveCase.analysisResult) {
        res.status(400).json({
          error: "Case has not been analyzed yet. Run eligibility analysis first.",
        });
        return;
      }

      const analysisResult = leaveCase.analysisResult as import("../lib/eligibility").AnalysisResult;

      // Fetch sender (logged-in HR user) full details for notice auto-fill
      const [senderUser] = await db
        .select({
          firstName: usersTable.firstName,
          lastName: usersTable.lastName,
          position: usersTable.position,
          email: usersTable.email,
        })
        .from(usersTable)
        .where(eq(usersTable.id, authed.user.sub))
        .limit(1);

      const { requestedBy, feedback } = req.body as { requestedBy?: string; feedback?: string };

      const result = await generateAiRecommendation({
        caseNumber: leaveCase.caseNumber,
        employeeNumber: leaveCase.employeeNumber,
        employeeFirstName: leaveCase.employeeFirstName,
        employeeLastName: leaveCase.employeeLastName,
        employeeEmail: leaveCase.employeeEmail,
        leaveReasonCategory: leaveCase.leaveReasonCategory,
        requestedStart: leaveCase.requestedStart,
        requestedEnd: leaveCase.requestedEnd,
        intermittent: leaveCase.intermittent,
        analysisResult,
        organizationId: leaveCase.organizationId,
        senderName: senderUser ? `${senderUser.firstName} ${senderUser.lastName}`.trim() : null,
        senderTitle: senderUser?.position ?? null,
        senderEmail: senderUser?.email ?? authed.user.email,
        feedback: feedback ?? null,
      });

      await logAudit(
        leaveCase.id,
        "AI_RECOMMENDATION_GENERATED",
        authed.user.email,
        {
          recommendation: {
            action: result.recommendation.action,
            confidenceScore: result.recommendation.confidenceScore,
            reasoning: result.recommendation.reasoning,
          },
          noticeTypes: result.notices.map((n: { noticeType: string }) => n.noticeType),
          feedbackProvided: !!feedback,
          feedbackText: feedback || undefined,
        },
        leaveCase.organizationId ?? undefined,
      );

      // Note: Medical certification is NOT stored in caseDocuments at recommendation time.
      // It is only archived when HR sends it via send-notices, keeping the case docs panel clean.

      res.json(result);
    } catch (err) {
      logger.error({ err, caseId: req.params.caseId, user: authed.user.email }, "AI recommendation failed");
      const message = err instanceof Error ? err.message : "An unexpected error occurred";
      res.status(500).json({ error: message });
    }
  },
);

// POST /cases/:caseId/send-notices
router.post(
  "/cases/:caseId/send-notices",
  requireAuth,
  async (req, res): Promise<void> => {
    const authed = req as AuthenticatedRequest;

    const params = SendNoticesParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const body = SendNoticesBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }

    const [leaveCase] = await db
      .select()
      .from(leaveCasesTable)
      .where(eq(leaveCasesTable.id, params.data.caseId));

    if (!leaveCase) {
      res.status(404).json({ error: "Case not found" });
      return;
    }

    if (!isOrgAuthorized(authed.user.organizationId, leaveCase.organizationId, req, authed.user.sub)) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const { notices, employeeEmail: overrideEmail } = body.data;
    const actor = authed.user.email;

    const recipientEmail = leaveCase.employeeEmail ?? overrideEmail;
    if (!recipientEmail) {
      res.status(400).json({
        error:
          "No employee email on file. Please provide an email address to send notices.",
      });
      return;
    }

    const auditEntries: {
      id: string;
      entity: string;
      entityId: string;
      action: string;
      actor: string;
      createdAt: Date;
    }[] = [];

    // Find the medical certification notice — from the current send batch OR from DB (previously stored)
    const medCertNotice = notices.find((n: { noticeType: string; content: string }) => n.noticeType === "MEDICAL_CERTIFICATION");
    let medCertContent: string | null = medCertNotice?.content ?? null;

    // If not in this batch, try to find a previously archived med cert document for this case
    if (!medCertContent) {
      const [storedMedCert] = await db
        .select({ contentInline: caseDocumentsTable.contentInline })
        .from(caseDocumentsTable)
        .where(
          and(
            eq(caseDocumentsTable.caseId, leaveCase.id),
            like(caseDocumentsTable.fileName, "MEDICAL_CERTIFICATION%"),
          )
        )
        .orderBy(desc(caseDocumentsTable.createdAt))
        .limit(1);
      medCertContent = storedMedCert?.contentInline ? decryptDocContent(storedMedCert.contentInline) ?? null : null;
    }

    // medCertContent may be a base64-encoded PDF (new entries) or raw text (legacy).
    // toPdfBase64 handles both, always returning a valid base64 PDF for the attachment.
    const medCertAttachment: EmailAttachment | undefined = medCertContent
      ? {
          filename: `Medical_Certification_Form_${leaveCase.caseNumber}.pdf`,
          content: toPdfBase64(medCertContent),
        }
      : undefined;

    if (!medCertAttachment) {
      logger.warn({ caseId: leaveCase.id }, "No medical certification found — eligibility notice will send without attachment");
    }

    let anyEmailDelivered = false;

    for (const notice of notices) {
      // Medical cert is attached to the eligibility notice — don't send as a standalone email
      if (notice.noticeType !== "MEDICAL_CERTIFICATION") {
        const emailAttachments: EmailAttachment[] = [];
        if (notice.noticeType === "ELIGIBILITY_NOTICE" && medCertAttachment) {
          emailAttachments.push(medCertAttachment);
        }

        try {
          const delivered = await sendNoticeEmail({
            to: recipientEmail,
            noticeType: notice.noticeType,
            content: notice.content,
            caseNumber: leaveCase.caseNumber,
            employeeNumber: leaveCase.employeeNumber,
            attachments: emailAttachments.length > 0 ? emailAttachments : undefined,
          });
          if (delivered) anyEmailDelivered = true;
        } catch (emailErr) {
          logger.error({ emailErr, noticeType: notice.noticeType, to: recipientEmail }, "Email delivery failed — notice still archived");
        }

        const [entry] = await db
          .insert(auditLogTable)
          .values({
            entity: "leave_case",
            entityId: leaveCase.id,
            action: `NOTICE_SENT_${notice.noticeType}`,
            actor,
            metadata: { noticeType: notice.noticeType, employeeEmail: recipientEmail },
            organizationId: leaveCase.organizationId,
          })
          .returning();

        auditEntries.push(entry);
      }

      // Archive notice as case document — store inline in DB (no R2 dependency).
      // Medical certification is converted to an actual PDF buffer (base64) so that
      // every retrieval path (HR download, employee portal download) can serve it
      // correctly without needing to re-render it from raw text.
      try {
        const noticeDate = new Date().toISOString().split("T")[0];
        const isMedCert = notice.noticeType === "MEDICAL_CERTIFICATION";
        const noticeFileName = `${notice.noticeType}_${leaveCase.caseNumber}_${noticeDate}${isMedCert ? ".pdf" : ".txt"}`;

        // Convert med cert text → real PDF bytes stored as base64; other notices stay as UTF-8 text.
        const inlineContent = isMedCert
          ? buildMedCertPdf(notice.content).toString("base64")
          : notice.content;
        const mimeType = isMedCert ? "application/pdf" : "text/plain";
        const sizeBytes = isMedCert
          ? Buffer.from(inlineContent, "base64").length
          : Buffer.from(inlineContent, "utf-8").length;

        await db.insert(caseDocumentsTable).values({
          caseId: leaveCase.id,
          uploadedBy: "hr",
          fileName: noticeFileName,
          storageKey: null,
          contentInline: encryptDocContent(inlineContent),
          mimeType,
          sizeBytes,
        });
      } catch (docErr) {
        logger.warn({ docErr, noticeType: notice.noticeType, caseId: leaveCase.id }, "Failed to archive notice as case document");
      }
    }

    // Update displayStatus based on which notices were sent
    let newDisplayStatus: string;
    if (notices.some((n: { noticeType: string; content: string }) => n.noticeType === "DESIGNATION_NOTICE")) {
      const [latestDecision] = await db
        .select()
        .from(hrDecisionsTable)
        .where(eq(hrDecisionsTable.leaveCaseId, leaveCase.id))
        .orderBy(desc(hrDecisionsTable.decidedAt))
        .limit(1);
      newDisplayStatus = latestDecision?.decisionType === "DENY" ? "Denied" : "Approved";
    } else {
      newDisplayStatus = "Notices Drafted - Documentation Pending";
    }
    await db
      .update(leaveCasesTable)
      .set({ displayStatus: newDisplayStatus, updatedAt: new Date() })
      .where(eq(leaveCasesTable.id, leaveCase.id));

    res.json({ sent: notices.length, auditEntries, emailDelivered: anyEmailDelivered });
  },
);

const hrDocUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const allowed = [
      "application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    cb(null, allowed.includes(file.mimetype));
  },
});

// POST /cases/:caseId/documents (HR — requires auth)
router.post(
  "/cases/:caseId/documents",
  requireAuth,
  hrDocUpload.single("file"),
  async (req, res): Promise<void> => {
    const authed = req as AuthenticatedRequest;
    const caseId = String(req.params["caseId"]);

    const [leaveCase] = await db
      .select({ organizationId: leaveCasesTable.organizationId })
      .from(leaveCasesTable)
      .where(eq(leaveCasesTable.id, caseId))
      .limit(1);

    if (!leaveCase) { res.status(404).json({ error: "Case not found." }); return; }
    if (!isOrgAuthorized(authed.user.organizationId, leaveCase.organizationId, req, authed.user.sub)) {
      res.status(403).json({ error: "Access denied." }); return;
    }

    const file = req.file;
    if (!file) { res.status(400).json({ error: "No file provided." }); return; }

    let storageKey: string | null = null;
    let contentInline: string | null = null;

    const { isR2Configured, uploadFile } = await import("../lib/storage.js");
    if (isR2Configured()) {
      const ext = file.originalname.split(".").pop() ?? "bin";
      const key = `cases/${caseId}/documents/${randomBytes(8).toString("hex")}.${ext}`;
      try {
        await uploadFile(key, file.buffer, file.mimetype);
        storageKey = key;
      } catch (err) {
        logger.warn({ err, caseId }, "R2 upload failed — falling back to inline DB storage");
        contentInline = file.buffer.toString("base64");
      }
    } else {
      contentInline = file.buffer.toString("base64");
    }

    const [doc] = await db
      .insert(caseDocumentsTable)
      .values({
        caseId,
        uploadedBy: "hr",
        fileName: file.originalname,
        storageKey,
        contentInline: contentInline ? encryptDocContent(contentInline) : null,
        mimeType: file.mimetype,
        sizeBytes: file.size,
      })
      .returning();

    await logAudit(caseId, "HR_DOCUMENT_UPLOADED", authed.user.email);
    res.status(201).json({ documents: [{ ...doc }] });
  },
);

// GET /cases/:caseId/documents (HR — requires auth)
// Restricted to HR (hr_admin / hr_user). Managers must not access medical documents.
router.get("/cases/:caseId/documents", requireHrAccess, async (req, res): Promise<void> => {
  const authed = req as AuthenticatedRequest;
  const { caseId } = req.params;

  const [leaveCase] = await db
    .select({ organizationId: leaveCasesTable.organizationId })
    .from(leaveCasesTable)
    .where(eq(leaveCasesTable.id, caseId))
    .limit(1);

  if (!leaveCase) {
    res.status(404).json({ error: "Case not found." });
    return;
  }

  if (!isOrgAuthorized(authed.user.organizationId, leaveCase.organizationId, req, authed.user.sub)) {
    res.status(403).json({ error: "Access denied." });
    return;
  }

  const documents = await db
    .select({
      id: caseDocumentsTable.id,
      fileName: caseDocumentsTable.fileName,
      mimeType: caseDocumentsTable.mimeType,
      sizeBytes: caseDocumentsTable.sizeBytes,
      uploadedBy: caseDocumentsTable.uploadedBy,
      createdAt: caseDocumentsTable.createdAt,
    })
    .from(caseDocumentsTable)
    .where(eq(caseDocumentsTable.caseId, caseId))
    .orderBy(desc(caseDocumentsTable.createdAt));

  res.json({ documents });
});

// GET /cases/:caseId/documents/:docId/download (HR only — managers excluded from medical docs)
router.get(
  "/cases/:caseId/documents/:docId/download",
  requireHrAccess,
  async (req, res): Promise<void> => {
    const authed = req as AuthenticatedRequest;
    const { caseId, docId } = req.params;

    const [leaveCase] = await db
      .select({ organizationId: leaveCasesTable.organizationId })
      .from(leaveCasesTable)
      .where(eq(leaveCasesTable.id, caseId))
      .limit(1);

    if (!leaveCase) {
      res.status(404).json({ error: "Case not found." });
      return;
    }

    if (!isOrgAuthorized(authed.user.organizationId, leaveCase.organizationId, req, authed.user.sub)) {
      res.status(403).json({ error: "Access denied." });
      return;
    }

    const [doc] = await db
      .select()
      .from(caseDocumentsTable)
      .where(and(eq(caseDocumentsTable.id, docId), eq(caseDocumentsTable.caseId, caseId)))
      .limit(1);

    if (!doc) {
      res.status(404).json({ error: "Document not found." });
      return;
    }

    // Audit log: record who downloaded this document (important for medical certs)
    await logAudit(String(caseId), "DOCUMENT_DOWNLOADED", authed.user.email, { docId: String(docId), fileName: doc.fileName }, leaveCase.organizationId);

    try {
      // Inline content (notices / cached forms) — serve directly without R2
      const contentInline = decryptDocContent((doc as any).contentInline as string | null | undefined);
      if (!doc.storageKey && contentInline) {
        const mimeType = doc.mimeType ?? "text/plain";
        res.setHeader("Content-Disposition", `attachment; filename="${doc.fileName}"`);

        if (mimeType === "application/pdf") {
          // contentInline may be a base64-encoded PDF (new entries) or raw text (legacy entries).
          // toPdfBuffer handles both cases transparently.
          const pdfBuffer = toPdfBuffer(contentInline);
          res.setHeader("Content-Type", "application/pdf");
          res.send(pdfBuffer);
        } else if (mimeType === "text/plain") {
          // Notices stored as raw text
          res.setHeader("Content-Type", mimeType);
          res.send(Buffer.from(contentInline, "utf-8"));
        } else {
          // All other inline content (images, docs) is base64-encoded binary
          res.setHeader("Content-Type", mimeType);
          res.send(Buffer.from(contentInline, "base64"));
        }
        return;
      }

      // R2-stored file — return a short-lived presigned download URL
      if (!doc.storageKey) {
        res.status(404).json({ error: "Document content not found." });
        return;
      }
      const { getPresignedUrl } = await import("../lib/storage.js");
      const url = await getPresignedUrl(doc.storageKey, 3600);
      res.json({ url, fileName: doc.fileName });
    } catch (downloadErr) {
      logger.error({ downloadErr, docId, caseId }, "Document download failed");
      res.status(500).json({ error: "Failed to prepare document for download. Please try again." });
    }
  },
);

// DELETE /cases/:caseId  (admin only — soft delete with reason)
router.delete(
  "/cases/:caseId",
  requireAuth,
  async (req, res): Promise<void> => {
    const authed = req as AuthenticatedRequest;

    if (authed.user.role !== "hr_admin") {
      res.status(403).json({ error: "Only admin users may delete cases." });
      return;
    }

    const caseId = String(req.params["caseId"]);
    const { reason } = req.body as { reason?: string };

    if (!reason || reason.trim().length < 10) {
      res.status(400).json({ error: "A deletion reason of at least 10 characters is required." });
      return;
    }

    const [leaveCase] = await db
      .select()
      .from(leaveCasesTable)
      .where(eq(leaveCasesTable.id, caseId));

    if (!leaveCase) {
      res.status(404).json({ error: "Case not found." });
      return;
    }

    if (!isOrgAuthorized(authed.user.organizationId ?? null, leaveCase.organizationId ?? null, req, authed.user.sub)) {
      res.status(403).json({ error: "Not authorized for this organization." });
      return;
    }

    if (leaveCase.deletedAt) {
      res.status(409).json({ error: "Case is already deleted." });
      return;
    }

    await db
      .update(leaveCasesTable)
      .set({ deletedAt: new Date(), deletedReason: reason.trim() })
      .where(eq(leaveCasesTable.id, caseId));

    await logAudit(caseId, `CASE_DELETED: ${reason.trim()}`, authed.user.email);

    res.json({ success: true });
  },
);

// PATCH /cases/:caseId/assign  (requireAuth — assign or unassign a case)
router.patch(
  "/cases/:caseId/assign",
  requireAuth,
  async (req, res): Promise<void> => {
    const authed = req as AuthenticatedRequest;
    const caseId = String(req.params["caseId"]);
    const { assignedToUserId } = req.body as { assignedToUserId?: string | null };

    const [leaveCase] = await db
      .select()
      .from(leaveCasesTable)
      .where(eq(leaveCasesTable.id, caseId))
      .limit(1);

    if (!leaveCase) {
      res.status(404).json({ error: "Case not found." });
      return;
    }

    if (!isOrgAuthorized(authed.user.organizationId, leaveCase.organizationId, req, authed.user.sub)) {
      res.status(403).json({ error: "Access denied." });
      return;
    }

    // If assigning to a specific user, verify that user belongs to the same org
    if (assignedToUserId) {
      const [targetUser] = await db
        .select({ organizationId: usersTable.organizationId })
        .from(usersTable)
        .where(eq(usersTable.id, assignedToUserId))
        .limit(1);

      if (!targetUser) {
        res.status(404).json({ error: "User not found." });
        return;
      }

      if (authed.user.organizationId && targetUser.organizationId !== authed.user.organizationId) {
        res.status(403).json({ error: "Cannot assign case to a user outside your organization." });
        return;
      }
    }

    let assignDisplayStatus: string | undefined;
    if (assignedToUserId) {
      assignDisplayStatus = "In Review";
    } else if (leaveCase.state === "INTAKE") {
      assignDisplayStatus = "Case Received";
    }
    // For unassign in non-INTAKE states, leave displayStatus unchanged

    await db
      .update(leaveCasesTable)
      .set({
        assignedToUserId: assignedToUserId ?? null,
        ...(assignDisplayStatus !== undefined ? { displayStatus: assignDisplayStatus } : {}),
        updatedAt: new Date(),
      })
      .where(eq(leaveCasesTable.id, caseId));

    const auditAction = assignedToUserId ? "CASE_ASSIGNED" : "CASE_UNASSIGNED";
    await logAudit(caseId, auditAction, authed.user.email);

    const detail = await fetchCaseDetail(caseId);
    res.json(detail);
  },
);

// POST /cases/:caseId/close — HR confirms RTW date and closes the case
router.post(
  "/cases/:caseId/close",
  requireAuth,
  async (req, res): Promise<void> => {
    const authed = req as AuthenticatedRequest;
    const { caseId } = req.params as { caseId: string };
    const { returnedToWorkAt, notes } = req.body as { returnedToWorkAt?: string; notes?: string };

    const [leaveCase] = await db
      .select()
      .from(leaveCasesTable)
      .where(eq(leaveCasesTable.id, caseId));

    if (!leaveCase) {
      res.status(404).json({ error: "Case not found." });
      return;
    }

    if (!isOrgAuthorized(authed.user.organizationId, leaveCase.organizationId, req, authed.user.sub)) {
      res.status(403).json({ error: "Access denied." });
      return;
    }

    if (leaveCase.state === "CLOSED" || leaveCase.state === "CANCELLED") {
      res.status(400).json({ error: `Case is already ${leaveCase.state.toLowerCase()}.` });
      return;
    }

    // RTW date priority: HR-provided → employee-reported → today
    const rtwDate =
      returnedToWorkAt ??
      leaveCase.returnedToWorkAt ??
      new Date().toISOString().split("T")[0];

    await db
      .update(leaveCasesTable)
      .set({ state: "CLOSED", displayStatus: "Closed", returnedToWorkAt: rtwDate, updatedAt: new Date() })
      .where(eq(leaveCasesTable.id, caseId));

    await logAudit(caseId, "CASE_CLOSED_RTW_CONFIRMED", authed.user.email);
    if (notes?.trim()) {
      await logAudit(caseId, `CLOSE_NOTES: ${notes.trim()}`, authed.user.email);
    }

    const detail = await fetchCaseDetail(caseId);
    res.json(detail);
  },
);

// POST /cases/:caseId/review-documentation
router.post(
  "/cases/:caseId/review-documentation",
  requireAuth,
  async (req, res): Promise<void> => {
    const authed = req as AuthenticatedRequest;
    const caseId = String(req.params["caseId"]);
    const { documentIds } = req.body as { documentIds: string[] };

    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      res.status(400).json({ error: "documentIds must be a non-empty array" });
      return;
    }

    const [leaveCase] = await db
      .select()
      .from(leaveCasesTable)
      .where(eq(leaveCasesTable.id, caseId))
      .limit(1);

    if (!leaveCase) { res.status(404).json({ error: "Case not found" }); return; }
    if (!isOrgAuthorized(authed.user.organizationId, leaveCase.organizationId, req, authed.user.sub)) {
      res.status(403).json({ error: "Access denied" }); return;
    }

    // Fetch the selected documents
    const docs = await db
      .select()
      .from(caseDocumentsTable)
      .where(
        and(
          eq(caseDocumentsTable.caseId, caseId),
          inArray(caseDocumentsTable.id, documentIds),
        )
      );

    if (docs.length === 0) {
      res.status(400).json({ error: "No matching documents found" });
      return;
    }

    // Build content blocks for Claude
    type ContentBlock =
      | { type: "text"; text: string }
      | { type: "document"; source: { type: "base64"; media_type: string; data: string }; title: string };

    const contentBlocks: ContentBlock[] = [];

    const employeeName = [leaveCase.employeeFirstName, leaveCase.employeeLastName].filter(Boolean).join(" ") || `Employee #${leaveCase.employeeNumber}`;
    const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

    contentBlocks.push({
      type: "text",
      text: `You are reviewing medical certification documentation for an FMLA leave request.

CASE INFORMATION:
- Case Number: ${leaveCase.caseNumber}
- Employee: ${employeeName}
- Leave Reason: ${leaveCase.leaveReasonCategory}
- Requested Start: ${leaveCase.requestedStart}
- Requested End: ${leaveCase.requestedEnd ?? "Open-ended"}
- Current Status: Conditionally Approved — Pending Documentation
- Review Date: ${today}

Please review the attached documentation and determine whether it sufficiently supports the FMLA leave request. Then draft a final Designation Notice communicating the decision (APPROVE, DENY, or REQUEST_MORE_INFO if documentation is incomplete).

Respond ONLY with valid JSON in exactly this format:
{
  "recommendation": "APPROVE" | "DENY" | "REQUEST_MORE_INFO",
  "analysis": "2-4 sentence summary of what the documentation shows and whether it meets FMLA requirements",
  "keyFindings": ["finding 1", "finding 2", "finding 3"],
  "designationNotice": {
    "noticeType": "DESIGNATION_NOTICE",
    "title": "Leave Designation Notice",
    "content": "Full designation notice text (300-500 words) communicating the final decision. Address the employee by name. Reference the submitted documentation. For APPROVE: confirm leave is designated as FMLA-qualifying, state approved dates, confirm health benefit continuation, note any fitness-for-duty requirement. For DENY: state the specific legal reason. For REQUEST_MORE_INFO: specify exactly what is missing and provide a 15-day deadline. Sign from HR."
  }
}`,
    });

    // Add each document as a content block
    for (const doc of docs) {
      try {
        if (doc.storageKey) {
          // R2-stored file — download and send as base64 document
          const { downloadFile } = await import("../lib/storage.js");
          const buffer = await downloadFile(doc.storageKey);
          const mimeType = doc.mimeType ?? "application/pdf";
          contentBlocks.push({
            type: "document",
            source: {
              type: "base64",
              media_type: mimeType,
              data: buffer.toString("base64"),
            },
            title: doc.fileName,
          });
        } else if (doc.contentInline) {
          // contentInline may be a base64-encoded PDF (uploaded file, no storage configured)
          // or raw text (HR-generated notices). It is encrypted at rest — decrypt first.
          const inline = decryptDocContent(doc.contentInline) ?? "";
          if (isBase64Pdf(inline)) {
            contentBlocks.push({
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: inline,
              },
              title: doc.fileName,
            });
          } else {
            // Raw text document (e.g. HR notices stored as plain text)
            contentBlocks.push({
              type: "text",
              text: `\n--- DOCUMENT: ${doc.fileName} ---\n${inline}\n--- END DOCUMENT ---`,
            });
          }
        }
      } catch (docErr) {
        logger.warn({ docErr, docId: doc.id }, "Could not load document for review — skipping");
      }
    }

    const { anthropic } = await import("../lib/anthropic.js");

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 4096,
      messages: [{ role: "user", content: contentBlocks as Parameters<typeof anthropic.messages.create>[0]["messages"][0]["content"] }],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    const rawContent = textBlock?.type === "text" ? textBlock.text : null;
    if (!rawContent) {
      res.status(500).json({ error: "No response from AI" });
      return;
    }

    const cleaned = rawContent
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();

    let parsed: {
      recommendation: string;
      analysis: string;
      keyFindings: string[];
      designationNotice: { noticeType: string; title: string; content: string };
    };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      logger.error({ rawContent: rawContent.slice(0, 500) }, "Failed to parse doc review JSON");
      res.status(500).json({ error: "AI returned malformed response — please try again" });
      return;
    }

    await logAudit(caseId, "AI_DOCUMENTATION_REVIEW", authed.user.email);

    res.json(parsed);
  },
);

// POST /cases/:caseId/benefits-continuation-letter
// Generates a benefits continuation letter with HR-provided benefit details
router.post(
  "/cases/:caseId/benefits-continuation-letter",
  requireAuth,
  async (req, res): Promise<void> => {
    const authed = req as AuthenticatedRequest;
    const caseId = String(req.params["caseId"]);
    const { benefits } = req.body as {
      benefits?: Array<{ name: string; monthlyAmount: string | number }>;
    };

    if (!Array.isArray(benefits) || benefits.length === 0) {
      res.status(400).json({ error: "benefits array is required" });
      return;
    }

    const [leaveCase] = await db
      .select()
      .from(leaveCasesTable)
      .where(eq(leaveCasesTable.id, caseId))
      .limit(1);

    if (!leaveCase) { res.status(404).json({ error: "Case not found" }); return; }
    if (!isOrgAuthorized(authed.user.organizationId, leaveCase.organizationId, req, authed.user.sub)) {
      res.status(403).json({ error: "Access denied" }); return;
    }

    const employeeName = [leaveCase.employeeFirstName, leaveCase.employeeLastName].filter(Boolean).join(" ") || `Employee #${leaveCase.employeeNumber}`;
    const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

    const benefitLines = benefits
      .map((b) => `- ${b.name}: $${b.monthlyAmount}/month`)
      .join("\n");

    const totalMonthly = benefits.reduce((sum, b) => sum + parseFloat(String(b.monthlyAmount) || "0"), 0);

    const prompt = `You are an HR compliance specialist. Generate a professional FMLA Benefits Continuation Letter for the following case.

CASE INFORMATION:
- Employee: ${employeeName}
- Leave Start: ${leaveCase.requestedStart}
- Leave End: ${leaveCase.requestedEnd ?? "TBD"}
- Leave Reason: ${leaveCase.leaveReasonCategory}
- Case Number: ${leaveCase.caseNumber}
- Today's Date: ${today}

BENEFITS CONTINUING DURING LEAVE:
${benefitLines}
- TOTAL monthly cost: $${totalMonthly.toFixed(2)}/month

Generate a formal, professional benefits continuation letter addressed to the employee. The letter must:
1. Confirm the employee's approved leave period
2. List each continuing benefit and its monthly cost
3. State the total monthly value of continued benefits
4. Explain the employee's responsibility for any premium co-payments (if applicable)
5. Provide contact information for benefits questions (use "HR Department" as the contact)
6. Be professional and empathetic in tone
7. Include a signature block for the HR representative

Return ONLY the letter text, formatted for direct use. No additional commentary.`;

    try {
      const { anthropic } = await import("../lib/anthropic.js");
      const message = await anthropic.messages.create({
        model: "claude-opus-4-5",
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
      });

      const letterContent = message.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { type: "text"; text: string }).text)
        .join("\n");

      res.json({
        noticeType: "BENEFITS_CONTINUATION",
        title: "Benefits Continuation Letter",
        content: letterContent,
      });
    } catch (err) {
      logger.error({ err }, "benefits continuation letter generation error");
      res.status(500).json({ error: "Failed to generate letter" });
    }
  }
);

// GET /notifications
router.get("/notifications", requireAuth, async (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  if (!user?.organizationId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  // Notification-worthy audit actions
  const NOTIFY_ACTIONS = [
    "CASE_CREATED",
    "EMPLOYEE_REPORTED_RTW",
    "EMPLOYEE_DOCUMENT_UPLOADED",
  ];

  const rows = await db
    .select({
      id: auditLogTable.id,
      action: auditLogTable.action,
      actor: auditLogTable.actor,
      createdAt: auditLogTable.createdAt,
      caseId: leaveCasesTable.id,
      caseNumber: leaveCasesTable.caseNumber,
      employeeFirstName: leaveCasesTable.employeeFirstName,
      employeeLastName: leaveCasesTable.employeeLastName,
    })
    .from(auditLogTable)
    .innerJoin(leaveCasesTable, eq(auditLogTable.entityId, leaveCasesTable.id))
    .where(
      and(
        eq(leaveCasesTable.organizationId, user.organizationId),
        inArray(auditLogTable.action, NOTIFY_ACTIONS),
        isNull(leaveCasesTable.deletedAt),
      )
    )
    .orderBy(desc(auditLogTable.createdAt))
    .limit(30);

  res.json({ notifications: rows });
});

// PATCH /cases/:caseId/email  (HR — update employee email address)
router.patch(
  "/cases/:caseId/email",
  requireAuth,
  async (req, res): Promise<void> => {
    const authed = req as AuthenticatedRequest;
    const caseId = String(req.params["caseId"]);
    const { employeeEmail } = req.body as { employeeEmail?: string };

    if (!employeeEmail?.trim()) {
      res.status(400).json({ error: "employeeEmail is required" });
      return;
    }

    const [leaveCase] = await db
      .select()
      .from(leaveCasesTable)
      .where(eq(leaveCasesTable.id, caseId))
      .limit(1);

    if (!leaveCase) {
      res.status(404).json({ error: "Case not found." });
      return;
    }

    if (!isOrgAuthorized(authed.user.organizationId, leaveCase.organizationId, req, authed.user.sub)) {
      res.status(403).json({ error: "Access denied." });
      return;
    }

    await db
      .update(leaveCasesTable)
      .set({ employeeEmail: employeeEmail.trim(), updatedAt: new Date() })
      .where(eq(leaveCasesTable.id, caseId));

    await logAudit(caseId, "EMPLOYEE_EMAIL_UPDATED", authed.user.email);
    res.json({ ok: true, employeeEmail: employeeEmail.trim() });
  },
);

// GET /cases/:caseId/ai-history
router.get(
  "/cases/:caseId/ai-history",
  requireAuth,
  async (req, res): Promise<void> => {
    const authed = req as AuthenticatedRequest;
    const { caseId } = req.params;
    const [leaveCase] = await db.select({ organizationId: leaveCasesTable.organizationId })
      .from(leaveCasesTable).where(eq(leaveCasesTable.id, caseId)).limit(1);
    if (!leaveCase) { res.status(404).json({ error: "Case not found." }); return; }
    if (!isOrgAuthorized(authed.user.organizationId, leaveCase.organizationId, req, authed.user.sub)) {
      res.status(403).json({ error: "Access denied." }); return;
    }
    const entries = await db.select()
      .from(auditLogTable)
      .where(and(
        eq(auditLogTable.entityId, caseId),
        or(
          like(auditLogTable.action, "AI_%"),
          like(auditLogTable.action, "NOTICE_SENT_%"),
        )
      ))
      .orderBy(desc(auditLogTable.createdAt))
      .limit(30);
    res.json({ entries });
  }
);

// GET /admin/audit
router.get(
  "/admin/audit",
  requireAuth,
  async (req, res): Promise<void> => {
    const authed = req as AuthenticatedRequest;
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const { action, actor, caseId, startDate, endDate, page } = req.query as Record<string, string | undefined>;
    const pageNum = Math.max(1, parseInt(page ?? "1") || 1);
    const limit = 100;
    const offset = (pageNum - 1) * limit;

    const entries = await db
      .select({
        id: auditLogTable.id,
        action: auditLogTable.action,
        actor: auditLogTable.actor,
        entityId: auditLogTable.entityId,
        metadata: auditLogTable.metadata,
        createdAt: auditLogTable.createdAt,
        caseNumber: leaveCasesTable.caseNumber,
        employeeFirstName: leaveCasesTable.employeeFirstName,
        employeeLastName: leaveCasesTable.employeeLastName,
      })
      .from(auditLogTable)
      .innerJoin(leaveCasesTable, eq(auditLogTable.entityId, leaveCasesTable.id))
      .where(and(
        eq(leaveCasesTable.organizationId, orgId),
        caseId ? eq(auditLogTable.entityId, caseId) : undefined,
        action ? like(auditLogTable.action, `%${action}%`) : undefined,
        actor ? like(auditLogTable.actor, `%${actor}%`) : undefined,
        startDate ? gte(auditLogTable.createdAt, new Date(startDate)) : undefined,
        endDate ? lte(auditLogTable.createdAt, new Date(endDate)) : undefined,
      ))
      .orderBy(desc(auditLogTable.createdAt))
      .limit(limit)
      .offset(offset);

    res.json({ entries, page: pageNum, limit });
  }
);

export default router;
