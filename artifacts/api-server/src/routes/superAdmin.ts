import { Router, type IRouter, type Request, type Response } from "express";
import { eq, desc, isNull, isNotNull, and, count, like, gte, lte } from "drizzle-orm";
import { db, usersTable, organizationsTable, leaveCasesTable, piqUsersTable, auditLogTable, hrisConnectionsTable, employeeImportLogTable } from "@workspace/db";
import { requireSuperAdmin } from "../lib/jwtAuth";
import { sendWelcomeEmail } from "../lib/email";
import bcrypt from "bcryptjs";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { processCsvUpload } from "./employees.js";
import { encrypt } from "../lib/crypto.js";
import { getAdapter } from "../lib/hris/index.js";
import { syncHrisEmployees } from "../lib/hris/sync.js";
import type { HrisProvider } from "../lib/hris/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router: IRouter = Router();

// GET /superadmin/organizations
router.get("/superadmin/organizations", requireSuperAdmin, async (_req: Request, res: Response): Promise<void> => {
  const orgs = await db
    .select()
    .from(organizationsTable)
    .orderBy(organizationsTable.name);

  const counts = await Promise.all(
    orgs.map(async (org) => {
      const [userRow] = await db
        .select({ value: count() })
        .from(usersTable)
        .where(eq(usersTable.organizationId, org.id));
      const [caseRow] = await db
        .select({ value: count() })
        .from(leaveCasesTable)
        .where(and(eq(leaveCasesTable.organizationId, org.id), isNull(leaveCasesTable.deletedAt)));
      return { orgId: org.id, userCount: userRow?.value ?? 0, caseCount: caseRow?.value ?? 0 };
    }),
  );

  const enriched = orgs.map((org) => {
    const c = counts.find((x) => x.orgId === org.id);
    return { ...org, userCount: c?.userCount ?? 0, caseCount: c?.caseCount ?? 0 };
  });

  res.json({ organizations: enriched });
});

// POST /superadmin/organizations
router.post("/superadmin/organizations", requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  const { name, slug } = req.body as { name?: string; slug?: string };

  if (!name?.trim() || !slug?.trim()) {
    res.status(400).json({ error: "Name and slug are required" });
    return;
  }

  const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");

  const [existing] = await db
    .select({ id: organizationsTable.id })
    .from(organizationsTable)
    .where(eq(organizationsTable.slug, cleanSlug));

  if (existing) {
    res.status(409).json({ error: "An organization with this slug already exists" });
    return;
  }

  const [org] = await db
    .insert(organizationsTable)
    .values({ name: name.trim(), slug: cleanSlug, isActive: true })
    .returning();

  res.status(201).json({ organization: org });
});

// PATCH /superadmin/organizations/:orgId
router.patch("/superadmin/organizations/:orgId", requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  const { orgId } = req.params;
  const { isActive, name, hasPerformIq, hasLeaveIq } = req.body as { isActive?: boolean; name?: string; hasPerformIq?: boolean; hasLeaveIq?: boolean };

  const updates: Record<string, unknown> = {};
  if (typeof isActive === "boolean") updates.isActive = isActive;
  if (name?.trim()) updates.name = name.trim();
  if (typeof hasPerformIq === "boolean") updates.hasPerformIq = hasPerformIq;
  if (typeof hasLeaveIq === "boolean") updates.hasLeaveIq = hasLeaveIq;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No valid fields to update" });
    return;
  }

  const [updated] = await db
    .update(organizationsTable)
    .set(updates)
    .where(eq(organizationsTable.id, orgId))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Organization not found" });
    return;
  }

  res.json({ organization: updated });
});

// GET /superadmin/organizations/:orgId/users
router.get("/superadmin/organizations/:orgId/users", requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  const { orgId } = req.params;

  const users = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      position: usersTable.position,
      role: usersTable.role,
      isActive: usersTable.isActive,
      isSuperAdmin: usersTable.isSuperAdmin,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .where(eq(usersTable.organizationId, orgId))
    .orderBy(usersTable.createdAt);

  res.json({ users });
});

// PATCH /superadmin/users/:userId
router.patch("/superadmin/users/:userId", requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  const { userId } = req.params;
  const { isActive, role } = req.body as { isActive?: boolean; role?: string };

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof isActive === "boolean") updates.isActive = isActive;
  if (role === "admin" || role === "user") updates.role = role;

  const [updated] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, userId))
    .returning({ id: usersTable.id });

  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({ message: "User updated" });
});

