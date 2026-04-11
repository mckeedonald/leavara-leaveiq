import { Router, type IRouter, type Response } from "express";
import { eq, and, ilike, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { hrisConnectionsTable, hrisEmployeeCacheTable } from "@workspace/db/schema";
import { requireAuth, type AuthenticatedRequest } from "../lib/jwtAuth";
import { encrypt } from "../lib/crypto";
import { getAdapter } from "../lib/hris/index";
import { syncHrisEmployees } from "../lib/hris/sync";
import { logger } from "../lib/logger";
import type { HrisProvider } from "../lib/hris/types";

const router: IRouter = Router();

const VALID_PROVIDERS: HrisProvider[] = ["bamboohr", "workday", "adp", "rippling"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function requireAdmin(req: AuthenticatedRequest, res: Response<any>): boolean {
  if (req.user.role !== "admin") {
    res.status(403).json({ error: "Only organization admins can manage HRIS connections." });
    return false;
  }
  if (!req.user.organizationId) {
    res.status(403).json({ error: "No organization associated with your account." });
    return false;
  }
  return true;
}

// GET /hris/connection
router.get("/hris/connection", requireAuth, async (req, res): Promise<void> => {
  const authed = req as AuthenticatedRequest;
  if (!requireAdmin(authed, res)) return;

  const [connection] = await db
    .select({
      id: hrisConnectionsTable.id,
      provider: hrisConnectionsTable.provider,
      lastSyncAt: hrisConnectionsTable.lastSyncAt,
      createdAt: hrisConnectionsTable.createdAt,
    })
    .from(hrisConnectionsTable)
    .where(eq(hrisConnectionsTable.organizationId, authed.user.organizationId!))
    .limit(1);

  if (!connection) {
    res.status(404).json({ error: "No HRIS connection configured." });
    return;
  }

  res.json(connection);
});

// POST /hris/connection — create or update
router.post("/hris/connection", requireAuth, async (req, res): Promise<void> => {
  const authed = req as AuthenticatedRequest;
  if (!requireAdmin(authed, res)) return;

  const { provider, credentials } = req.body as { provider?: string; credentials?: Record<string, unknown> };

  if (!provider || !VALID_PROVIDERS.includes(provider as HrisProvider)) {
    res.status(400).json({ error: `Invalid provider. Must be one of: ${VALID_PROVIDERS.join(", ")}` });
    return;
  }

  if (!credentials || typeof credentials !== "object") {
    res.status(400).json({ error: "credentials must be a JSON object." });
    return;
  }

  // Test connection before saving
  try {
    const adapter = getAdapter(provider as HrisProvider, encrypt(JSON.stringify(credentials)));
    await adapter.testConnection();
  } catch (err) {
    logger.warn({ err }, "HRIS connection test failed");
    const msg = err instanceof Error ? err.message : "Connection failed";
    res.status(400).json({ error: `Connection test failed: ${msg}` });
    return;
  }

  const encryptedCreds = encrypt(JSON.stringify(credentials));
  const organizationId = authed.user.organizationId!;

  // Upsert: check if connection already exists for this org
  const [existing] = await db
    .select({ id: hrisConnectionsTable.id })
    .from(hrisConnectionsTable)
    .where(eq(hrisConnectionsTable.organizationId, organizationId))
    .limit(1);

  let connection;
  if (existing) {
    [connection] = await db
      .update(hrisConnectionsTable)
      .set({
        provider: provider as HrisProvider,
        credentials: encryptedCreds,
        updatedAt: new Date(),
      })
      .where(eq(hrisConnectionsTable.id, existing.id))
      .returning({
        id: hrisConnectionsTable.id,
        provider: hrisConnectionsTable.provider,
        lastSyncAt: hrisConnectionsTable.lastSyncAt,
        createdAt: hrisConnectionsTable.createdAt,
      });
  } else {
    [connection] = await db
      .insert(hrisConnectionsTable)
      .values({
        organizationId,
        provider: provider as HrisProvider,
        credentials: encryptedCreds,
      })
      .returning({
        id: hrisConnectionsTable.id,
        provider: hrisConnectionsTable.provider,
        lastSyncAt: hrisConnectionsTable.lastSyncAt,
        createdAt: hrisConnectionsTable.createdAt,
      });
  }

  res.status(existing ? 200 : 201).json(connection);
});

// DELETE /hris/connection
router.delete("/hris/connection", requireAuth, async (req, res): Promise<void> => {
  const authed = req as AuthenticatedRequest;
  if (!requireAdmin(authed, res)) return;

  const deleted = await db
    .delete(hrisConnectionsTable)
    .where(eq(hrisConnectionsTable.organizationId, authed.user.organizationId!))
    .returning({ id: hrisConnectionsTable.id });

  if (deleted.length === 0) {
    res.status(404).json({ error: "No HRIS connection found." });
    return;
  }

  res.json({ success: true });
});

// POST /hris/sync — trigger manual sync
router.post("/hris/sync", requireAuth, async (req, res): Promise<void> => {
  const authed = req as AuthenticatedRequest;
  if (!requireAdmin(authed, res)) return;

  const count = await syncHrisEmployees(authed.user.organizationId!);
  res.json({ synced: count });
});

// GET /hris/employees — search cached employees
router.get("/hris/employees", requireAuth, async (req, res): Promise<void> => {
  const authed = req as AuthenticatedRequest;
  if (!authed.user.organizationId) {
    res.status(403).json({ error: "No organization associated with your account." });
    return;
  }

  const q = typeof req.query["q"] === "string" ? req.query["q"].trim() : "";
  const limitParam = parseInt(String(req.query["limit"] ?? "20"), 10);
  const limit = isNaN(limitParam) || limitParam < 1 || limitParam > 100 ? 20 : limitParam;

  const orgFilter = eq(hrisEmployeeCacheTable.organizationId, authed.user.organizationId);
  const searchFilter = q ? ilike(hrisEmployeeCacheTable.fullName, `%${q}%`) : undefined;

  const employees = await db
    .select({
      id: hrisEmployeeCacheTable.id,
      externalId: hrisEmployeeCacheTable.externalId,
      fullName: hrisEmployeeCacheTable.fullName,
      personalEmail: hrisEmployeeCacheTable.personalEmail,
      hireDate: hrisEmployeeCacheTable.hireDate,
      avgHoursPerWeek: hrisEmployeeCacheTable.avgHoursPerWeek,
    })
    .from(hrisEmployeeCacheTable)
    .where(searchFilter ? and(orgFilter, searchFilter) : orgFilter)
    .orderBy(sql`lower(${hrisEmployeeCacheTable.fullName})`)
    .limit(limit);

  res.json({ employees });
});

export default router;
