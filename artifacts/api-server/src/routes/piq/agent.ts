import { Router, type Request, type Response } from "express";
import {
  db,
  piqAgentSessionsTable,
  piqAgentMessagesTable,
  employeesTable,
  usersTable,
  piqCasesTable,
  organizationsTable,
  piqDocumentTypesTable,
} from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requirePiqAuth, requireOrgId, type PiqAuthenticatedRequest } from "../../lib/piqJwtAuth.js";
import { runAgentTurn } from "../../lib/piqAgent.js";
import { logger } from "../../lib/logger.js";

const router = Router();

// POST /performiq/agent/sessions — start a new agent session
router.post("/performiq/agent/sessions", requirePiqAuth, async (req: Request, res: Response) => {
  try {
    const authed = req as PiqAuthenticatedRequest;
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const { employeeId, documentTypeId } = req.body as { employeeId?: string; documentTypeId?: string };

    let employeeInfo: {
      fullName: string;
      jobTitle: string;
      department: string;
      hireDate: string | null;
      managerName: string;
    } | undefined;

    if (employeeId) {
      const [emp] = await db
        .select()
        .from(employeesTable)
        .where(
          and(
            eq(employeesTable.id, employeeId),
            eq(employeesTable.organizationId, orgId),
          ),
        )
        .limit(1);

      if (emp) {
        let managerName = emp.managerName ?? "Unknown";
        if (emp.managerId && !managerName) {
          const [mgr] = await db
            .select({ fullName: employeesTable.fullName })
            .from(employeesTable)
            .where(eq(employeesTable.id, emp.managerId))
            .limit(1);
          if (mgr) managerName = mgr.fullName;
        }
        employeeInfo = {
          fullName: emp.fullName,
          jobTitle: emp.position ?? "",
          department: emp.department ?? "",
          hireDate: emp.startDate ?? null,
          managerName,
        };
      }
    }

    // Load org name
    let orgName: string | undefined;
    const [orgRow] = await db
      .select({ name: organizationsTable.name })
      .from(organizationsTable)
      .where(eq(organizationsTable.id, orgId))
      .limit(1);
    if (orgRow) orgName = orgRow.name;

    // Load prior PerformIQ cases for the employee
    let priorCases: string | undefined;
    if (employeeId) {
      const priorCaseRows = await db
        .select({
          caseNumber: piqCasesTable.caseNumber,
          status: piqCasesTable.status,
          createdAt: piqCasesTable.createdAt,
        })
        .from(piqCasesTable)
        .where(and(
          eq(piqCasesTable.employeeId, employeeId),
          eq(piqCasesTable.organizationId, orgId),
        ))
        .orderBy(desc(piqCasesTable.createdAt))
        .limit(10);
      if (priorCaseRows.length > 0) {
        priorCases = priorCaseRows
          .map((c: { caseNumber: string; status: string; createdAt: Date }) => `- Case ${c.caseNumber} (${new Date(c.createdAt).toLocaleDateString("en-US")}): ${c.status}`)
          .join("\n");
      }
    }

    // Load example PDF for the document type if provided
    let examplePdfContent: string | undefined;
    let documentTypeLabel: string | undefined;
    if (documentTypeId) {
      const [docType] = await db
        .select({ examplePdfContent: piqDocumentTypesTable.examplePdfContent, displayLabel: piqDocumentTypesTable.displayLabel })
        .from(piqDocumentTypesTable)
        .where(and(
          eq(piqDocumentTypesTable.id, documentTypeId),
          eq(piqDocumentTypesTable.organizationId, orgId),
        ))
        .limit(1);
      if (docType?.examplePdfContent) examplePdfContent = docType.examplePdfContent;
      if (docType?.displayLabel) documentTypeLabel = docType.displayLabel;
    }

    const [session] = await db
      .insert(piqAgentSessionsTable)
      .values({
        organizationId: orgId,
        initiatedBy: authed.piqUser.sub,
        status: "active",
      })
      .returning();

    // Fire the __INIT__ turn so the agent opens with its greeting
    const { text: greeting } = await runAgentTurn({
      sessionId: session.id,
      organizationId: orgId ?? "",
      userMessage: "__INIT__",
      isInit: true,
      userRole: authed.piqUser.role,
      employeeInfo,
      orgName,
      priorCases,
      examplePdfContent,
      documentTypeLabel,
    });

    res.status(201).json({ sessionId: session.id, employeeInfo, greeting });
  } catch (err) {
    logger.error({ err }, "PIQ agent session create error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /performiq/agent/sessions/:sessionId/messages
router.get("/performiq/agent/sessions/:sessionId/messages", requirePiqAuth, async (req: Request, res: Response) => {
  try {
    const authed = req as PiqAuthenticatedRequest;
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const { sessionId } = req.params;

    const [session] = await db
      .select()
      .from(piqAgentSessionsTable)
      .where(
        and(
          eq(piqAgentSessionsTable.id, sessionId),
          eq(piqAgentSessionsTable.organizationId, orgId),
        ),
      )
      .limit(1);

    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    const messages = await db
      .select()
      .from(piqAgentMessagesTable)
      .where(eq(piqAgentMessagesTable.sessionId, sessionId))
      .orderBy(piqAgentMessagesTable.createdAt);

    res.json({ session, messages });
  } catch (err) {
    logger.error({ err }, "PIQ agent messages get error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /performiq/agent/sessions/:sessionId/message — stream a turn
router.post(
  "/performiq/agent/sessions/:sessionId/message",
  requirePiqAuth,
  async (req: Request, res: Response) => {
    const authed = req as PiqAuthenticatedRequest;
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const sessionId = String(req.params["sessionId"]);
    const { message, employeeInfo } = req.body as {
      message?: string;
      employeeInfo?: {
        fullName: string;
        jobTitle: string;
        department: string;
        hireDate: string | null;
        managerName: string;
      };
      isInit?: boolean;
    };

    if (!message?.trim()) {
      res.status(400).json({ error: "message is required" });
      return;
    }

    const [session] = await db
      .select()
      .from(piqAgentSessionsTable)
      .where(
        and(
          eq(piqAgentSessionsTable.id, sessionId),
          eq(piqAgentSessionsTable.organizationId, orgId),
        ),
      )
      .limit(1);

    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    // Load org name
    let orgName: string | undefined;
    const [orgRow] = await db
      .select({ name: organizationsTable.name })
      .from(organizationsTable)
      .where(eq(organizationsTable.id, orgId))
      .limit(1);
    if (orgRow) orgName = orgRow.name;

    // Load prior cases for employee if we have employeeInfo
    let priorCases: string | undefined;
    if (employeeInfo) {
      // Look up employee by name within the org to get ID for prior case lookup
      const [empRow] = await db
        .select({ id: employeesTable.id })
        .from(employeesTable)
        .where(and(
          eq(employeesTable.fullName, employeeInfo.fullName),
          eq(employeesTable.organizationId, orgId),
        ))
        .limit(1);
      if (empRow) {
        const priorCaseRows = await db
          .select({
            caseNumber: piqCasesTable.caseNumber,
            status: piqCasesTable.status,
            createdAt: piqCasesTable.createdAt,
          })
          .from(piqCasesTable)
          .where(and(
            eq(piqCasesTable.employeeId, empRow.id),
            eq(piqCasesTable.organizationId, orgId),
          ))
          .orderBy(desc(piqCasesTable.createdAt))
          .limit(10);
        if (priorCaseRows.length > 0) {
          priorCases = priorCaseRows
            .map((c: { caseNumber: string; status: string; createdAt: Date }) => `- Case ${c.caseNumber} (${new Date(c.createdAt).toLocaleDateString("en-US")}): ${c.status}`)
            .join("\n");
        }
      }
    }

    // Stream SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    try {
      const { text, draft } = await runAgentTurn({
        sessionId,
        organizationId: orgId ?? "",
        userMessage: message.trim(),
        userRole: authed.piqUser.role,
        employeeInfo: employeeInfo ?? undefined,
        orgName,
        priorCases,
        onChunk: (chunk) => {
          res.write(`data: ${JSON.stringify({ type: "chunk", text: chunk })}\n\n`);
        },
      });

      if (draft) {
        res.write(`data: ${JSON.stringify({ type: "draft", draft })}\n\n`);
      }
      res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
      res.end();
    } catch (err) {
      logger.error({ err }, "PIQ agent turn error");
      res.write(`data: ${JSON.stringify({ type: "error", message: "Agent error" })}\n\n`);
      res.end();
    }
  },
);

// DELETE /performiq/agent/sessions/:sessionId  (abandon)
router.delete("/performiq/agent/sessions/:sessionId", requirePiqAuth, async (req: Request, res: Response) => {
  try {
    const authed = req as PiqAuthenticatedRequest;
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const { sessionId } = req.params;

    await db
      .update(piqAgentSessionsTable)
      .set({ status: "abandoned", updatedAt: new Date() })
      .where(
        and(
          eq(piqAgentSessionsTable.id, sessionId),
          eq(piqAgentSessionsTable.organizationId, orgId),
        ),
      );

    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "PIQ agent session delete error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
