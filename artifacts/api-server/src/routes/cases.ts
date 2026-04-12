import { Router, type IRouter } from "express";
import { eq, desc, sql, and, ne, gte, lte, isNull, or } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { db, leaveCasesTable, hrDecisionsTable, auditLogTable, organizationsTable, caseAccessTokensTable, caseDocumentsTable, usersTable } from "@workspace/db";
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
import { requireAuth, verifyToken, type AuthenticatedRequest } from "../lib/jwtAuth";
import { generateAiRecommendation } from "../lib/aiRecommendation";
import { sendNoticeEmail, sendMagicLinkEmail, getAppUrl, type EmailAttachment } from "../lib/email";
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
): Promise<void> {
  await db.insert(auditLogTable).values({
    entity: "leave_case",
    entityId,
    action,
    actor,
  });
}

function isOrgAuthorized(
  userOrgId: string | null,
  caseOrgId: string | null,
): boolean {
  if (!userOrgId) return true;
  return caseOrgId === userOrgId;
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

  return {
    ...leaveCase,
    hrDecisions: decisions,
    auditLog: auditEntries,
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
        requestedStart: data.requestedStart,
        requestedEnd: data.requestedEnd ?? null,
        leaveReasonCategory: data.leaveReasonCategory,
        intermittent: data.intermittent ?? false,
      })
      .returning();

    await logAudit(newCase.id, "CASE_CREATED", data.submittedBy);

    // Send magic link / confirmation email to employee if email is available
    if (data.employeeEmail) {
      try {
        const token = randomBytes(64).toString("hex");
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
        await db.insert(caseAccessTokensTable).values({
          caseId: newCase.id,
          token,
          employeeEmail: data.employeeEmail,
          expiresAt,
        });

        const magicLinkUrl = `${getAppUrl()}/portal?token=${token}`;
        await sendMagicLinkEmail(data.employeeEmail, newCase.caseNumber, magicLinkUrl);
        logger.info({ caseId: newCase.id, to: data.employeeEmail }, "Confirmation/magic-link email sent");
      } catch (err) {
        logger.warn({ err, caseId: newCase.id }, "Magic link email failed — case still created");
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

  if (!isOrgAuthorized(authed.user.organizationId, detail.organizationId)) {
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

  if (!isOrgAuthorized(authed.user.organizationId, leaveCase.organizationId)) {
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

  const [updated] = await db
    .update(leaveCasesTable)
    .set({
      state: nextState,
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

  if (!isOrgAuthorized(authed.user.organizationId, leaveCase.organizationId)) {
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

  const [updated] = await db
    .update(leaveCasesTable)
    .set({ state: targetState, updatedAt: new Date() })
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

    if (!isOrgAuthorized(authed.user.organizationId, leaveCase.organizationId)) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    if (leaveCase.state !== "HR_REVIEW_QUEUE" && leaveCase.state !== "ELIGIBILITY_ANALYSIS") {
      res.status(400).json({
        error: `HR decisions can only be recorded when a case is in HR_REVIEW_QUEUE or ELIGIBILITY_ANALYSIS state. Current state: ${leaveCase.state}`,
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
    if (body.data.decisionType === "REQUEST_MORE_INFO") {
      nextState = "INTAKE";
    }

    const [updated] = await db
      .update(leaveCasesTable)
      .set({ state: nextState, updatedAt: new Date() })
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

    if (!isOrgAuthorized(authed.user.organizationId, leaveCase.organizationId)) {
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

      if (!isOrgAuthorized(authed.user.organizationId, leaveCase.organizationId)) {
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
      });

      await logAudit(
        leaveCase.id,
        "AI_RECOMMENDATION_GENERATED",
        authed.user.email,
      );

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

    if (!isOrgAuthorized(authed.user.organizationId, leaveCase.organizationId)) {
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

    // Find the medical certification notice so it can be attached to the eligibility notice email
    const medCertNotice = notices.find((n) => n.noticeType === "MEDICAL_CERTIFICATION");
    const medCertAttachment: EmailAttachment | undefined = medCertNotice
      ? {
          filename: `Medical_Certification_Form_${leaveCase.caseNumber}.txt`,
          content: Buffer.from(medCertNotice.content, "utf-8").toString("base64"),
        }
      : undefined;

    for (const notice of notices) {
      // Medical cert is attached to the eligibility notice — don't send as a standalone email
      if (notice.noticeType !== "MEDICAL_CERTIFICATION") {
        const emailAttachments: EmailAttachment[] = [];
        if (notice.noticeType === "ELIGIBILITY_NOTICE" && medCertAttachment) {
          emailAttachments.push(medCertAttachment);
        }

        await sendNoticeEmail({
          to: recipientEmail,
          noticeType: notice.noticeType,
          content: notice.content,
          caseNumber: leaveCase.caseNumber,
          employeeNumber: leaveCase.employeeNumber,
          attachments: emailAttachments.length > 0 ? emailAttachments : undefined,
        });

        const [entry] = await db
          .insert(auditLogTable)
          .values({
            entity: "leave_case",
            entityId: leaveCase.id,
            action: `NOTICE_SENT_${notice.noticeType}`,
            actor,
          })
          .returning();

        auditEntries.push(entry);
      }

      // Archive ALL notices (including med cert) as case documents
      try {
        const { uploadFile } = await import("../lib/storage.js");
        const noticeDate = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
        const noticeFileName = `${notice.noticeType.replace(/_/g, "_")}_${leaveCase.caseNumber}_${noticeDate}.txt`;
        const storageKey = `cases/${leaveCase.id}/notices/${randomBytes(8).toString("hex")}_${notice.noticeType}.txt`;
        const contentBuffer = Buffer.from(notice.content, "utf-8");
        await uploadFile(storageKey, contentBuffer, "text/plain");
        await db.insert(caseDocumentsTable).values({
          caseId: leaveCase.id,
          uploadedBy: "notice",
          fileName: noticeFileName,
          storageKey,
          mimeType: "text/plain",
          sizeBytes: contentBuffer.length,
        });
      } catch (docErr) {
        logger.warn({ docErr, noticeType: notice.noticeType, caseId: leaveCase.id }, "Failed to archive notice as case document");
      }
    }

    res.json({ sent: notices.length, auditEntries });
  },
);

// GET /cases/:caseId/documents (HR — requires auth)
router.get("/cases/:caseId/documents", requireAuth, async (req, res): Promise<void> => {
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

  if (!isOrgAuthorized(authed.user.organizationId, leaveCase.organizationId)) {
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

// GET /cases/:caseId/documents/:docId/download (HR — requires auth)
router.get(
  "/cases/:caseId/documents/:docId/download",
  requireAuth,
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

    if (!isOrgAuthorized(authed.user.organizationId, leaveCase.organizationId)) {
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

    const { getPresignedUrl } = await import("../lib/storage.js");
    const url = await getPresignedUrl(doc.storageKey, 3600);
    res.json({ url, fileName: doc.fileName });
  },
);

// DELETE /cases/:caseId  (admin only — soft delete with reason)
router.delete(
  "/cases/:caseId",
  requireAuth,
  async (req, res): Promise<void> => {
    const authed = req as AuthenticatedRequest;

    if (authed.user.role !== "admin") {
      res.status(403).json({ error: "Only admin users may delete cases." });
      return;
    }

    const caseId = req.params.caseId;
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

    if (!isOrgAuthorized(authed.user.organizationId ?? null, leaveCase.organizationId ?? null)) {
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

export default router;