// POST /superadmin/organizations/:orgId/users — create an admin user for an org
router.post("/superadmin/organizations/:orgId/users", requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  const { orgId } = req.params;
  const { email, firstName, lastName, position, role, password } = req.body as {
    email?: string; firstName?: string; lastName?: string;
    position?: string; role?: string; password?: string;
  };

  if (!email || !firstName || !lastName || !position || !password) {
    res.status(400).json({ error: "All fields are required" });
    return;
  }

  const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email.toLowerCase().trim()));
  if (existing) {
    res.status(409).json({ error: "A user with this email already exists" });
    return;
  }

  const [org] = await db
    .select({ name: organizationsTable.name })
    .from(organizationsTable)
    .where(eq(organizationsTable.id, orgId));

  const passwordHash = await bcrypt.hash(password, 12);
  const [newUser] = await db.insert(usersTable).values({
    organizationId: orgId,
    email: email.toLowerCase().trim(),
    passwordHash,
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    position: position.trim(),
    role: role === "admin" ? "admin" : "user",
  }).returning({
    id: usersTable.id,
    email: usersTable.email,
    firstName: usersTable.firstName,
    lastName: usersTable.lastName,
    role: usersTable.role,
    isActive: usersTable.isActive,
  });

  sendWelcomeEmail({
    to: email.toLowerCase().trim(),
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    orgName: org?.name ?? "your organization",
    password,
  }).catch((err) => req.log.error({ err }, "Failed to send welcome email"));

  res.status(201).json({ user: newUser });
});

// POST /superadmin/organizations/:orgId/piq-users — create a PerformIQ user for an org
router.post("/superadmin/organizations/:orgId/piq-users", requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  const { orgId } = req.params;
  const { email, fullName, role, password } = req.body as {
    email?: string; fullName?: string; role?: string; password?: string;
  };

  if (!email || !fullName || !password) {
    res.status(400).json({ error: "Email, full name, and password are required" });
    return;
  }

  const [org] = await db
    .select({ id: organizationsTable.id, hasPerformIq: organizationsTable.hasPerformIq })
    .from(organizationsTable)
    .where(eq(organizationsTable.id, orgId));

  if (!org) {
    res.status(404).json({ error: "Organization not found" });
    return;
  }

  if (!org.hasPerformIq) {
    res.status(400).json({ error: "This organization does not have PerformIQ enabled. Enable it first." });
    return;
  }

  const [existing] = await db
    .select({ id: piqUsersTable.id })
    .from(piqUsersTable)
    .where(eq(piqUsersTable.email, email.toLowerCase().trim()));

  if (existing) {
    res.status(409).json({ error: "A PerformIQ user with this email already exists" });
    return;
  }

  const validRoles = ["hr_admin", "hr_user", "manager", "supervisor", "system_admin"];
  const assignedRole = validRoles.includes(role ?? "") ? (role as "hr_admin") : "hr_admin";

  const passwordHash = await bcrypt.hash(password, 12);
  const [newUser] = await db.insert(piqUsersTable).values({
    organizationId: orgId,
    email: email.toLowerCase().trim(),
    passwordHash,
    fullName: fullName.trim(),
    role: assignedRole,
    isActive: true,
  }).returning({
    id: piqUsersTable.id,
    email: piqUsersTable.email,
    fullName: piqUsersTable.fullName,
    role: piqUsersTable.role,
    isActive: piqUsersTable.isActive,
  });

  res.status(201).json({ user: newUser });
});

// GET /superadmin/cases?orgId=&includeDeleted=true
router.get("/superadmin/cases", requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  const { orgId, includeDeleted } = req.query as { orgId?: string; includeDeleted?: string };

  const showDeleted = includeDeleted === "true";

  let query = db.select().from(leaveCasesTable).$dynamic();

  const filters = [];
  if (orgId) filters.push(eq(leaveCasesTable.organizationId, orgId));
  if (showDeleted) {
    filters.push(isNotNull(leaveCasesTable.deletedAt));
  } else {
    filters.push(isNull(leaveCasesTable.deletedAt));
  }

  if (filters.length > 0) {
    query = query.where(and(...(filters as [ReturnType<typeof eq>])));
  }

  const cases = await query.orderBy(desc(leaveCasesTable.updatedAt)).limit(200);
  res.json({ cases });
});

// POST /superadmin/cases/:caseId/restore
router.post("/superadmin/cases/:caseId/restore", requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  const { caseId } = req.params;

  const [leaveCase] = await db
    .select()
    .from(leaveCasesTable)
    .where(eq(leaveCasesTable.id, caseId));

  if (!leaveCase) {
    res.status(404).json({ error: "Case not found" });
    return;
  }

  if (!leaveCase.deletedAt) {
    res.status(409).json({ error: "Case is not deleted" });
    return;
  }

  const [restored] = await db
    .update(leaveCasesTable)
    .set({ deletedAt: null, deletedReason: null, updatedAt: new Date() })
    .where(eq(leaveCasesTable.id, caseId))
    .returning();

  res.json({ case: restored });
});

