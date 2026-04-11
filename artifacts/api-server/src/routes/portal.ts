import { Router, type IRouter } from "express";
import { eq, and, gt } from "drizzle-orm";
import multer from "multer";
import { randomBytes } from "node:crypto";
import {
  db,
  caseAccessTokensTable,
  caseDocumentsTable,
  leaveCasesTable,
  usersTable,
} from "@workspace/db";
import { sendDocumentUploadNotification } from "../lib/email";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// multer — store in memory (max 20 MB per file)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const allowed = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/heic",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file type. Please upload a PDF, image, or Word document."));
    }
  },
});

async function resolveToken(token: string) {
  const now = new Date();

  // First: check if the token exists at all (ignore expiry) for diagnostic logging
  const [anyRow] = await db
    .select({ id: caseAccessTokensTable.id, expiresAt: caseAccessTokensTable.expiresAt })
    .from(caseAccessTokensTable)
    .where(eq(caseAccessTokensTable.token, token))
    .limit(1);

  if (!anyRow) {
    logger.warn({ tokenPrefix: token.slice(0, 16) }, "Portal token not found in DB");
    return null;
  }

  if (anyRow.expiresAt <= now) {
    logger.warn({ tokenPrefix: token.slice(0, 16), expiresAt: anyRow.expiresAt, now }, "Portal token is expired");
    return null;
  }

  // Valid and non-expired — fetch full row
  const [row] = await db
    .select()
    .from(caseAccessTokensTable)
    .where(
      and(
        eq(caseAccessTokensTable.token, token),
        gt(caseAccessTokensTable.expiresAt, now),
      ),
    )
    .limit(1);
  return row ?? null;
}

// GET /portal/case?token=xxx
router.get("/portal/case", async (req, res): Promise<void> => {
  try {
    const token = typeof req.query["token"] === "string" ? req.query["token"] : null;
    if (!token) {
      res.status(400).json({ error: "token is required." });
      return;
    }

    logger.info({ tokenPrefix: token.slice(0, 16), tokenLength: token.length }, "Portal case lookup");

    const accessToken = await resolveToken(token);
    if (!accessToken) {
      res.status(401).json({ error: "Invalid or expired access link. Please contact HR for a new link." });
      return;
    }

    const [leaveCase] = await db
      .select({
        id: leaveCasesTable.id,
        caseNumber: leaveCasesTable.caseNumber,
        state: leaveCasesTable.state,
        leaveReasonCategory: leaveCasesTable.leaveReasonCategory,
        requestedStart: leaveCasesTable.requestedStart,
        requestedEnd: leaveCasesTable.requestedEnd,
        employeeFirstName: leaveCasesTable.employeeFirstName,
        employeeLastName: leaveCasesTable.employeeLastName,
        intermittent: leaveCasesTable.intermittent,
      })
      .from(leaveCasesTable)
      .where(eq(leaveCasesTable.id, accessToken.caseId))
      .limit(1);

    if (!leaveCase) {
      res.status(404).json({ error: "Case not found." });
      return;
    }

    const documents = await db
      .select({
        id: caseDocumentsTable.id,
        fileName: caseDocumentsTable.fileName,
        mimeType: caseDocumentsTable.mimeType,
        sizeBytes: caseDocumentsTable.sizeBytes,
        uploadedBy: caseDocumentsTable.uploadedBy,
        createdAt: caseDocumentsTable.createdAt,
      })
      .from(caseDocumentsTable)
      .where(eq(caseDocumentsTable.caseId, accessToken.caseId));

    res.json({ case: leaveCase, documents, token });
  } catch (err) {
    logger.error({ err }, "GET /portal/case — unexpected error");
    res.status(500).json({ error: "Unable to load your case. Please try again or contact HR." });
  }
});

