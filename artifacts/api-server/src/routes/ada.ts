import { Router, type Request, type Response } from "express";
import { eq, and, asc, desc, isNull } from "drizzle-orm";
import {
  db,
  adaCasesTable,
  adaInteractiveLogTable,
  approvedAccommodationsTable,
  calendarInvitesTable,
  usersTable,
  organizationsTable,
} from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../lib/jwtAuth.js";
import { logger } from "../lib/logger.js";
import {
  runAdaTurn,
  generatePhysicianCertRequest,
  generateApprovalLetter,
  generateDenialLetter,
  type AdaMessage,
} from "../lib/adaAgent.js";
import { generateIcs } from "../lib/icsGenerator.js";
import { sendNoticeEmail, getAppUrl } from "../lib/email.js";

const router = Router();

function generateCaseNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `ADA-${year}${month}-${rand}`;
}

// ── ADA Case CRUD ────────────────────────────────────────────────────────────

// GET /api/ada/cases
router.get("/ada/cases", requireAuth, async (req: Request, res: Response) => {
  const authed = req as AuthenticatedRequest;
  try {
    const cases = await db
      .select()
      .from(adaCasesTable)
      .where(and(
        eq(adaCasesTable.organizationId, authed.user.organizationId),
        isNull(adaCasesTable.deletedAt),
      ))
      .orderBy(desc(adaCasesTable.createdAt));
    res.json({ cases });
  } catch (err) {
    logger.error({ err }, "ADA cases list error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/ada/cases/:caseId
router.get("/ada/cases/:caseId", requireAuth, async (req: Request, res: Response) => {
  const authed = req as AuthenticatedRequest;
  const { caseId } = req.params;
  try {
    const [adaCase] = await db
      .select()
      .from(adaCasesTable)
      .where(and(eq(adaCasesTable.id, caseId), eq(adaCasesTable.organizationId, authed.user.organizationId)))
      .limit(1);
    if (!adaCase) { res.status(404).json({ error: "Case not found" }); return; }

    const log = await db
      .select()
      .from(adaInteractiveLogTable)
      .where(eq(adaInteractiveLogTable.caseId, caseId))
      .orderBy(asc(adaInteractiveLogTable.createdAt));

    const accommodations = await db
      .select()
      .from(approvedAccommodationsTable)
      .where(and(eq(approvedAccommodationsTable.caseId, caseId), eq(approvedAccommodationsTable.isActive, true)));

    res.json({ case: adaCase, log, accommodations });
  } catch (err) {
    logger.error({ err }, "ADA case fetch error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/ada/cases  (employee portal submission — public)
router.post("/ada/cases", async (req: Request, res: Response) => {
  try {
    const {
      orgSlug,
      employeeNumber,
      employeeFirstName,
      employeeLastName,
      employeeEmail,
      disabilityDescription,
      functionalLimitations,
      accommodationRequested,
      isTemporary,
      estimatedDuration,
      hasPhysicianSupport,
      additionalNotes,
      submittedBy,
    } = req.body as Record<string, unknown>;

    // Resolve org
    let organizationId: string | null = null;
    if (orgSlug) {
      const [org] = await db.select({ id: organizationsTable.id }).from(organizationsTable).where(eq(organizationsTable.slug, orgSlug as string)).limit(1);
      organizationId = org?.id ?? null;
    }
    if (!organizationId) { res.status(400).json({ error: "Organization not found" }); return; }

    const caseNumber = generateCaseNumber();
    const accessToken = require("node:crypto").randomBytes(32).toString("hex");

    const [adaCase] = await db.insert(adaCasesTable).values({
      organizationId,
      caseNumber,
      employeeNumber: String(employeeNumber ?? ""),
      employeeFirstName: employeeFirstName as string | undefined,
      employeeLastName: employeeLastName as string | undefined,
      employeeEmail: employeeEmail as string | undefined,
      disabilityDescription: disabilityDescription as string | undefined,
      functionalLimitations: functionalLimitations as string | undefined,
      accommodationRequested: accommodationRequested as string | undefined,
      isTemporary: Boolean(isTemporary),
      estimatedDuration: estimatedDuration as string | undefined,
      hasPhysicianSupport: hasPhysicianSupport as boolean | undefined,
      additionalNotes: additionalNotes as string | undefined,
      submittedBy: submittedBy as string | undefined,
      status: "pending_review",
      displayStatus: "Pending HR Review",
      accessToken,
    }).returning();

    // Log the submission
    await db.insert(adaInteractiveLogTable).values({
      caseId: adaCase.id,
      entryType: "employee_response",
      authorName: (submittedBy as string) ?? "Employee",
      authorRole: "employee",
      content: `Accommodation request submitted via employee portal.\n\nFunctional Limitations: ${functionalLimitations ?? "Not specified"}\n\nAccommodation Requested: ${accommodationRequested ?? "Not specified"}`,
    });

    res.status(201).json({ caseNumber, id: adaCase.id, accessToken });
  } catch (err) {
    logger.error({ err }, "ADA case create error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/ada/cases/:caseId  (HR — update status, decision, etc.)
router.patch("/ada/cases/:caseId", requireAuth, async (req: Request, res: Response) => {
  const authed = req as AuthenticatedRequest;
  const { caseId } = req.params;
  try {
    const [existing] = await db.select().from(adaCasesTable)
      .where(and(eq(adaCasesTable.id, caseId), eq(adaCasesTable.organizationId, authed.user.organizationId))).limit(1);
    if (!existing) { res.status(404).json({ error: "Case not found" }); return; }

    const allowed = ["status", "displayStatus", "decision", "decisionDate", "decisionNotes", "hardshipJustification", "assignedToUserId", "physicianCertSentAt", "physicianCertReceivedAt"];
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    for (const key of allowed) {
      if (key in req.body) updates[key] = req.body[key];
    }

    const [updated] = await db.update(adaCasesTable).set(updates).where(eq(adaCasesTable.id, caseId)).returning();
    res.json(updated);
  } catch (err) {
    logger.error({ err }, "ADA case update error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Interactive Process Log ──────────────────────────────────────────────────

// POST /api/ada/cases/:caseId/log  (add a manual log entry — HR or system)
router.post("/ada/cases/:caseId/log", requireAuth, async (req: Request, res: Response) => {
  const authed = req as AuthenticatedRequest;
  const { caseId } = req.params;
  const { entryType, content } = req.body as { entryType?: string; content?: string };

  if (!entryType || !content?.trim()) {
    res.status(400).json({ error: "entryType and content are required" });
    return;
  }

  try {
    const [adaCase] = await db.select({ id: adaCasesTable.id })
      .from(adaCasesTable)
      .where(and(eq(adaCasesTable.id, caseId), eq(adaCasesTable.organizationId, authed.user.organizationId)))
      .limit(1);
    if (!adaCase) { res.status(404).json({ error: "Case not found" }); return; }

    const [entry] = await db.insert(adaInteractiveLogTable).values({
      caseId,
      entryType,
      authorId: authed.user.sub,
      authorName: [authed.user.firstName, authed.user.lastName].filter(Boolean).join(" ") || authed.user.email,
      authorRole: "hr",
      content: content.trim(),
    }).returning();

    res.status(201).json(entry);
  } catch (err) {
    logger.error({ err }, "ADA log entry error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Ada Agent Conversation ───────────────────────────────────────────────────

// POST /api/ada/cases/:caseId/agent
router.post("/ada/cases/:caseId/agent", requireAuth, async (req: Request, res: Response) => {
  const authed = req as AuthenticatedRequest;
  const { caseId } = req.params;
  const { message, history, lookupJan } = req.body as {
    message?: string;
    history?: AdaMessage[];
    lookupJan?: boolean;
  };

  if (!message?.trim()) { res.status(400).json({ error: "message is required" }); return; }

  try {
    const [adaCase] = await db.select().from(adaCasesTable)
      .where(and(eq(adaCasesTable.id, caseId), eq(adaCasesTable.organizationId, authed.user.organizationId)))
      .limit(1);
    if (!adaCase) { res.status(404).json({ error: "Case not found" }); return; }

    const result = await runAdaTurn({
      caseData: adaCase,
      conversationHistory: history ?? [],
      userMessage: message.trim(),
      userRole: authed.user.role ?? "hr_user",
      userName: [authed.user.firstName, authed.user.lastName].filter(Boolean).join(" ") || authed.user.email,
      lookupJan,
    });

    // Log the Ada interaction to the interactive process log
    await db.insert(adaInteractiveLogTable).values([
      {
        caseId,
        entryType: "hr_note",
        authorId: authed.user.sub,
        authorName: [authed.user.firstName, authed.user.lastName].filter(Boolean).join(" ") || authed.user.email,
        authorRole: "hr",
        content: message.trim(),
      },
      {
        caseId,
        entryType: "ada_determination",
        authorName: "Ada (ADA Agent)",
        authorRole: "system",
        content: result.response,
        metadata: result.janLookupPerformed ? JSON.stringify({ janLookup: true }) : undefined,
      },
    ]);

    res.json(result);
  } catch (err) {
    logger.error({ err }, "Ada agent error");
    res.status(500).json({ error: "Failed to get Ada response" });
  }
});

// ── Physician Certification ──────────────────────────────────────────────────

// GET /api/ada/cases/:caseId/physician-cert  (generate letter preview)
router.get("/ada/cases/:caseId/physician-cert", requireAuth, async (req: Request, res: Response) => {
  const authed = req as AuthenticatedRequest;
  const { caseId } = req.params;
  try {
    const [adaCase] = await db.select().from(adaCasesTable)
      .where(and(eq(adaCasesTable.id, caseId), eq(adaCasesTable.organizationId, authed.user.organizationId)))
      .limit(1);
    if (!adaCase) { res.status(404).json({ error: "Case not found" }); return; }
    const letter = await generatePhysicianCertRequest(adaCase);
    res.json({ letter });
  } catch (err) {
    logger.error({ err }, "ADA physician cert preview error");
    res.status(500).json({ error: "Failed to generate physician certification" });
  }
});

// POST /api/ada/cases/:caseId/physician-cert  (generate + send)
router.post("/ada/cases/:caseId/physician-cert", requireAuth, async (req: Request, res: Response) => {
  const authed = req as AuthenticatedRequest;
  const { caseId } = req.params;
  const { employeeEmail, hrEmail } = req.body as { employeeEmail?: string; hrEmail?: string };

  try {
    const [adaCase] = await db.select().from(adaCasesTable)
      .where(and(eq(adaCasesTable.id, caseId), eq(adaCasesTable.organizationId, authed.user.organizationId)))
      .limit(1);
    if (!adaCase) { res.status(404).json({ error: "Case not found" }); return; }

    const certContent = await generatePhysicianCertRequest(adaCase);

    // Send email to employee with the cert form
    const recipientEmail = employeeEmail ?? adaCase.employeeEmail;
    if (recipientEmail) {
      await sendNoticeEmail({
        to: recipientEmail,
        content: certContent,
        caseNumber: adaCase.caseNumber,
        employeeNumber: adaCase.employeeNumber ?? "",
        noticeType: "ADA_PHYSICIAN_CERT",
      });
    }

    // Mark cert as sent
    await db.update(adaCasesTable).set({
      physicianCertSentAt: new Date(),
      status: "physician_cert_sent",
      displayStatus: "Physician Certification Sent",
      updatedAt: new Date(),
    }).where(eq(adaCasesTable.id, caseId));

    // Log it
    await db.insert(adaInteractiveLogTable).values({
      caseId,
      entryType: "physician_cert_sent",
      authorId: authed.user.sub,
      authorName: [authed.user.firstName, authed.user.lastName].filter(Boolean).join(" ") || authed.user.email,
      authorRole: "hr",
      content: `ADA Physician Certification form sent to ${recipientEmail ?? "employee"} on ${new Date().toLocaleDateString()}.`,
      metadata: JSON.stringify({ certContent }),
    });

    res.json({ ok: true, certContent });
  } catch (err) {
    logger.error({ err }, "ADA physician cert error");
    res.status(500).json({ error: "Failed to generate physician certification" });
  }
});

// ── Approval / Denial Letters ────────────────────────────────────────────────

// POST /api/ada/cases/:caseId/approval-letter
router.post("/ada/cases/:caseId/approval-letter", requireAuth, async (req: Request, res: Response) => {
  const authed = req as AuthenticatedRequest;
  const { caseId } = req.params;
  const { accommodations } = req.body as { accommodations?: string[] };

  if (!Array.isArray(accommodations) || accommodations.length === 0) {
    res.status(400).json({ error: "accommodations array required" });
    return;
  }

  try {
    const [adaCase] = await db.select().from(adaCasesTable)
      .where(and(eq(adaCasesTable.id, caseId), eq(adaCasesTable.organizationId, authed.user.organizationId)))
      .limit(1);
    if (!adaCase) { res.status(404).json({ error: "Case not found" }); return; }

    const letter = await generateApprovalLetter(adaCase, accommodations, [authed.user.firstName, authed.user.lastName].filter(Boolean).join(" ") || authed.user.email);
    res.json({ letter });
  } catch (err) {
    logger.error({ err }, "ADA approval letter error");
    res.status(500).json({ error: "Failed to generate letter" });
  }
});

// POST /api/ada/cases/:caseId/denial-letter
router.post("/ada/cases/:caseId/denial-letter", requireAuth, async (req: Request, res: Response) => {
  const authed = req as AuthenticatedRequest;
  const { caseId } = req.params;
  const { hardshipJustification } = req.body as { hardshipJustification?: string };

  if (!hardshipJustification?.trim()) {
    res.status(400).json({ error: "hardshipJustification required" });
    return;
  }

  try {
    const [adaCase] = await db.select().from(adaCasesTable)
      .where(and(eq(adaCasesTable.id, caseId), eq(adaCasesTable.organizationId, authed.user.organizationId)))
      .limit(1);
    if (!adaCase) { res.status(404).json({ error: "Case not found" }); return; }

    const letter = await generateDenialLetter(adaCase, hardshipJustification, [authed.user.firstName, authed.user.lastName].filter(Boolean).join(" ") || authed.user.email);
    res.json({ letter });
  } catch (err) {
    logger.error({ err }, "ADA denial letter error");
    res.status(500).json({ error: "Failed to generate letter" });
  }
});

// ── Accommodations ────────────────────────────────────────────────────────────

// POST /api/ada/cases/:caseId/accommodations  (record approved accommodations)
router.post("/ada/cases/:caseId/accommodations", requireAuth, async (req: Request, res: Response) => {
  const authed = req as AuthenticatedRequest;
  const { caseId } = req.params;
  const { description, category, startDate, endDate, isOngoing } = req.body as Record<string, unknown>;

  try {
    const [adaCase] = await db.select().from(adaCasesTable)
      .where(and(eq(adaCasesTable.id, caseId), eq(adaCasesTable.organizationId, authed.user.organizationId)))
      .limit(1);
    if (!adaCase) { res.status(404).json({ error: "Case not found" }); return; }

    const employeeName = [adaCase.employeeFirstName, adaCase.employeeLastName].filter(Boolean).join(" ") || `Employee #${adaCase.employeeNumber}`;
    const calendarLabel = `${employeeName} — Reasonable Accommodation`;

    const [accommodation] = await db.insert(approvedAccommodationsTable).values({
      caseId,
      organizationId: authed.user.organizationId!,
      description: String(description),
      category: category as string | undefined,
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      isOngoing: isOngoing !== false,
      calendarLabel,
    }).returning();

    // Log it
    await db.insert(adaInteractiveLogTable).values({
      caseId,
      entryType: "accommodation_approved",
      authorId: authed.user.sub,
      authorName: [authed.user.firstName, authed.user.lastName].filter(Boolean).join(" ") || authed.user.email,
      authorRole: "hr",
      content: `Accommodation approved: ${description}${isOngoing ? " (ongoing)" : startDate ? ` effective ${startDate}` : ""}`,
    });

    res.status(201).json(accommodation);
  } catch (err) {
    logger.error({ err }, "ADA accommodation record error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/ada/accommodations/calendar — for calendar display (legacy)
router.get("/ada/accommodations/calendar", requireAuth, async (req: Request, res: Response) => {
  const authed = req as AuthenticatedRequest;
  try {
    const accommodations = await db
      .select()
      .from(approvedAccommodationsTable)
      .where(and(
        eq(approvedAccommodationsTable.organizationId, authed.user.organizationId),
        eq(approvedAccommodationsTable.isActive, true),
      ));
    res.json({ accommodations });
  } catch (err) {
    logger.error({ err }, "ADA calendar accommodations error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/ada/calendar — enriched calendar data with caseNumber
router.get("/ada/calendar", requireAuth, async (req: Request, res: Response) => {
  const authed = req as AuthenticatedRequest;
  try {
    const rows = await db
      .select({
        id: approvedAccommodationsTable.id,
        caseId: approvedAccommodationsTable.caseId,
        description: approvedAccommodationsTable.description,
        category: approvedAccommodationsTable.category,
        startDate: approvedAccommodationsTable.startDate,
        endDate: approvedAccommodationsTable.endDate,
        isOngoing: approvedAccommodationsTable.isOngoing,
        calendarLabel: approvedAccommodationsTable.calendarLabel,
        isActive: approvedAccommodationsTable.isActive,
        caseNumber: adaCasesTable.caseNumber,
      })
      .from(approvedAccommodationsTable)
      .leftJoin(adaCasesTable, eq(approvedAccommodationsTable.caseId, adaCasesTable.id))
      .where(and(
        eq(approvedAccommodationsTable.organizationId, authed.user.organizationId!),
        eq(approvedAccommodationsTable.isActive, true),
      ));
    res.json({ accommodations: rows });
  } catch (err) {
    logger.error({ err }, "ADA calendar error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Calendar Invites ─────────────────────────────────────────────────────────

// POST /api/ada/cases/:caseId/calendar-invite
router.post("/ada/cases/:caseId/calendar-invite", requireAuth, async (req: Request, res: Response) => {
  const authed = req as AuthenticatedRequest;
  const { caseId } = req.params;
  const { title, description, scheduledAt, durationMinutes, attendeeEmails } = req.body as Record<string, unknown>;

  if (!title || !scheduledAt || !Array.isArray(attendeeEmails)) {
    res.status(400).json({ error: "title, scheduledAt, and attendeeEmails required" });
    return;
  }

  try {
    const [adaCase] = await db.select().from(adaCasesTable)
      .where(and(eq(adaCasesTable.id, caseId), eq(adaCasesTable.organizationId, authed.user.organizationId)))
      .limit(1);
    if (!adaCase) { res.status(404).json({ error: "Case not found" }); return; }

    const hrEmail = authed.user.email;
    const allAttendees = [...new Set([...attendeeEmails as string[], hrEmail])];

    const icsContent = generateIcs({
      title: String(title),
      description: description ? String(description) : `ADA Interactive Process — Case ${adaCase.caseNumber}`,
      startDate: new Date(scheduledAt as string),
      durationMinutes: durationMinutes ? Number(durationMinutes) : 30,
      organizerEmail: hrEmail,
      organizerName: [authed.user.firstName, authed.user.lastName].filter(Boolean).join(" ") || hrEmail,
      attendeeEmails: allAttendees,
    });

    // Store the invite record
    const [invite] = await db.insert(calendarInvitesTable).values({
      organizationId: authed.user.organizationId,
      caseType: "ada",
      caseId,
      caseNumber: adaCase.caseNumber,
      title: String(title),
      description: description ? String(description) : undefined,
      scheduledAt: new Date(scheduledAt as string),
      durationMinutes: durationMinutes ? String(durationMinutes) : "30",
      attendeeEmails: allAttendees.join(","),
      organizerEmail: hrEmail,
      icsGenerated: true,
    }).returning();

    // Send the .ics via email to all attendees
    for (const email of allAttendees) {
      try {
        await sendNoticeEmail({
          to: email,
          content: `You have been invited to:\n\n${title}\nDate: ${new Date(scheduledAt as string).toLocaleString()}\nDuration: ${durationMinutes ?? 30} minutes\n\nCase: ${adaCase.caseNumber}\n\n${description ?? ""}\n\nPlease open the attached .ics file to add this event to your calendar.`,
          caseNumber: adaCase.caseNumber,
          employeeNumber: adaCase.employeeNumber ?? "",
          noticeType: "CALENDAR_INVITE",
          attachments: [{ filename: "invite.ics", content: Buffer.from(icsContent).toString("base64") }],
        });
      } catch { /* best-effort */ }
    }

    await db.update(calendarInvitesTable).set({ sentAt: new Date() }).where(eq(calendarInvitesTable.id, invite.id));

    // Log to interactive process
    await db.insert(adaInteractiveLogTable).values({
      caseId,
      entryType: "follow_up_scheduled",
      authorId: authed.user.sub,
      authorName: [authed.user.firstName, authed.user.lastName].filter(Boolean).join(" ") || authed.user.email,
      authorRole: "hr",
      content: `Follow-up meeting scheduled: "${title}" on ${new Date(scheduledAt as string).toLocaleString()}. Invites sent to: ${allAttendees.join(", ")}`,
    });

    res.json({ ok: true, invite, icsContent });
  } catch (err) {
    logger.error({ err }, "ADA calendar invite error");
    res.status(500).json({ error: "Failed to create calendar invite" });
  }
});

// ── Leave Knowledge Admin (sys admin only) ───────────────────────────────────

// POST /api/ada/scrape-leave-laws  (trigger manual scrape — sys admin)
router.post("/ada/scrape-leave-laws", requireAuth, async (req: Request, res: Response) => {
  const authed = req as AuthenticatedRequest;
  if (authed.user.role !== "system_admin" && authed.user.role !== "hr_admin") {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  try {
    // Run async — respond immediately
    import("../lib/leaveKnowledgeScraper.js").then(({ runDailyScrape }) => {
      runDailyScrape().catch((err) => logger.error({ err }, "Manual leave law scrape error"));
    });
    res.json({ ok: true, message: "Scrape started in background" });
  } catch (err) {
    res.status(500).json({ error: "Failed to start scrape" });
  }
});

export default router;
