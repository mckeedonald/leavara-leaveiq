import { Router, type IRouter } from "express";
import { eq, and, isNull } from "drizzle-orm";
import { db, leaveCasesTable, caseNoticesTable, auditLogTable } from "@workspace/db";
import { requireAuth, requireAdmin, type AuthenticatedRequest } from "../lib/jwtAuth";
import { generateAiRecommendation } from "../lib/aiAgent";
import { sendNoticeEmail } from "../lib/email";
import { encrypt, decrypt } from "../lib/crypto";
import { aiLimiter } from "../lib/rateLimiters";

const router: IRouter = Router();

async function logAudit(entityId: string, action: string, actor: string): Promise<void> {
  await db.insert(auditLogTable).values({ entity: "leave_case", entityId, action, actor });
}

function decryptNotice<T extends { draftContent: string; editedContent: string | null }>(notice: T): T {
  return {
    ...notice,
    draftContent: decrypt(notice.draftContent),
    editedContent: notice.editedContent ? decrypt(notice.editedContent) : null,
  };
}

// POST /cases/:caseId/ai-recommend
// Admin-only: Generates (or regenerates) AI recommendation + notice drafts for a case
router.post("/cases/:caseId/ai-recommend", requireAdmin, aiLimiter, async (req, res): Promise<void> => {
  const authed = req as AuthenticatedRequest;
  const { caseId } = req.params;

  const [leaveCase] = await db
    .select()
    .from(leaveCasesTable)
    .where(eq(leaveCasesTable.id, caseId));

  if (!leaveCase) {
    res.status(404).json({ error: "Case not found" });
    return;
  }

  if (!authed.user.isSuperAdmin && leaveCase.organizationId !== authed.user.organizationId) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  if (!leaveCase.analysisResult) {
    res.status(400).json({ error: "Case must be analyzed before generating a recommendation" });
    return;
  }

  const analysis = leaveCase.analysisResult as Parameters<typeof generateAiRecommendation>[0]["analysisResult"];

  try {
    const result = await generateAiRecommendation({
      caseNumber: leaveCase.caseNumber,
      employeeNumber: leaveCase.employeeNumber,
      employeeEmail: leaveCase.employeeEmail,
      leaveReasonCategory: leaveCase.leaveReasonCategory,
      requestedStart: leaveCase.requestedStart,
      requestedEnd: leaveCase.requestedEnd,
      intermittent: leaveCase.intermittent,
      analysisResult: analysis,
      organizationId: leaveCase.organizationId,
    });

    await db
      .update(leaveCasesTable)
      .set({
        aiRecommendation: result.recommendation as unknown as Record<string, unknown>,
        updatedAt: new Date(),
      })
      .where(eq(leaveCasesTable.id, caseId));

    await db
      .delete(caseNoticesTable)
      .where(
        and(
          eq(caseNoticesTable.leaveCaseId, caseId),
          isNull(caseNoticesTable.sentAt),
        ),
      );

    const rawNotices = await db
      .insert(caseNoticesTable)
      .values(
        result.notices.map((n) => ({
          leaveCaseId: caseId,
          noticeType: n.noticeType,
          subject: n.subject,
          draftContent: encrypt(n.content),
        })),
      )
      .returning();

    await logAudit(caseId, "AI_RECOMMENDATION_GENERATED", authed.user.email);

    res.json({
      recommendation: result.recommendation,
      notices: rawNotices.map(decryptNotice),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI generation failed";
    res.status(500).json({ error: message });
  }
});

// GET /cases/:caseId/notices
router.get("/cases/:caseId/notices", requireAuth, async (req, res): Promise<void> => {
  const authed = req as AuthenticatedRequest;
  const { caseId } = req.params;

  const [leaveCase] = await db
    .select({ organizationId: leaveCasesTable.organizationId })
    .from(leaveCasesTable)
    .where(eq(leaveCasesTable.id, caseId));

  if (!leaveCase) {
    res.status(404).json({ error: "Case not found" });
    return;
  }

  if (!authed.user.isSuperAdmin && leaveCase.organizationId !== authed.user.organizationId) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const notices = await db
    .select()
    .from(caseNoticesTable)
    .where(eq(caseNoticesTable.leaveCaseId, caseId))
    .orderBy(caseNoticesTable.createdAt);

  res.json({ notices: notices.map(decryptNotice) });
});

// PATCH /cases/:caseId/notices/:noticeId — Admin only (edit notice before sending)
router.patch("/cases/:caseId/notices/:noticeId", requireAdmin, async (req, res): Promise<void> => {
  const authed = req as AuthenticatedRequest;
  const { caseId, noticeId } = req.params;

  const { editedContent } = req.body as { editedContent?: unknown };
  if (typeof editedContent !== "string" || editedContent.trim().length === 0) {
    res.status(400).json({ error: "editedContent must be a non-empty string" });
    return;
  }

  const [existing] = await db
    .select({ leaveCaseId: caseNoticesTable.leaveCaseId })
    .from(caseNoticesTable)
    .where(and(eq(caseNoticesTable.id, noticeId), eq(caseNoticesTable.leaveCaseId, caseId)));

  if (!existing) {
    res.status(404).json({ error: "Notice not found" });
    return;
  }

  const [leaveCase] = await db
    .select({ organizationId: leaveCasesTable.organizationId })
    .from(leaveCasesTable)
    .where(eq(leaveCasesTable.id, caseId));

  if (!authed.user.isSuperAdmin && leaveCase?.organizationId !== authed.user.organizationId) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const [updated] = await db
    .update(caseNoticesTable)
    .set({ editedContent: encrypt(editedContent), updatedAt: new Date() })
    .where(eq(caseNoticesTable.id, noticeId))
    .returning();

  res.json({ notice: decryptNotice(updated) });
});

// POST /cases/:caseId/notices/:noticeId/send — Admin only
router.post("/cases/:caseId/notices/:noticeId/send", requireAdmin, async (req, res): Promise<void> => {
  const authed = req as AuthenticatedRequest;
  const { caseId, noticeId } = req.params;

  const [notice] = await db
    .select()
    .from(caseNoticesTable)
    .where(and(eq(caseNoticesTable.id, noticeId), eq(caseNoticesTable.leaveCaseId, caseId)));

  if (!notice) {
    res.status(404).json({ error: "Notice not found" });
    return;
  }

  if (notice.sentAt) {
    res.status(400).json({ error: "Notice has already been sent" });
    return;
  }

  const [leaveCase] = await db
    .select()
    .from(leaveCasesTable)
    .where(eq(leaveCasesTable.id, caseId));

  if (!authed.user.isSuperAdmin && leaveCase?.organizationId !== authed.user.organizationId) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  if (!leaveCase?.employeeEmail) {
    res.status(400).json({ error: "No employee email address on file for this case" });
    return;
  }

  const content = decrypt(notice.editedContent ?? notice.draftContent);

  await sendNoticeEmail({
    to: leaveCase.employeeEmail,
    subject: notice.subject,
    caseNumber: leaveCase.caseNumber,
    noticeType: notice.noticeType,
    content,
  });

  const [updated] = await db
    .update(caseNoticesTable)
    .set({ sentAt: new Date(), sentBy: authed.user.email, updatedAt: new Date() })
    .where(eq(caseNoticesTable.id, noticeId))
    .returning();

  await logAudit(caseId, `NOTICE_SENT_${notice.noticeType}`, authed.user.email);

  res.json({ notice: decryptNotice(updated) });
});

export default router;
