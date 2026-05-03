import { Router, type Request, type Response } from "express";
import {
  db,
  piqCasesTable,
  piqDocumentsTable,
  piqDocumentTypesTable,
  employeesTable,
  usersTable,
  piqWorkflowStepsTable,
  piqDocumentHistoryTable,
  piqAgentSessionsTable,
} from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requirePiqAuth, type PiqAuthenticatedRequest } from "../../lib/piqJwtAuth.js";
import { logger } from "../../lib/logger.js";
import type { PiqCaseStatus, PiqDocumentContent, InsertPiqWorkflowStep } from "@workspace/db";

const router = Router();

/** Generate a sequential case number like PIQ-20250001 */
async function generateCaseNumber(orgId: string): Promise<string> {
  const year = new Date().getFullYear();
  const existing = await db
    .select({ caseNumber: piqCasesTable.caseNumber })
    .from(piqCasesTable)
    .where(eq(piqCasesTable.organizationId, orgId));
  const yearCases = existing.filter((c) => c.caseNumber.startsWith(`PIQ-${year}`));
  const seq = String(yearCases.length + 1).padStart(4, "0");
  return `PIQ-${year}${seq}`;
}

/** Build the initial workflow steps for a document type.
 *  HR admins and HR users are the approvers, so their cases skip review/approval
 *  and go straight from draft to delivery. */
function buildWorkflowSteps(
  caseId: string,
  orgId: string,
  docType: { requiresSupervisorReview: boolean; supervisorReviewRequired: boolean; requiresHrApproval: boolean },
  assigneeId: string,
  initiatorRole?: string,
): InsertPiqWorkflowStep[] {
  const steps: InsertPiqWorkflowStep[] = [];
  let order = 1;

  const isHr = initiatorRole === "hr_admin" || initiatorRole === "hr_user";

  steps.push({ caseId, organizationId: orgId, stepType: "draft", stepOrder: order++, status: "in_progress", assignedTo: assigneeId, assignedBy: assigneeId });

  // HR initiators skip review and approval — they ARE the approvers
  if (!isHr) {
    if (docType.requiresSupervisorReview) {
      steps.push({ caseId, organizationId: orgId, stepType: "supervisor_review", stepOrder: order++, status: "pending" });
    }
    if (docType.requiresHrApproval) {
      steps.push({ caseId, organizationId: orgId, stepType: "hr_approval", stepOrder: order++, status: "pending" });
    }
  }

  steps.push({ caseId, organizationId: orgId, stepType: "delivery", stepOrder: order++, status: "pending" });

  return steps;
}

