import { Router, type Request, type Response } from "express";
import {
  db,
  piqDocumentTypesTable,
  piqPoliciesTable,
  piqUsersTable,
  organizationsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requirePiqHrAdmin, requirePiqAuth, type PiqAuthenticatedRequest } from "../../lib/piqJwtAuth.js";
import { logger } from "../../lib/logger.js";

const router = Router();

// ── Document Types ──────────────────────────────────────────────────────────

// GET /performiq/admin/document-types
router.get("/performiq/admin/document-types", requirePiqAuth, async (req: Request, res: Response) => {
  try {
    const authed = req as PiqAuthenticatedRequest;
    const types = await db
      .select()
      .from(piqDocumentTypesTable)
      .where(eq(piqDocumentTypesTable.organizationId, authed.piqUser.organizationId));
    res.json(types);
  } catch (err) {
    logger.error({ err }, "PIQ doc types list error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /performiq/admin/document-types  (hr_admin)
router.post("/performiq/admin/document-types", requirePiqHrAdmin, async (req: Request, res: Response) => {
  try {
    const authed = req as PiqAuthenticatedRequest;
    const { baseType, displayLabel, requiresSupervisorReview, supervisorReviewRequired, requiresHrApproval } =
      req.body as {
        baseType?: string;
        displayLabel?: string;
        requiresSupervisorReview?: boolean;
        supervisorReviewRequired?: boolean;
        requiresHrApproval?: boolean;
      };

    if (!baseType || !displayLabel) {
      res.status(400).json({ error: "baseType and displayLabel are required" });
      return;
    }

    const [docType] = await db
      .insert(piqDocumentTypesTable)
      .values({
        organizationId: authed.piqUser.organizationId,
        baseType: baseType as any,
        displayLabel,
        requiresSupervisorReview: requiresSupervisorReview ?? false,
        supervisorReviewRequired: supervisorReviewRequired ?? false,
        requiresHrApproval: requiresHrApproval ?? false,
      })
      .returning();

    res.status(201).json(docType);
  } catch (err) {
    logger.error({ err }, "PIQ doc type create error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /performiq/admin/document-types/:typeId  (hr_admin)
router.patch("/performiq/admin/document-types/:typeId", requirePiqHrAdmin, async (req: Request, res: Response) => {
  try {
    const authed = req as PiqAuthenticatedRequest;
    const { typeId } = req.params;

    const [existing] = await db
      .select({ id: piqDocumentTypesTable.id })
      .from(piqDocumentTypesTable)
      .where(and(eq(piqDocumentTypesTable.id, typeId), eq(piqDocumentTypesTable.organizationId, authed.piqUser.organizationId)))
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "Document type not found" });
      return;
    }

    const allowed = ["displayLabel", "requiresSupervisorReview", "supervisorReviewRequired", "requiresHrApproval", "isActive"];
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    for (const key of allowed) {
      if (key in req.body) updates[key] = req.body[key];
    }

    const [updated] = await db.update(piqDocumentTypesTable).set(updates).where(eq(piqDocumentTypesTable.id, typeId)).returning();
    res.json(updated);
  } catch (err) {
    logger.error({ err }, "PIQ doc type update error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Policies ──────────────────────────────────────────────────────────────

// GET /performiq/admin/policies
router.get("/performiq/admin/policies", requirePiqAuth, async (req: Request, res: Response) => {
  try {
    const authed = req as PiqAuthenticatedRequest;
    const policies = await db
      .select()
      .from(piqPoliciesTable)
      .where(eq(piqPoliciesTable.organizationId, authed.piqUser.organizationId));
    res.json(policies);
  } catch (err) {
    logger.error({ err }, "PIQ policies list error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /performiq/admin/policies  (hr_admin)
router.post("/performiq/admin/policies", requirePiqHrAdmin, async (req: Request, res: Response) => {
  try {
    const authed = req as PiqAuthenticatedRequest;
    const { title, category, content, policyNumber, effectiveDate } = req.body as {
      title?: string;
      category?: string;
      content?: string;
      policyNumber?: string;
      effectiveDate?: string;
    };

    if (!title || !category || !content) {
      res.status(400).json({ error: "title, category, and content are required" });
      return;
    }

    const [policy] = await db
      .insert(piqPoliciesTable)
      .values({
        organizationId: authed.piqUser.organizationId,
        title,
        category,
        content,
        policyNumber,
        effectiveDate,
      })
      .returning();

    res.status(201).json(policy);
  } catch (err) {
    logger.error({ err }, "PIQ policy create error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /performiq/admin/policies/:policyId  (hr_admin)
router.patch("/performiq/admin/policies/:policyId", requirePiqHrAdmin, async (req: Request, res: Response) => {
  try {
    const authed = req as PiqAuthenticatedRequest;
    const { policyId } = req.params;

    const [existing] = await db
      .select({ id: piqPoliciesTable.id })
      .from(piqPoliciesTable)
      .where(and(eq(piqPoliciesTable.id, policyId), eq(piqPoliciesTable.organizationId, authed.piqUser.organizationId)))
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "Policy not found" });
      return;
    }

    const allowed = ["title", "category", "content", "policyNumber", "effectiveDate", "isActive"];
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    for (const key of allowed) {
      if (key in req.body) updates[key] = req.body[key];
    }

    const [updated] = await db.update(piqPoliciesTable).set(updates).where(eq(piqPoliciesTable.id, policyId)).returning();
    res.json(updated);
  } catch (err) {
    logger.error({ err }, "PIQ policy update error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /performiq/admin/policies/:policyId (soft delete via isActive=false)
router.delete("/performiq/admin/policies/:policyId", requirePiqHrAdmin, async (req: Request, res: Response) => {
  try {
    const authed = req as PiqAuthenticatedRequest;
    const { policyId } = req.params;

    await db
      .update(piqPoliciesTable)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(piqPoliciesTable.id, policyId), eq(piqPoliciesTable.organizationId, authed.piqUser.organizationId)));

    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "PIQ policy delete error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Supervisor / HR Lists for reassignment ──────────────────────────────────

// GET /performiq/admin/supervisors  — users with supervisor role
router.get("/performiq/admin/supervisors", requirePiqAuth, async (req: Request, res: Response) => {
  try {
    const authed = req as PiqAuthenticatedRequest;
    const supervisors = await db
      .select({ id: piqUsersTable.id, fullName: piqUsersTable.fullName, email: piqUsersTable.email, role: piqUsersTable.role })
      .from(piqUsersTable)
      .where(and(eq(piqUsersTable.organizationId, authed.piqUser.organizationId), eq(piqUsersTable.isActive, true)));

    res.json(supervisors.filter((u) => u.role === "supervisor"));
  } catch (err) {
    logger.error({ err }, "PIQ supervisors list error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /performiq/admin/hr-users  — users with hr_user or hr_admin role
router.get("/performiq/admin/hr-users", requirePiqAuth, async (req: Request, res: Response) => {
  try {
    const authed = req as PiqAuthenticatedRequest;
    const hrUsers = await db
      .select({ id: piqUsersTable.id, fullName: piqUsersTable.fullName, email: piqUsersTable.email, role: piqUsersTable.role })
      .from(piqUsersTable)
      .where(and(eq(piqUsersTable.organizationId, authed.piqUser.organizationId), eq(piqUsersTable.isActive, true)));

    res.json(hrUsers.filter((u) => ["hr_user", "hr_admin"].includes(u.role)));
  } catch (err) {
    logger.error({ err }, "PIQ HR users list error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
