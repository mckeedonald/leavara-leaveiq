import { Router, type Request, type Response } from "express";
import { db, organizationsTable, employeesTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { lookupLimiter } from "../lib/rateLimiters.js";
import { logger } from "../lib/logger.js";

const router = Router();

/** Mask an email address for safe display — e.g. jane.smith@acme.com → j***@acme.com */
function maskEmail(email: string): string {
  const atIdx = email.indexOf("@");
  if (atIdx < 0) return "***";
  const domain = email.slice(atIdx + 1);
  const firstChar = email.slice(0, 1);
  return `${firstChar}***@${domain}`;
}

/**
 * GET /api/public/employees/lookup
 * No auth required — used by the employee self-service portal.
 *
 * Query params:
 *   employeeId    — the employee's HR identifier (employees.employee_id column)
 *   org           — the org slug (same ?org= param used by case creation)
 *   captchaToken  — reCAPTCHA v3 token (verified if RECAPTCHA_SECRET_KEY is set)
 *
 * Returns:
 *   { found: false }
 *   { found: true, fullName: string, emailMasked: string | null }
 *
 * Security: only fullName + a masked email are returned. No other fields.
 * Full email is never sent to the client — case creation falls back to the
 * employees table to retrieve it when employeeEmail is absent from the payload.
 */
router.get("/public/employees/lookup", lookupLimiter, async (req: Request, res: Response): Promise<void> => {
  const { employeeId, org, captchaToken } = req.query as {
    employeeId?: string;
    org?: string;
    captchaToken?: string;
  };

  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
    ?? req.ip
    ?? req.socket?.remoteAddress
    ?? "unknown";

  // ── CAPTCHA verification ──────────────────────────────────────────────────
  // Fail-open: if no token is sent (e.g. reCAPTCHA script not yet loaded),
  // the rate limiter is still the primary protection. We only reject when a
  // token IS provided but scores below the threshold (i.e. confirmed bot).
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;
  if (secretKey && captchaToken) {
    try {
      const verifyRes = await fetch(
        `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${captchaToken}`,
        { method: "POST" }
      );
      const verifyData = await verifyRes.json() as { success: boolean; score?: number; action?: string };
      if (!verifyData.success || (verifyData.score ?? 1) < 0.5) {
        logger.warn({ ip, org, score: verifyData.score }, "Portal lookup blocked: CAPTCHA score too low");
        res.status(429).json({ found: false, error: "CAPTCHA verification failed." });
        return;
      }
    } catch (err) {
      // CAPTCHA service unreachable — proceed so employees aren't blocked
      logger.warn({ err, ip }, "CAPTCHA verification request failed — proceeding without verification");
    }
  }

  // ── Input validation ──────────────────────────────────────────────────────
  if (!employeeId?.trim() || !org?.trim()) {
    res.json({ found: false });
    return;
  }

  try {
    // Resolve org by slug
    const [organization] = await db
      .select({ id: organizationsTable.id })
      .from(organizationsTable)
      .where(eq(organizationsTable.slug, org.trim()))
      .limit(1);

    if (!organization) {
      logger.info({ org: org.trim(), ip, found: false }, "Portal employee lookup: org not found");
      res.json({ found: false });
      return;
    }

    // Build flexible ID candidate list — handles various formats employees might enter:
    //   "EMP007"  → tries "EMP007", "007", "EMP-007"
    //   "EMP-007" → tries "EMP-007", "007", "EMP-007" (deduped)
    //   "007"     → tries "007", "EMP-007"
    const idRaw = employeeId.trim();
    const idStripped = idRaw.replace(/^EMP-?/i, ""); // strip EMP- or EMP prefix
    const idWithDash = `EMP-${idStripped}`;
    const idWithoutDash = `EMP${idStripped}`;
    const candidates = [...new Set([idRaw, idStripped, idWithDash, idWithoutDash])].filter(Boolean);

    // Look up active employee — try all candidate ID formats in one query
    const [employee] = await db
      .select({
        fullName: employeesTable.fullName,
        workEmail: employeesTable.workEmail,
        personalEmail: employeesTable.personalEmail,
      })
      .from(employeesTable)
      .where(
        and(
          eq(employeesTable.organizationId, organization.id),
          inArray(employeesTable.employeeId, candidates),
          eq(employeesTable.isActive, true)
        )
      )
      .limit(1);

    if (!employee) {
      // Log the queried employeeId on not-found — useful for detecting sequential probing
      logger.info(
        { org: org.trim(), employeeId: employeeId.trim(), ip, found: false },
        "Portal employee lookup: not found"
      );
      res.json({ found: false });
      return;
    }

    // Found — omit employeeId from log to avoid PII correlation (name is enough context)
    logger.info({ org: org.trim(), ip, found: true }, "Portal employee lookup: found");

    // Prefer personal email; fall back to work email
    const rawEmail = employee.personalEmail || employee.workEmail || null;
    const emailMasked = rawEmail ? maskEmail(rawEmail) : null;

    // Return masked email only — full email is never sent to the client
    res.json({ found: true, fullName: employee.fullName, emailMasked });
  } catch (err) {
    logger.error({ err, ip }, "Portal employee lookup error");
    // Fail silently — the portal handles not-found gracefully
    res.json({ found: false });
  }
});

export default router;
