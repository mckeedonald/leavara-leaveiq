import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import multer from "multer";
import { db, organizationsTable } from "@workspace/db";
import { requireAuth, requireAdmin, type AuthenticatedRequest } from "../lib/jwtAuth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed for the organization logo."));
  },
});

// GET /portal/org/:slug — public, returns org branding info
router.get("/portal/org/:slug", async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const [org] = await db
      .select({
        name: organizationsTable.name,
        slug: organizationsTable.slug,
        isActive: organizationsTable.isActive,
        logoStorageKey: organizationsTable.logoStorageKey,
        hasLeaveIq: organizationsTable.hasLeaveIq,
        hasPerformIq: organizationsTable.hasPerformIq,
      })
      .from(organizationsTable)
      .where(eq(organizationsTable.slug, slug))
      .limit(1);

    if (!org || !org.isActive) {
      res.status(404).json({ error: "Organization not found" });
      return;
    }

    let logoUrl: string | null = null;
    if (org.logoStorageKey) {
      const { getPresignedUrl } = await import("../lib/storage.js");
      logoUrl = await getPresignedUrl(org.logoStorageKey, 7200);
    }

    const products: string[] = [];
    if (org.hasLeaveIq) products.push("leaveiq");
    if (org.hasPerformIq) products.push("performiq");

    res.json({ name: org.name, slug: org.slug, logoUrl, products });
  } catch (err) {
    logger.error({ err }, "GET /portal/org/:slug error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /orgs/me — protected, returns current user's org info including logo
router.get("/orgs/me", requireAuth, async (req: Request, res: Response) => {
  try {
    const authed = req as AuthenticatedRequest;
    if (!authed.user.organizationId) {
      res.json({ name: null, logoUrl: null });
      return;
    }
    const [org] = await db
      .select({
        name: organizationsTable.name,
        slug: organizationsTable.slug,
        logoStorageKey: organizationsTable.logoStorageKey,
        hasPerformIq: organizationsTable.hasPerformIq,
      })
      .from(organizationsTable)
      .where(eq(organizationsTable.id, authed.user.organizationId))
      .limit(1);

    if (!org) {
      res.json({ name: null, logoUrl: null, hasPerformIq: false });
      return;
    }

    let logoUrl: string | null = null;
    if (org.logoStorageKey) {
      const { getPresignedUrl } = await import("../lib/storage.js");
      logoUrl = await getPresignedUrl(org.logoStorageKey, 7200);
    }

    res.json({ name: org.name, slug: org.slug, logoUrl, hasPerformIq: org.hasPerformIq ?? false });
  } catch (err) {
    logger.error({ err }, "GET /orgs/me error");
    res.json({ name: null, logoUrl: null });
  }
});

// POST /orgs/logo — admin only, upload org logo
router.post(
  "/orgs/logo",
  requireAuth,
  requireAdmin,
  logoUpload.single("logo"),
  async (req: Request, res: Response) => {
    try {
      const authed = req as AuthenticatedRequest;
      const organizationId = authed.user.organizationId;

      if (!organizationId) {
        res.status(400).json({ error: "No organization associated with your account" });
        return;
      }

      const file = req.file;
      if (!file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }

      const extMap: Record<string, string> = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/gif": ".gif",
        "image/webp": ".webp",
        "image/svg+xml": ".svg",
      };
      const ext = extMap[file.mimetype] ?? ".png";
      const storageKey = `orgs/${organizationId}/logo${ext}`;

      const { uploadFile } = await import("../lib/storage.js");
      await uploadFile(storageKey, file.buffer, file.mimetype);

      await db
        .update(organizationsTable)
        .set({ logoStorageKey: storageKey, updatedAt: new Date() })
        .where(eq(organizationsTable.id, organizationId));

      res.json({ success: true, storageKey });
    } catch (err) {
      logger.error({ err }, "POST /orgs/logo error");
      res.status(500).json({ error: "Failed to upload logo" });
    }
  },
);

export default router;