// POST /portal/case/:caseId/documents — employee file upload
router.post(
  "/portal/case/:caseId/documents",
  upload.single("file"),
  async (req, res): Promise<void> => {
    const token = typeof req.query["token"] === "string" ? req.query["token"] : null;
    const { caseId } = req.params;

    if (!token) {
      res.status(401).json({ error: "token is required." });
      return;
    }

    const accessToken = await resolveToken(token);
    if (!accessToken || accessToken.caseId !== caseId) {
      res.status(401).json({ error: "Invalid or expired token." });
      return;
    }

    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "No file uploaded." });
      return;
    }

    // Build a unique storage key
    const ext = file.originalname.split(".").pop() ?? "bin";
    const uniqueId = randomBytes(8).toString("hex");
    const storageKey = `cases/${caseId}/documents/${uniqueId}.${ext}`;

    try {
      const { uploadFile } = await import("../lib/storage.js");
      await uploadFile(storageKey, file.buffer, file.mimetype);
    } catch (err) {
      logger.error({ err, caseId }, "R2 upload failed");
      res.status(500).json({ error: "File upload failed. Please try again." });
      return;
    }

    const [doc] = await db
      .insert(caseDocumentsTable)
      .values({
        caseId,
        uploadedBy: "employee",
        fileName: file.originalname,
        storageKey,
        mimeType: file.mimetype,
        sizeBytes: file.size,
      })
      .returning();

    // Notify the HR reviewer
    try {
      const [leaveCase] = await db
        .select({
          caseNumber: leaveCasesTable.caseNumber,
          organizationId: leaveCasesTable.organizationId,
          employeeFirstName: leaveCasesTable.employeeFirstName,
          employeeLastName: leaveCasesTable.employeeLastName,
        })
        .from(leaveCasesTable)
        .where(eq(leaveCasesTable.id, caseId))
        .limit(1);

      if (leaveCase?.organizationId) {
        // Notify all admin users in the org
        const admins = await db
          .select({ email: usersTable.email })
          .from(usersTable)
          .where(
            and(
              eq(usersTable.organizationId, leaveCase.organizationId),
              eq(usersTable.role, "admin"),
              eq(usersTable.isActive, true),
            ),
          );

        const employeeName = [leaveCase.employeeFirstName, leaveCase.employeeLastName]
          .filter(Boolean)
          .join(" ") || accessToken.employeeEmail;

        for (const admin of admins) {
          await sendDocumentUploadNotification(
            admin.email,
            leaveCase.caseNumber,
            file.originalname,
            employeeName,
          ).catch((err) => logger.warn({ err, to: admin.email }, "HR notification email failed"));
        }
      }
    } catch (err) {
      logger.warn({ err, caseId }, "Could not send HR notification");
    }

    res.status(201).json(doc);
  },
);

// GET /portal/case/:caseId/documents — list documents (employee view)
router.get("/portal/case/:caseId/documents", async (req, res): Promise<void> => {
  const token = typeof req.query["token"] === "string" ? req.query["token"] : null;
  const { caseId } = req.params;

  if (!token) {
    res.status(401).json({ error: "token is required." });
    return;
  }

  const accessToken = await resolveToken(token);
  if (!accessToken || accessToken.caseId !== caseId) {
    res.status(401).json({ error: "Invalid or expired token." });
    return;
  }

  const documents = await db
    .select({
      id: caseDocumentsTable.id,
      fileName: caseDocumentsTable.fileName,
      mimeType: caseDocumentsTable.mimeType,
      sizeBytes: caseDocumentsTable.sizeBytes,
      uploadedBy: caseDocumentsTable.uploadedBy,
      createdAt: caseDocumentsTable.createdAt,
    })
    .from(caseDocumentsTable)
    .where(eq(caseDocumentsTable.caseId, caseId));

  res.json({ documents });
});

// GET /portal/case/:caseId/documents/:docId/download — presigned URL (employee)
router.get("/portal/case/:caseId/documents/:docId/download", async (req, res): Promise<void> => {
  const token = typeof req.query["token"] === "string" ? req.query["token"] : null;
  const { caseId, docId } = req.params;

  if (!token) {
    res.status(401).json({ error: "token is required." });
    return;
  }

  const accessToken = await resolveToken(token);
  if (!accessToken || accessToken.caseId !== caseId) {
    res.status(401).json({ error: "Invalid or expired token." });
    return;
  }

  const [doc] = await db
    .select()
    .from(caseDocumentsTable)
    .where(and(eq(caseDocumentsTable.id, docId), eq(caseDocumentsTable.caseId, caseId)))
    .limit(1);

  if (!doc) {
    res.status(404).json({ error: "Document not found." });
    return;
  }

  const { getPresignedUrl } = await import("../lib/storage.js");
  const url = await getPresignedUrl(doc.storageKey, 3600);
  res.json({ url, fileName: doc.fileName });
});

export default router;
