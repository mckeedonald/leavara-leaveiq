import { Router, type Request, type Response } from "express";
import {
  db,
  piqCasesTable,
  piqWorkflowStepsTable,
  piqDocumentHistoryTable,
  piqDocumentsTable,
  piqUsersTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requirePiqAuth, type PiqAuthenticatedRequest } from "../../lib/piqJwtAuth.js";
import { logger } from "../../lib/logger.js";
import type { PiqCaseStatus } from "@workspace/db";

const router = Router();

type WorkflowAction =
  | "submit_for_review"       // manager → supervisor_review
  | "supervisor_approve"      // supervisor → hr_approval or delivery
  | "supervisor_return"       // supervisor → manager_revision
  | "hr_approve"              // hr → delivery
  | "hr_return"               // hr → manager_revision
  | "manager_accept_changes"  // manager accepts supervisor/hr edits → advance
  | "deliver"                 // manager → closed (with signature record)
  | "reassign";               // reassign current step to different user

// POST /performiq/cases/:caseId/workflow/:action
router.post("/performiq/cases/:caseId/workflow/:action", requirePiqAuth, async (req: Request, res: Response) => {
  try {
    const authed = req as PiqAuthenticatedRequest;
    const { caseId, action } = req.params as { caseId: string; action: WorkflowAction };
    const { feedback, assigneeId, reassignReason } = req.body as {
      feedback?: string;
      assigneeId?: string;
      reassignReason?: string;
    };

    const [c] = await db
      .select()
      .from(piqCasesTable)
      .where(and(eq(piqCasesTable.id, caseId), eq(piqCasesTable.organizationId, authed.piqUser.organizationId)))
      .limit(1);

    if (!c) {
      res.status(404).json({ error: "Case not found" });
      return;
    }

    const steps = await db
      .select()
      .from(piqWorkflowStepsTable)
      .where(eq(piqWorkflowStepsTable.caseId, caseId))
      .orderBy(piqWorkflowStepsTable.stepOrder);

    const currentStep = steps.find((s) => s.status === "in_progress");

    const { role, sub } = authed.piqUser;
    const now = new Date();

    // Get the current document for history tracking
    const [currentDoc] = await db
      .select({ id: piqDocumentsTable.id })
      .from(piqDocumentsTable)
      .where(and(eq(piqDocumentsTable.caseId, caseId), eq(piqDocumentsTable.isCurrent, true)))
      .limit(1);

    async function advanceToNextStep(newCaseStatus: PiqCaseStatus, nextStepType?: string) {
      // Complete current step
      if (currentStep) {
        await db
          .update(piqWorkflowStepsTable)
          .set({ status: "completed", completedBy: sub, completedAt: now, feedback: feedback ?? null, updatedAt: now })
          .where(eq(piqWorkflowStepsTable.id, currentStep.id));
      }

      // Update case status
      await db
        .update(piqCasesTable)
        .set({ status: newCaseStatus, updatedAt: now })
        .where(eq(piqCasesTable.id, caseId));

      // Activate next step if specified
      if (nextStepType) {
        const nextStep = steps.find((s) => s.stepType === nextStepType && s.status === "pending");
        if (nextStep) {
          const updates: Record<string, unknown> = { status: "in_progress", updatedAt: now };
          if (assigneeId) updates.assignedTo = assigneeId;
          await db.update(piqWorkflowStepsTable).set(updates).where(eq(piqWorkflowStepsTable.id, nextStep.id));
        }
      }
    }

    switch (action) {
      case "submit_for_review": {
        if (role !== "manager" && !["hr_user", "hr_admin"].includes(role)) {
          res.status(403).json({ error: "Only managers can submit for review" });
          return;
        }
        if (!["draft", "manager_revision"].includes(c.status)) {
          res.status(400).json({ error: "Case is not in a submittable state" });
          return;
        }

        const supervisorStep = steps.find((s) => s.stepType === "supervisor_review");
        if (supervisorStep) {
          await advanceToNextStep("supervisor_review", "supervisor_review");
        } else {
          const hrStep = steps.find((s) => s.stepType === "hr_approval");
          if (hrStep) {
            await advanceToNextStep("hr_approval", "hr_approval");
          } else {
            await advanceToNextStep("delivery", "delivery");
          }
        }

        if (currentDoc) {
          await db.insert(piqDocumentHistoryTable).values({
            documentId: currentDoc.id, caseId, organizationId: authed.piqUser.organizationId,
            action: "submitted", performedBy: sub, performedByRole: role, notes: feedback,
          });
        }
        break;
      }

      case "supervisor_approve": {
        if (!["supervisor", "hr_admin"].includes(role)) {
          res.status(403).json({ error: "Only supervisors can approve at this step" });
          return;
        }
        if (c.status !== "supervisor_review") {
          res.status(400).json({ error: "Case is not in supervisor review" });
          return;
        }

        const hrStep = steps.find((s) => s.stepType === "hr_approval");
        if (hrStep) {
          await advanceToNextStep("hr_approval", "hr_approval");
        } else {
          await advanceToNextStep("delivery", "delivery");
        }

        if (currentDoc) {
          await db.insert(piqDocumentHistoryTable).values({
            documentId: currentDoc.id, caseId, organizationId: authed.piqUser.organizationId,
            action: "supervisor_approved", performedBy: sub, performedByRole: role, notes: feedback,
          });
        }
        break;
      }

      case "supervisor_return": {
        if (!["supervisor", "hr_admin"].includes(role)) {
          res.status(403).json({ error: "Only supervisors can return a case" });
          return;
        }
        if (c.status !== "supervisor_review") {
          res.status(400).json({ error: "Case is not in supervisor review" });
          return;
        }

        if (currentStep) {
          await db.update(piqWorkflowStepsTable)
            .set({ status: "returned", completedBy: sub, completedAt: now, feedback: feedback ?? null, updatedAt: now })
            .where(eq(piqWorkflowStepsTable.id, currentStep.id));
        }

        // Re-activate draft step for manager revision
        const draftStep = steps.find((s) => s.stepType === "draft");
        if (draftStep) {
          await db.update(piqWorkflowStepsTable)
            .set({ status: "in_progress", updatedAt: now, assignedTo: c.initiatedBy })
            .where(eq(piqWorkflowStepsTable.id, draftStep.id));
        }

        await db.update(piqCasesTable)
          .set({ status: "manager_revision", currentAssigneeId: c.initiatedBy, updatedAt: now })
          .where(eq(piqCasesTable.id, caseId));

        if (currentDoc) {
          await db.insert(piqDocumentHistoryTable).values({
            documentId: currentDoc.id, caseId, organizationId: authed.piqUser.organizationId,
            action: "supervisor_returned", performedBy: sub, performedByRole: role, notes: feedback,
          });
        }
        break;
      }

      case "hr_approve": {
        if (!["hr_user", "hr_admin"].includes(role)) {
          res.status(403).json({ error: "Only HR can approve at this step" });
          return;
        }
        if (c.status !== "hr_approval") {
          res.status(400).json({ error: "Case is not in HR approval" });
          return;
        }

        await advanceToNextStep("delivery", "delivery");

        if (currentDoc) {
          await db.insert(piqDocumentHistoryTable).values({
            documentId: currentDoc.id, caseId, organizationId: authed.piqUser.organizationId,
            action: "hr_approved", performedBy: sub, performedByRole: role, notes: feedback,
          });
        }
        break;
      }

      case "hr_return": {
        if (!["hr_user", "hr_admin"].includes(role)) {
          res.status(403).json({ error: "Only HR can return a case" });
          return;
        }
        if (c.status !== "hr_approval") {
          res.status(400).json({ error: "Case is not in HR approval" });
          return;
        }

        if (currentStep) {
          await db.update(piqWorkflowStepsTable)
            .set({ status: "returned", completedBy: sub, completedAt: now, feedback: feedback ?? null, updatedAt: now })
            .where(eq(piqWorkflowStepsTable.id, currentStep.id));
        }

        const draftStep = steps.find((s) => s.stepType === "draft");
        if (draftStep) {
          await db.update(piqWorkflowStepsTable)
            .set({ status: "in_progress", updatedAt: now, assignedTo: c.initiatedBy })
            .where(eq(piqWorkflowStepsTable.id, draftStep.id));
        }

        await db.update(piqCasesTable)
          .set({ status: "manager_revision", currentAssigneeId: c.initiatedBy, updatedAt: now })
          .where(eq(piqCasesTable.id, caseId));

        if (currentDoc) {
          await db.insert(piqDocumentHistoryTable).values({
            documentId: currentDoc.id, caseId, organizationId: authed.piqUser.organizationId,
            action: "hr_returned", performedBy: sub, performedByRole: role, notes: feedback,
          });
        }
        break;
      }

      case "deliver": {
        if (!["manager", "hr_user", "hr_admin"].includes(role)) {
          res.status(403).json({ error: "Only managers or HR can record delivery" });
          return;
        }
        if (c.status !== "delivery") {
          res.status(400).json({ error: "Case is not ready for delivery" });
          return;
        }

        if (currentStep) {
          await db.update(piqWorkflowStepsTable)
            .set({ status: "completed", completedBy: sub, completedAt: now, updatedAt: now })
            .where(eq(piqWorkflowStepsTable.id, currentStep.id));
        }

        await db.update(piqCasesTable)
          .set({ status: "closed", updatedAt: now })
          .where(eq(piqCasesTable.id, caseId));

        if (currentDoc) {
          await db.insert(piqDocumentHistoryTable).values({
            documentId: currentDoc.id, caseId, organizationId: authed.piqUser.organizationId,
            action: "delivered", performedBy: sub, performedByRole: role, notes: feedback,
          });
        }
        break;
      }

      case "reassign": {
        if (!assigneeId) {
          res.status(400).json({ error: "assigneeId is required for reassignment" });
          return;
        }

        // Validate the new assignee belongs to the org
        const [newAssignee] = await db
          .select({ id: piqUsersTable.id })
          .from(piqUsersTable)
          .where(and(eq(piqUsersTable.id, assigneeId), eq(piqUsersTable.organizationId, authed.piqUser.organizationId)))
          .limit(1);
        if (!newAssignee) {
          res.status(400).json({ error: "Assignee not found in this organization" });
          return;
        }

        if (currentStep) {
          await db.update(piqWorkflowStepsTable)
            .set({
              assignedTo: assigneeId,
              reassignedFrom: currentStep.assignedTo ?? null,
              reassignedReason: reassignReason ?? null,
              updatedAt: now,
            })
            .where(eq(piqWorkflowStepsTable.id, currentStep.id));
        }

        await db.update(piqCasesTable)
          .set({ currentAssigneeId: assigneeId, updatedAt: now })
          .where(eq(piqCasesTable.id, caseId));
        break;
      }

      default:
        res.status(400).json({ error: "Unknown workflow action" });
        return;
    }

    // Return updated case
    const [updated] = await db.select().from(piqCasesTable).where(eq(piqCasesTable.id, caseId)).limit(1);
    const updatedSteps = await db
      .select()
      .from(piqWorkflowStepsTable)
      .where(eq(piqWorkflowStepsTable.caseId, caseId))
      .orderBy(piqWorkflowStepsTable.stepOrder);

    res.json({ case: updated, workflowSteps: updatedSteps });
  } catch (err) {
    logger.error({ err }, "PIQ workflow action error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