// GET /performiq/cases
router.get("/performiq/cases", requirePiqAuth, async (req: Request, res: Response) => {
  try {
    const authed = req as PiqAuthenticatedRequest;
    const { status, employeeId } = req.query as { status?: string; employeeId?: string };

    const cases = await db
      .select({
        id: piqCasesTable.id,
        caseNumber: piqCasesTable.caseNumber,
        status: piqCasesTable.status,
        employeeId: piqCasesTable.employeeId,
        employeeName: employeesTable.fullName,
        employeeDept: employeesTable.department,
        documentTypeId: piqCasesTable.documentTypeId,
        docTypeLabel: piqDocumentTypesTable.displayLabel,
        docBaseType: piqDocumentTypesTable.baseType,
        initiatedBy: piqCasesTable.initiatedBy,
        initiatorName: usersTable.fullName,
        currentAssigneeId: piqCasesTable.currentAssigneeId,
        createdAt: piqCasesTable.createdAt,
        updatedAt: piqCasesTable.updatedAt,
      })
      .from(piqCasesTable)
      .leftJoin(employeesTable, eq(piqCasesTable.employeeId, employeesTable.id))
      .leftJoin(piqDocumentTypesTable, eq(piqCasesTable.documentTypeId, piqDocumentTypesTable.id))
      .leftJoin(usersTable, eq(piqCasesTable.initiatedBy, usersTable.id))
      .where(eq(piqCasesTable.organizationId, authed.piqUser.organizationId))
      .orderBy(desc(piqCasesTable.updatedAt));

    let filtered = cases;

    const { role, sub } = authed.piqUser;
    if (role === "manager") {
      filtered = filtered.filter((c) => c.initiatedBy === sub);
    }

    if (status) filtered = filtered.filter((c) => c.status === status);
    if (employeeId) filtered = filtered.filter((c) => c.employeeId === employeeId);

    res.json(filtered);
  } catch (err) {
    logger.error({ err }, "PIQ cases list error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /performiq/cases/:caseId
router.get("/performiq/cases/:caseId", requirePiqAuth, async (req: Request, res: Response) => {
  try {
    const authed = req as PiqAuthenticatedRequest;
    const { caseId } = req.params;

    const [c] = await db
      .select()
      .from(piqCasesTable)
      .where(and(eq(piqCasesTable.id, caseId), eq(piqCasesTable.organizationId, authed.piqUser.organizationId)))
      .limit(1);

    if (!c) {
      res.status(404).json({ error: "Case not found" });
      return;
    }

    const [employee] = await db.select().from(employeesTable).where(eq(employeesTable.id, c.employeeId)).limit(1);
    const [docType] = await db.select().from(piqDocumentTypesTable).where(eq(piqDocumentTypesTable.id, c.documentTypeId)).limit(1);

    const [currentDoc] = await db
      .select()
      .from(piqDocumentsTable)
      .where(and(eq(piqDocumentsTable.caseId, caseId), eq(piqDocumentsTable.isCurrent, true)))
      .limit(1);

    const workflowSteps = await db
      .select()
      .from(piqWorkflowStepsTable)
      .where(eq(piqWorkflowStepsTable.caseId, caseId))
      .orderBy(piqWorkflowStepsTable.stepOrder);

    const history = await db
      .select({
        id: piqDocumentHistoryTable.id,
        action: piqDocumentHistoryTable.action,
        performedByRole: piqDocumentHistoryTable.performedByRole,
        notes: piqDocumentHistoryTable.notes,
        createdAt: piqDocumentHistoryTable.createdAt,
        performedById: piqDocumentHistoryTable.performedBy,
        actorName: usersTable.fullName,
      })
      .from(piqDocumentHistoryTable)
      .leftJoin(usersTable, eq(piqDocumentHistoryTable.performedBy, usersTable.id))
      .where(eq(piqDocumentHistoryTable.caseId, caseId))
      .orderBy(desc(piqDocumentHistoryTable.createdAt));

    res.json({ case: c, employee, docType, currentDocument: currentDoc ?? null, workflowSteps, history });
  } catch (err) {
    logger.error({ err }, "PIQ case get error");
    res.status(500).json({ error: "Internal server error" });
  }
});

/* Default doc-type config keyed by base type */
const DOC_TYPE_DEFAULTS: Record<string, { label: string; supervisorReview: boolean; hrApproval: boolean }> = {
  coaching:            { label: "Coaching Session",            supervisorReview: false, hrApproval: true  },
  written_warning:     { label: "Written Warning",             supervisorReview: true,  hrApproval: true  },
  final_warning:       { label: "Final Warning",               supervisorReview: true,  hrApproval: true  },
  performance_review:  { label: "Performance Review",          supervisorReview: true,  hrApproval: true  },
  goal_setting:        { label: "Goal Setting",                supervisorReview: false, hrApproval: true  },
  termination_request: { label: "Termination Documentation",   supervisorReview: true,  hrApproval: true  },
};

// POST /performiq/cases — create a new case
router.post("/performiq/cases", requirePiqAuth, async (req: Request, res: Response) => {
  try {
    const authed = req as PiqAuthenticatedRequest;
    const { employeeId, documentTypeId, docBaseType, agentSessionId, initialDraft } = req.body as {
      employeeId?: string;
      documentTypeId?: string;
      docBaseType?: string;
      agentSessionId?: string;
      initialDraft?: PiqDocumentContent;
    };

    if (!employeeId) {
      res.status(400).json({ error: "employeeId is required" });
      return;
    }

    const [employee] = await db
      .select()
      .from(employeesTable)
      .where(and(eq(employeesTable.id, employeeId), eq(employeesTable.organizationId, authed.piqUser.organizationId)))
      .limit(1);
    if (!employee) {
      res.status(400).json({ error: "Employee not found" });
      return;
    }

    // Resolve doc type: explicit ID → match by base type → auto-create default
    let resolvedDocTypeId = documentTypeId;
    if (!resolvedDocTypeId && docBaseType) {
      const [existing] = await db
        .select()
        .from(piqDocumentTypesTable)
        .where(and(
          eq(piqDocumentTypesTable.organizationId, authed.piqUser.organizationId),
          eq(piqDocumentTypesTable.baseType, docBaseType as any),
          eq(piqDocumentTypesTable.isActive, true),
        ))
        .limit(1);

      if (existing) {
        resolvedDocTypeId = existing.id;
      } else {
        // Auto-create a default doc type for this base type
        const defaults = DOC_TYPE_DEFAULTS[docBaseType] ?? { label: docBaseType, supervisorReview: true, hrApproval: true };
        const [created] = await db
          .insert(piqDocumentTypesTable)
          .values({
            organizationId: authed.piqUser.organizationId,
            baseType: docBaseType as any,
            displayLabel: defaults.label,
            requiresSupervisorReview: defaults.supervisorReview,
            supervisorReviewRequired: defaults.supervisorReview,
            requiresHrApproval: defaults.hrApproval,
            isActive: true,
          })
          .returning();
        resolvedDocTypeId = created.id;
      }
    }

    if (!resolvedDocTypeId) {
      res.status(400).json({ error: "documentTypeId or docBaseType is required" });
      return;
    }

    const [docType] = await db
      .select()
      .from(piqDocumentTypesTable)
      .where(eq(piqDocumentTypesTable.id, resolvedDocTypeId))
      .limit(1);
    if (!docType) {
      res.status(400).json({ error: "Document type not found" });
      return;
    }

    const documentTypeId_resolved = resolvedDocTypeId;

    const caseNumber = await generateCaseNumber(authed.piqUser.organizationId);

    const [newCase] = await db
      .insert(piqCasesTable)
      .values({
        organizationId: authed.piqUser.organizationId,
        caseNumber,
        employeeId,
        initiatedBy: authed.piqUser.sub,
        documentTypeId: resolvedDocTypeId,
        status: "draft",
        currentAssigneeId: authed.piqUser.sub,
        agentSessionId: agentSessionId ?? null,
      })
      .returning();

    if (initialDraft) {
      const [insertedDoc] = await db.insert(piqDocumentsTable).values({
        caseId: newCase.id,
        organizationId: authed.piqUser.organizationId,
        version: 1,
        content: initialDraft,
        createdBy: authed.piqUser.sub,
        isCurrent: true,
      }).returning();

      // History insert is non-fatal — the FK was previously on piqUsersTable (old auth);
      // after schema push it will reference usersTable. Skip silently if it fails.
      try {
        await db.insert(piqDocumentHistoryTable).values({
          documentId: insertedDoc.id,
          caseId: newCase.id,
          organizationId: authed.piqUser.organizationId,
          action: "created",
          performedBy: authed.piqUser.sub,
          performedByRole: authed.piqUser.role,
        });
      } catch (histErr) {
        logger.warn({ histErr, caseId: newCase.id }, "Could not insert document history — FK may need schema push");
      }
    }

    const steps = buildWorkflowSteps(newCase.id, authed.piqUser.organizationId, docType, authed.piqUser.sub, authed.piqUser.role);
    if (steps.length > 0) {
      await db.insert(piqWorkflowStepsTable).values(steps);
    }

    res.status(201).json(newCase);
  } catch (err) {
    logger.error({ err }, "PIQ case create error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /performiq/cases/:caseId/document — save/update document content
router.patch("/performiq/cases/:caseId/document", requirePiqAuth, async (req: Request, res: Response) => {
  try {
    const authed = req as PiqAuthenticatedRequest;
    const { caseId } = req.params;
    const { content } = req.body as { content?: PiqDocumentContent };

    if (!content) {
      res.status(400).json({ error: "content is required" });
      return;
    }

    const [c] = await db
      .select()
      .from(piqCasesTable)
      .where(and(eq(piqCasesTable.id, caseId), eq(piqCasesTable.organizationId, authed.piqUser.organizationId)))
      .limit(1);

    if (!c) {
      res.status(404).json({ error: "Case not found" });
      return;
    }

    const { role } = authed.piqUser;
    const allowedStatuses: PiqCaseStatus[] = ["draft", "manager_revision"];
    if (!allowedStatuses.includes(c.status) && !["hr_user", "hr_admin"].includes(role)) {
      res.status(403).json({ error: "Document cannot be edited in the current workflow state" });
      return;
    }

    await db
      .update(piqDocumentsTable)
      .set({ isCurrent: false })
      .where(and(eq(piqDocumentsTable.caseId, caseId), eq(piqDocumentsTable.isCurrent, true)));

    const existing = await db.select({ version: piqDocumentsTable.version }).from(piqDocumentsTable).where(eq(piqDocumentsTable.caseId, caseId));
    const nextVersion = existing.length > 0 ? Math.max(...existing.map((d) => d.version)) + 1 : 1;

    const [newDoc] = await db
      .insert(piqDocumentsTable)
      .values({
        caseId,
        organizationId: authed.piqUser.organizationId,
        version: nextVersion,
        content,
        createdBy: authed.piqUser.sub,
        isCurrent: true,
      })
      .returning();

    await db.insert(piqDocumentHistoryTable).values({
      documentId: newDoc.id,
      caseId,
      organizationId: authed.piqUser.organizationId,
      action: "edited",
      performedBy: authed.piqUser.sub,
      performedByRole: authed.piqUser.role,
    });

    res.json(newDoc);
  } catch (err) {
    logger.error({ err }, "PIQ document update error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
