import { Router, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import {
  db,
  piqDocumentTypesTable,
  piqPoliciesTable,
  usersTable,
  organizationsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requirePiqHrAdmin, requirePiqAuth, type PiqAuthenticatedRequest } from "../../lib/piqJwtAuth.js";
import { logger } from "../../lib/logger.js";

// Accept all files; validate extension manually inside handler
const policyUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

// Convert multer errors (e.g. file too large) into clean JSON 400s
function handleMulterError(err: any, _req: Request, res: Response, next: NextFunction) {
  if (err?.code === "LIMIT_FILE_SIZE") {
    res.status(400).json({ error: "File exceeds the 50 MB limit. Please use a smaller PDF." });
    return;
  }
  next(err);
}

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
      .select({
        id: piqPoliciesTable.id,
        title: piqPoliciesTable.title,
        category: piqPoliciesTable.category,
        content: piqPoliciesTable.content,
        policyNumber: piqPoliciesTable.policyNumber,
        effectiveDate: piqPoliciesTable.effectiveDate,
        isActive: piqPoliciesTable.isActive,
        pdfStorageKey: piqPoliciesTable.pdfStorageKey,
        createdAt: piqPoliciesTable.createdAt,
      })
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
    const { title, category, content, policyNumber, effectiveDate, pdfStorageKey, pdfBase64 } = req.body as {
      title?: string;
      category?: string;
      content?: string;
      policyNumber?: string;
      effectiveDate?: string;
      pdfStorageKey?: string;
      pdfBase64?: string;
    };

    if (!title || !category) {
      res.status(400).json({ error: "title and category are required" });
      return;
    }
    // Must have either a PDF (storage key or inline base64) or text content
    if (!pdfStorageKey && !pdfBase64 && !content?.trim()) {
      res.status(400).json({ error: "Either upload a PDF or provide policy content text" });
      return;
    }

    // Inline PDF: store as base64 data URI in content field (no R2 needed)
    const storedContent = pdfBase64
      ? `data:application/pdf;base64,${pdfBase64}`
      : (content ?? "");

    const [policy] = await db
      .insert(piqPoliciesTable)
      .values({
        organizationId: authed.piqUser.organizationId,
        title,
        category,
        content: storedContent,
        policyNumber,
        effectiveDate,
        pdfStorageKey: pdfStorageKey ?? null,
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

    const allowed = ["title", "category", "content", "policyNumber", "effectiveDate", "isActive", "pdfStorageKey"];
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

// POST /performiq/admin/policies/upload-pdf — receive PDF and return it as base64 for inline storage
router.post(
  "/performiq/admin/policies/upload-pdf",
  requirePiqHrAdmin,
  policyUpload.single("file"),
  handleMulterError,
  async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "No file provided." });
      return;
    }

    const ext = (file.originalname.split(".").pop() ?? "").toLowerCase();
    const isPdf = ext === "pdf" || file.mimetype === "application/pdf" || file.mimetype === "application/octet-stream";
    if (!isPdf) {
      res.status(400).json({ error: "Only PDF files are accepted." });
      return;
    }

    try {
      const base64Pdf = file.buffer.toString("base64");
      logger.info({ fileName: file.originalname, sizeKb: Math.round(file.size / 1024) }, "Policy PDF buffered for inline storage");
      res.json({ base64Pdf, fileName: file.originalname });
    } catch (err) {
      logger.error({ err }, "Policy PDF base64 encode error");
      res.status(500).json({ error: "Failed to process PDF. Please try again." });
    }
  }
);

// ── HR User Lists for assignment ──────────────────────────────────────────

// GET /performiq/admin/hr-users  — users with hr_user or hr_admin role
router.get("/performiq/admin/hr-users", requirePiqAuth, async (req: Request, res: Response) => {
  try {
    const authed = req as PiqAuthenticatedRequest;
    const hrUsers = await db
      .select({ id: usersTable.id, fullName: usersTable.fullName, email: usersTable.email, role: usersTable.role })
      .from(usersTable)
      .where(and(eq(usersTable.organizationId, authed.piqUser.organizationId), eq(usersTable.isActive, true)));

    res.json(hrUsers.filter((u) => ["hr_user", "hr_admin"].includes(u.role)));
  } catch (err) {
    logger.error({ err }, "PIQ HR users list error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
