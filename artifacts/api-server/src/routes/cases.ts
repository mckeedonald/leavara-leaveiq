import { Router, type IRouter } from "express";
import { eq, desc, sql, and, ne, gte, isNull } from "drizzle-orm";
import { db, leaveCasesTable, hrDecisionsTable, auditLogTable, organizationsTable } from "@workspace/db";
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
import { sendNoticeEmail } from "../lib/email";

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

  res.status(201).json(newCase);
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

    const result = await generateAiRecommendation({
      caseNumber: leaveCase.caseNumber,
      employeeNumber: leaveCase.employeeNumber,
      employeeEmail: leaveCase.employeeEmail,
      leaveReasonCategory: leaveCase.leaveReasonCategory,
      requestedStart: leaveCase.requestedStart,
      requestedEnd: leaveCase.requestedEnd,
      intermittent: leaveCase.intermittent,
      analysisResult,
      organizationId: leaveCase.organizationId,
    });

    await logAudit(
      leaveCase.id,
      "AI_RECOMMENDATION_GENERATED",
      authed.user.email,
    );

    res.json(result);
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

    for (const notice of notices) {
      await sendNoticeEmail({
        to: recipientEmail,
        noticeType: notice.noticeType,
        content: notice.content,
        caseNumber: leaveCase.caseNumber,
        employeeNumber: leaveCase.employeeNumber,
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

    res.json({ sent: notices.length, auditEntries });
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
