import { Router, type Request, type Response } from "express";
import { eq, and, asc } from "drizzle-orm";
import {
  db,
  caseMessagesTable,
  leaveCasesTable,
  adaCasesTable,
  caseAccessTokensTable,
} from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../lib/jwtAuth";
import { requirePiqAuth, type PiqAuthenticatedRequest } from "../lib/piqJwtAuth.js";
import { logger } from "../lib/logger.js";

const router = Router();

// ── LeaveIQ Case Messages ────────────────────────────────────────────────────

// GET /api/cases/:caseId/messages  (HR auth)
router.get("/cases/:caseId/messages", requireAuth, async (req: Request, res: Response) => {
  try {
    const authed = req as AuthenticatedRequest;
    const { caseId } = req.params;

    // Verify the case belongs to this org (check leave cases first, then ADA cases)
    const [leaveCase] = await db
      .select({ id: leaveCasesTable.id })
      .from(leaveCasesTable)
      .where(and(eq(leaveCasesTable.id, caseId), eq(leaveCasesTable.organizationId, authed.user.organizationId)))
      .limit(1);

    if (!leaveCase) {
      const [adaCase] = await db
        .select({ id: adaCasesTable.id })
        .from(adaCasesTable)
        .where(and(eq(adaCasesTable.id, caseId), eq(adaCasesTable.organizationId, authed.user.organizationId)))
        .limit(1);
      if (!adaCase) {
        res.status(404).json({ error: "Case not found" });
        return;
      }
    }

    const msgs = await db
      .select()
      .from(caseMessagesTable)
      .where(and(eq(caseMessagesTable.caseId, caseId), eq(caseMessagesTable.product, "leaveiq")))
      .orderBy(asc(caseMessagesTable.createdAt));

    res.json(msgs);
  } catch (err) {
    logger.error({ err }, "case messages list error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/cases/:caseId/messages  (HR auth)
router.post("/cases/:caseId/messages", requireAuth, async (req: Request, res: Response) => {
  try {
    const authed = req as AuthenticatedRequest;
    const { caseId } = req.params;
    const { content } = req.body as { content?: string };

    if (!content?.trim()) {
      res.status(400).json({ error: "content is required" });
      return;
    }

    // Verify case belongs to this org (check leave cases first, then ADA cases)
    const [leaveCase] = await db
      .select({ id: leaveCasesTable.id })
      .from(leaveCasesTable)
      .where(and(eq(leaveCasesTable.id, caseId), eq(leaveCasesTable.organizationId, authed.user.organizationId)))
      .limit(1);

    if (!leaveCase) {
      const [adaCase] = await db
        .select({ id: adaCasesTable.id })
        .from(adaCasesTable)
        .where(and(eq(adaCasesTable.id, caseId), eq(adaCasesTable.organizationId, authed.user.organizationId)))
        .limit(1);
      if (!adaCase) {
        res.status(404).json({ error: "Case not found" });
        return;
      }
    }

    const [msg] = await db
      .insert(caseMessagesTable)
      .values({
        product: "leaveiq",
        caseId,
        organizationId: authed.user.organizationId,
        senderType: "hr",
        senderId: authed.user.id,
        senderName: authed.user.fullName ?? authed.user.email,
        content: content.trim(),
      })
      .returning();

    res.status(201).json(msg);
  } catch (err) {
    logger.error({ err }, "case message create error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/portal/cases/:caseId/messages  (employee access token)
router.get("/portal/cases/:caseId/messages", async (req: Request, res: Response) => {
  try {
    const token = req.query.token as string;
    if (!token) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const [access] = await db
      .select()
      .from(caseAccessTokensTable)
      .where(eq(caseAccessTokensTable.token, token))
      .limit(1);

    if (!access || access.caseId !== req.params.caseId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const msgs = await db
      .select()
      .from(caseMessagesTable)
      .where(and(eq(caseMessagesTable.caseId, req.params.caseId), eq(caseMessagesTable.product, "leaveiq")))
      .orderBy(asc(caseMessagesTable.createdAt));

    res.json(msgs);
  } catch (err) {
    logger.error({ err }, "portal messages list error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/portal/cases/:caseId/messages  (employee access token)
router.post("/portal/cases/:caseId/messages", async (req: Request, res: Response) => {
  try {
    const { token, content, senderName } = req.body as {
      token?: string;
      content?: string;
      senderName?: string;
    };

    if (!token || !content?.trim()) {
      res.status(400).json({ error: "token and content are required" });
      return;
    }

    const [access] = await db
      .select()
      .from(caseAccessTokensTable)
      .where(eq(caseAccessTokensTable.token, token))
      .limit(1);

    if (!access || access.caseId !== req.params.caseId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const [leaveCase] = await db
      .select({ organizationId: leaveCasesTable.organizationId, employeeFirstName: leaveCasesTable.employeeFirstName, employeeLastName: leaveCasesTable.employeeLastName })
      .from(leaveCasesTable)
      .where(eq(leaveCasesTable.id, access.caseId))
      .limit(1);

    if (!leaveCase) {
      res.status(404).json({ error: "Case not found" });
      return;
    }

    const empName = senderName?.trim()
      || [leaveCase.employeeFirstName, leaveCase.employeeLastName].filter(Boolean).join(" ")
      || "Employee";

    const [msg] = await db
      .insert(caseMessagesTable)
      .values({
        product: "leaveiq",
        caseId: access.caseId,
        organizationId: leaveCase.organizationId!,
        senderType: "employee",
        senderId: null,
        senderName: empName,
        content: content.trim(),
      })
      .returning();

    res.status(201).json(msg);
  } catch (err) {
    logger.error({ err }, "portal message create error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── PerformIQ Case Messages ──────────────────────────────────────────────────

// GET /api/performiq/cases/:caseId/messages  (PIQ auth)
router.get("/performiq/cases/:caseId/messages", requirePiqAuth, async (req: Request, res: Response) => {
  try {
    const authed = req as PiqAuthenticatedRequest;
    const { caseId } = req.params;

    const msgs = await db
      .select()
      .from(caseMessagesTable)
      .where(
        and(
          eq(caseMessagesTable.caseId, caseId),
          eq(caseMessagesTable.product, "performiq"),
          eq(caseMessagesTable.organizationId, authed.piqUser.organizationId),
        )
      )
      .orderBy(asc(caseMessagesTable.createdAt));

    res.json(msgs);
  } catch (err) {
    logger.error({ err }, "PIQ case messages list error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/performiq/cases/:caseId/messages  (PIQ auth)
router.post("/performiq/cases/:caseId/messages", requirePiqAuth, async (req: Request, res: Response) => {
  try {
    const authed = req as PiqAuthenticatedRequest;
    const { caseId } = req.params;
    const { content } = req.body as { content?: string };

    if (!content?.trim()) {
      res.status(400).json({ error: "content is required" });
      return;
    }

    const [msg] = await db
      .insert(caseMessagesTable)
      .values({
        product: "performiq",
        caseId,
        organizationId: authed.piqUser.organizationId,
        senderType: "hr",
        senderId: authed.piqUser.id,
        senderName: authed.piqUser.fullName ?? authed.piqUser.email,
        content: content.trim(),
      })
      .returning();

    res.status(201).json(msg);
  } catch (err) {
    logger.error({ err }, "PIQ case message create error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
