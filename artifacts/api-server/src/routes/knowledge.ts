import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import { eq, and, isNull } from "drizzle-orm";
import { db, orgLocationsTable, ragDocumentsTable, ragChunksTable, organizationsTable } from "@workspace/db";
import { requireSuperAdmin } from "../lib/jwtAuth";
import { ingestDocument } from "../lib/rag";
import { refreshRegulatoryDocs } from "../lib/regulatoryFetcher";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const allowed = ["application/pdf", "text/plain", "text/markdown"];
    if (allowed.includes(file.mimetype) || file.originalname.endsWith(".txt") || file.originalname.endsWith(".md")) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, TXT, and MD files are supported"));
    }
  },
});

async function extractText(buffer: Buffer, mimetype: string, filename: string): Promise<string> {
  if (mimetype === "application/pdf" || filename.toLowerCase().endsWith(".pdf")) {
    const { default: PDFParser } = await import("pdf2json");
    return new Promise<string>((resolve, reject) => {
      const parser = new PDFParser(null, 1);
      parser.on("pdfParser_dataError", (err: { parserError: Error }) => reject(err.parserError));
      parser.on("pdfParser_dataReady", () => {
        try {
          const raw = (parser as unknown as { getRawTextContent: () => string }).getRawTextContent();
          resolve(raw.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim());
        } catch (e) {
          reject(e);
        }
      });
      parser.parseBuffer(buffer);
    });
  }
  return buffer.toString("utf-8");
}

// --- LOCATIONS ---

// GET /superadmin/organizations/:orgId/locations
router.get(
  "/superadmin/organizations/:orgId/locations",
  requireSuperAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const locations = await db
      .select()
      .from(orgLocationsTable)
      .where(eq(orgLocationsTable.organizationId, req.params.orgId))
      .orderBy(orgLocationsTable.state);
    res.json({ locations });
  },
);

// POST /superadmin/organizations/:orgId/locations
router.post(
  "/superadmin/organizations/:orgId/locations",
  requireSuperAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const { state, city, county } = req.body as { state?: string; city?: string; county?: string };
    if (!state?.trim()) {
      res.status(400).json({ error: "State is required" });
      return;
    }
    const [org] = await db
      .select({ id: organizationsTable.id })
      .from(organizationsTable)
      .where(eq(organizationsTable.id, req.params.orgId));
    if (!org) {
      res.status(404).json({ error: "Organization not found" });
      return;
    }
    const [location] = await db
      .insert(orgLocationsTable)
      .values({ organizationId: req.params.orgId, state: state.trim(), city: city?.trim() || null, county: county?.trim() || null })
      .returning();
    res.status(201).json(location);
  },
);

// DELETE /superadmin/organizations/:orgId/locations/:locationId
router.delete(
  "/superadmin/organizations/:orgId/locations/:locationId",
  requireSuperAdmin,
  async (req: Request, res: Response): Promise<void> => {
    await db
      .delete(orgLocationsTable)
      .where(
        and(
          eq(orgLocationsTable.id, req.params.locationId),
          eq(orgLocationsTable.organizationId, req.params.orgId),
        ),
      );
    res.json({ success: true });
  },
);

// --- DOCUMENTS ---

// GET /superadmin/organizations/:orgId/documents
router.get(
  "/superadmin/organizations/:orgId/documents",
  requireSuperAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const docs = await db
      .select({
        id: ragDocumentsTable.id,
        name: ragDocumentsTable.name,
        sourceType: ragDocumentsTable.sourceType,
        createdAt: ragDocumentsTable.createdAt,
        updatedAt: ragDocumentsTable.updatedAt,
      })
      .from(ragDocumentsTable)
      .where(eq(ragDocumentsTable.organizationId, req.params.orgId))
      .orderBy(ragDocumentsTable.updatedAt);
    res.json({ documents: docs });
  },
);

// POST /superadmin/organizations/:orgId/documents  (file upload)
router.post(
  "/superadmin/organizations/:orgId/documents",
  requireSuperAdmin,
  upload.single("file"),
  async (req: Request, res: Response): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const [org] = await db
      .select({ id: organizationsTable.id })
      .from(organizationsTable)
      .where(eq(organizationsTable.id, req.params.orgId));
    if (!org) {
      res.status(404).json({ error: "Organization not found" });
      return;
    }

    let text: string;
    try {
      text = await extractText(req.file.buffer, req.file.mimetype, req.file.originalname);
    } catch (err) {
      logger.error({ err }, "Failed to extract text from uploaded file");
      res.status(422).json({ error: "Could not extract text from this file" });
      return;
    }

    if (text.trim().length < 50) {
      res.status(422).json({ error: "Document appears to be empty or unreadable" });
      return;
    }

    const docId = await ingestDocument({
      name: req.file.originalname,
      sourceType: "UPLOAD",
      fullText: text,
      organizationId: req.params.orgId,
    });

    const [doc] = await db
      .select({ id: ragDocumentsTable.id, name: ragDocumentsTable.name, sourceType: ragDocumentsTable.sourceType, createdAt: ragDocumentsTable.createdAt, updatedAt: ragDocumentsTable.updatedAt })
      .from(ragDocumentsTable)
      .where(eq(ragDocumentsTable.id, docId));

    res.status(201).json(doc);
  },
);

// DELETE /superadmin/organizations/:orgId/documents/:docId
router.delete(
  "/superadmin/organizations/:orgId/documents/:docId",
  requireSuperAdmin,
  async (req: Request, res: Response): Promise<void> => {
    await db.delete(ragChunksTable).where(eq(ragChunksTable.documentId, req.params.docId));
    await db
      .delete(ragDocumentsTable)
      .where(
        and(
          eq(ragDocumentsTable.id, req.params.docId),
          eq(ragDocumentsTable.organizationId, req.params.orgId),
        ),
      );
    res.json({ success: true });
  },
);

// --- REGULATORY REFRESH ---

// GET /superadmin/regulatory/status
router.get(
  "/superadmin/regulatory/status",
  requireSuperAdmin,
  async (_req: Request, res: Response): Promise<void> => {
    const docs = await db
      .select({ name: ragDocumentsTable.name, sourceType: ragDocumentsTable.sourceType, updatedAt: ragDocumentsTable.updatedAt })
      .from(ragDocumentsTable)
      .where(isNull(ragDocumentsTable.organizationId))
      .orderBy(ragDocumentsTable.name);
    res.json({ regulatoryDocs: docs });
  },
);

// POST /superadmin/regulatory/refresh
router.post(
  "/superadmin/regulatory/refresh",
  requireSuperAdmin,
  async (_req: Request, res: Response): Promise<void> => {
    refreshRegulatoryDocs().catch((err) => logger.error({ err }, "Regulatory refresh failed"));
    res.json({ message: "Regulatory refresh started in background" });
  },
);

export default router;