// GET /superadmin/organizations/:orgId/audit
router.get("/superadmin/organizations/:orgId/audit", requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  const { orgId } = req.params;
  const { action, actor, caseId, startDate, endDate, page } = req.query as Record<string, string | undefined>;
  const pageNum = Math.max(1, parseInt(page ?? "1") || 1);
  const limit = 200;
  const offset = (pageNum - 1) * limit;

  const entries = await db
    .select({
      id: auditLogTable.id,
      action: auditLogTable.action,
      actor: auditLogTable.actor,
      entityId: auditLogTable.entityId,
      metadata: auditLogTable.metadata,
      createdAt: auditLogTable.createdAt,
      caseNumber: leaveCasesTable.caseNumber,
      employeeFirstName: leaveCasesTable.employeeFirstName,
      employeeLastName: leaveCasesTable.employeeLastName,
    })
    .from(auditLogTable)
    .innerJoin(leaveCasesTable, eq(auditLogTable.entityId, leaveCasesTable.id))
    .where(and(
      eq(leaveCasesTable.organizationId, orgId),
      caseId ? eq(auditLogTable.entityId, caseId) : undefined,
      action ? like(auditLogTable.action, `%${action}%`) : undefined,
      actor ? like(auditLogTable.actor, `%${actor}%`) : undefined,
      startDate ? gte(auditLogTable.createdAt, new Date(startDate)) : undefined,
      endDate ? lte(auditLogTable.createdAt, new Date(endDate)) : undefined,
    ))
    .orderBy(desc(auditLogTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json({ entries, page: pageNum, limit });
});

// GET /superadmin/organizations/:orgId/audit/export
router.get("/superadmin/organizations/:orgId/audit/export", requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  const { orgId } = req.params;
  const { startDate, endDate } = req.query as Record<string, string | undefined>;

  const entries = await db
    .select({
      id: auditLogTable.id,
      action: auditLogTable.action,
      actor: auditLogTable.actor,
      entityId: auditLogTable.entityId,
      createdAt: auditLogTable.createdAt,
      caseNumber: leaveCasesTable.caseNumber,
      employeeFirstName: leaveCasesTable.employeeFirstName,
      employeeLastName: leaveCasesTable.employeeLastName,
    })
    .from(auditLogTable)
    .innerJoin(leaveCasesTable, eq(auditLogTable.entityId, leaveCasesTable.id))
    .where(and(
      eq(leaveCasesTable.organizationId, orgId),
      startDate ? gte(auditLogTable.createdAt, new Date(startDate)) : undefined,
      endDate ? lte(auditLogTable.createdAt, new Date(endDate)) : undefined,
    ))
    .orderBy(desc(auditLogTable.createdAt))
    .limit(5000);

  // Build CSV
  const header = "id,action,actor,case_number,employee_name,timestamp\n";
  const rows = entries.map(e =>
    [e.id, e.action, e.actor, e.caseNumber, `${e.employeeFirstName ?? ""} ${e.employeeLastName ?? ""}`.trim(), e.createdAt.toISOString()]
      .map(v => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  ).join("\n");

  const orgRow = await db.select({ name: organizationsTable.name }).from(organizationsTable).where(eq(organizationsTable.id, orgId)).limit(1);
  const orgName = orgRow[0]?.name ?? orgId;
  const filename = `audit_${orgName.toLowerCase().replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.csv`;

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(header + rows);
});

const VALID_PROVIDERS: HrisProvider[] = ["bamboohr", "workday", "adp", "rippling"];

// GET /superadmin/organizations/:orgId/hris — get HRIS connection for an org
router.get("/superadmin/organizations/:orgId/hris", requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  const { orgId } = req.params;
  const [connection] = await db
    .select({
      id: hrisConnectionsTable.id,
      provider: hrisConnectionsTable.provider,
      lastSyncAt: hrisConnectionsTable.lastSyncAt,
      createdAt: hrisConnectionsTable.createdAt,
    })
    .from(hrisConnectionsTable)
    .where(eq(hrisConnectionsTable.organizationId, orgId))
    .limit(1);
  res.json({ connection: connection ?? null });
});

// POST /superadmin/organizations/:orgId/hris — create or update HRIS connection
router.post("/superadmin/organizations/:orgId/hris", requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  const { orgId } = req.params;
  const { provider, credentials } = req.body as { provider?: string; credentials?: Record<string, unknown> };

  if (!provider || !VALID_PROVIDERS.includes(provider as HrisProvider)) {
    res.status(400).json({ error: `Invalid provider. Must be one of: ${VALID_PROVIDERS.join(", ")}` });
    return;
  }
  if (!credentials || typeof credentials !== "object") {
    res.status(400).json({ error: "credentials must be a JSON object" });
    return;
  }

  try {
    const adapter = getAdapter(provider as HrisProvider, encrypt(JSON.stringify(credentials)));
    await adapter.testConnection();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Connection failed";
    res.status(400).json({ error: `Connection test failed: ${msg}` });
    return;
  }

  const encryptedCreds = encrypt(JSON.stringify(credentials));
  const [existing] = await db.select({ id: hrisConnectionsTable.id }).from(hrisConnectionsTable).where(eq(hrisConnectionsTable.organizationId, orgId)).limit(1);

  let connection;
  if (existing) {
    [connection] = await db.update(hrisConnectionsTable).set({ provider: provider as HrisProvider, credentials: encryptedCreds, updatedAt: new Date() })
      .where(eq(hrisConnectionsTable.id, existing.id))
      .returning({ id: hrisConnectionsTable.id, provider: hrisConnectionsTable.provider, lastSyncAt: hrisConnectionsTable.lastSyncAt, createdAt: hrisConnectionsTable.createdAt });
  } else {
    [connection] = await db.insert(hrisConnectionsTable).values({ organizationId: orgId, provider: provider as HrisProvider, credentials: encryptedCreds })
      .returning({ id: hrisConnectionsTable.id, provider: hrisConnectionsTable.provider, lastSyncAt: hrisConnectionsTable.lastSyncAt, createdAt: hrisConnectionsTable.createdAt });
  }

  res.status(existing ? 200 : 201).json({ connection });
});

// DELETE /superadmin/organizations/:orgId/hris
router.delete("/superadmin/organizations/:orgId/hris", requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  const { orgId } = req.params;
  const deleted = await db.delete(hrisConnectionsTable).where(eq(hrisConnectionsTable.organizationId, orgId)).returning({ id: hrisConnectionsTable.id });
  if (deleted.length === 0) {
    res.status(404).json({ error: "No HRIS connection found" });
    return;
  }
  res.json({ success: true });
});

// POST /superadmin/organizations/:orgId/hris/sync — trigger HRIS sync
router.post("/superadmin/organizations/:orgId/hris/sync", requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  const orgId = String(req.params["orgId"]);
  try {
    const synced = await syncHrisEmployees(orgId);
    res.json({ synced });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Sync failed";
    res.status(400).json({ error: msg });
  }
});

// POST /superadmin/organizations/:orgId/employees/csv-upload — upload employees for an org
router.post("/superadmin/organizations/:orgId/employees/csv-upload", requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  const orgId = String(req.params["orgId"]);
  const body = req.body as { csv?: string; filename?: string };

  if (!body.csv?.trim()) {
    res.status(400).json({ error: "CSV data is required in body.csv" });
    return;
  }

  const { parse: csvParse } = await import("csv-parse/sync");
  let rows: Record<string, string>[];
  try {
    rows = csvParse(body.csv, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];
  } catch {
    res.status(400).json({ error: "Invalid CSV format" });
    return;
  }
  if (!rows[0] || !("employee_name" in rows[0])) {
    res.status(400).json({ error: "CSV must include column: employee_name" });
    return;
  }

  const result = await processCsvUpload({
    organizationId: orgId,
    csv: body.csv,
    filename: body.filename,
    uploadedBy: "super_admin",
  });

  res.json(result);
});

// GET /superadmin/organizations/:orgId/employees/import-log — import log for an org
router.get("/superadmin/organizations/:orgId/employees/import-log", requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  const { orgId } = req.params;
  const logs = await db
    .select({
      id: employeeImportLogTable.id,
      filename: employeeImportLogTable.filename,
      uploadedBy: employeeImportLogTable.uploadedBy,
      totalRows: employeeImportLogTable.totalRows,
      inserted: employeeImportLogTable.inserted,
      updated: employeeImportLogTable.updated,
      errors: employeeImportLogTable.errors,
      status: employeeImportLogTable.status,
      createdAt: employeeImportLogTable.createdAt,
    })
    .from(employeeImportLogTable)
    .where(eq(employeeImportLogTable.organizationId, orgId))
    .orderBy(desc(employeeImportLogTable.createdAt))
    .limit(50);
  res.json({ logs });
});

// GET /superadmin/prd — serve the living PRD markdown document
router.get("/superadmin/prd", requireSuperAdmin, (_req: Request, res: Response): void => {
  try {
    // Bundle output is dist/index.mjs (single file), so __dirname = artifacts/api-server/dist/
    // 3 levels up from dist/ → repo root, then docs/PRD.md
    const prdPath = join(__dirname, "..", "..", "..", "docs", "PRD.md");
    const content = readFileSync(prdPath, "utf-8");
    res.json({ content });
  } catch {
    res.status(404).json({ error: "PRD document not found" });
  }
});

export default router;
