import { Router, type Request, type Response } from "express";
import { db, employeesTable, employeeImportLogTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { requireAuth, requireHrAdmin, type AuthenticatedRequest } from "../lib/jwtAuth.js";
import { parse as csvParse } from "csv-parse/sync";

const router = Router();

// GET /api/employees — list all employees for the org
router.get("/employees", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { organizationId } = (req as AuthenticatedRequest).user;
  if (!organizationId) { res.status(403).json({ error: "No organization" }); return; }

  const employees = await db
    .select()
    .from(employeesTable)
    .where(and(eq(employeesTable.organizationId, organizationId), eq(employeesTable.isActive, true)));

  res.json({ employees });
});

// GET /api/employees/import-log — list import history for the org
router.get("/employees/import-log", requireHrAdmin, async (req: Request, res: Response): Promise<void> => {
  const { organizationId } = (req as AuthenticatedRequest).user;
  if (!organizationId) { res.status(403).json({ error: "No organization" }); return; }

  const { desc: descImport } = await import("drizzle-orm");
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
    .where(eq(employeeImportLogTable.organizationId, organizationId))
    .orderBy(descImport(employeeImportLogTable.createdAt))
    .limit(50);

  res.json({ logs });
});

// GET /api/employees/import-log/:logId/errors — download error CSV for a specific import
router.get("/employees/import-log/:logId/errors", requireHrAdmin, async (req: Request, res: Response): Promise<void> => {
  const { organizationId } = (req as AuthenticatedRequest).user;
  if (!organizationId) { res.status(403).json({ error: "No organization" }); return; }

  const { logId } = req.params;
  const [log] = await db
    .select({ errorCsv: employeeImportLogTable.errorCsv, organizationId: employeeImportLogTable.organizationId })
    .from(employeeImportLogTable)
    .where(eq(employeeImportLogTable.id, logId))
    .limit(1);

  if (!log || log.organizationId !== organizationId) {
    res.status(404).json({ error: "Log not found" });
    return;
  }

  if (!log.errorCsv) {
    res.status(404).json({ error: "No errors for this import" });
    return;
  }

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="import_errors_${logId.slice(0, 8)}.csv"`);
  res.send(log.errorCsv);
});

// GET /api/employees/hierarchy — all employees the requesting manager can see (full hierarchy)
router.get("/employees/hierarchy", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { organizationId, sub: userId } = (req as AuthenticatedRequest).user;
  if (!organizationId) { res.status(403).json({ error: "No organization" }); return; }

  // Find the employee record linked to this user
  const [managerEmployee] = await db
    .select({ id: employeesTable.id })
    .from(employeesTable)
    .where(and(eq(employeesTable.organizationId, organizationId), eq(employeesTable.linkedUserId, userId)))
    .limit(1);

  if (!managerEmployee) {
    // HR users/admins see all employees
    const all = await db
      .select()
      .from(employeesTable)
      .where(and(eq(employeesTable.organizationId, organizationId), eq(employeesTable.isActive, true)));
    res.json({ employees: all });
    return;
  }

  // Recursive CTE to get full reporting hierarchy under this manager
  const result = await db.execute(`
    WITH RECURSIVE hierarchy AS (
      SELECT id, full_name, position, location, department, manager_id, manager_name,
             start_date, avg_hours_worked, work_email, is_active, linked_user_id, data_source
      FROM employee
      WHERE organization_id = $1 AND manager_id = $2 AND is_active = true
      UNION ALL
      SELECT e.id, e.full_name, e.position, e.location, e.department, e.manager_id, e.manager_name,
             e.start_date, e.avg_hours_worked, e.work_email, e.is_active, e.linked_user_id, e.data_source
      FROM employee e
      INNER JOIN hierarchy h ON e.manager_id = h.id
      WHERE e.organization_id = $1 AND e.is_active = true
    )
    SELECT * FROM hierarchy
  `, [organizationId, managerEmployee.id]);

  res.json({ employees: result.rows });
});

/**
 * Shared CSV upload logic — used by both HR Admin and super admin routes.
 * Returns import result and error CSV (if any).
 */
export async function processCsvUpload(params: {
  organizationId: string;
  csv: string;
  filename?: string;
  uploadedBy?: string;
}): Promise<{
  inserted: number;
  updated: number;
  errors: number;
  totalRows: number;
  status: "success" | "partial" | "failed";
  errorCsv: string | null;
}> {
  const { organizationId, csv, filename, uploadedBy } = params;

  // Parse CSV
  let rows: Record<string, string>[];
  rows = csvParse(csv, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];

  const errorRows: string[] = [];
  const errorHeaders = "row,employee_name,employee_id,field,error,how_to_fix";

  // Validate and parse rows
  interface ParsedRow {
    rowNum: number;
    fullName: string;
    employeeId: string | null;
    position: string | null;
    location: string | null;
    department: string | null;
    managerName: string | null;
    startDate: string | null;
    avgHours: string | null;
    workEmail: string | null;
    personalEmail: string | null;
  }

  const parsed: ParsedRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // 1-based, +1 for header
    const fullName = (row["employee_name"] ?? "").trim();
    const employeeId = row["employee_id"]?.trim() || null;
    let hasError = false;

    if (!fullName) {
      errorRows.push(`${rowNum},"","${employeeId ?? ""}","employee_name","Missing required field","Add the employee's full name"`);
      hasError = true;
    }

    // Validate start_date
    const rawDate = row["start_date"]?.trim() || null;
    let startDate: string | null = null;
    if (rawDate) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
        startDate = rawDate;
      } else {
        errorRows.push(`${rowNum},"${fullName}","${employeeId ?? ""}","start_date","Invalid date format: ${rawDate}","Use YYYY-MM-DD format (e.g. 2023-03-15)"`);
        hasError = true;
      }
    }

    // Validate emails
    const workEmail = row["work_email"]?.trim() || null;
    const personalEmail = row["personal_email"]?.trim() || null;
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (workEmail && !emailRe.test(workEmail)) {
      errorRows.push(`${rowNum},"${fullName}","${employeeId ?? ""}","work_email","Invalid email: ${workEmail}","Correct the email address format"`);
      hasError = true;
    }
    if (personalEmail && !emailRe.test(personalEmail)) {
      errorRows.push(`${rowNum},"${fullName}","${employeeId ?? ""}","personal_email","Invalid email: ${personalEmail}","Correct the email address format"`);
      hasError = true;
    }

    if (!hasError) {
      parsed.push({
        rowNum,
        fullName,
        employeeId,
        position: row["position"]?.trim() || null,
        location: row["location"]?.trim() || null,
        department: row["department"]?.trim() || null,
        managerName: row["manager_name"]?.trim() || null,
        startDate,
        avgHours: row["avg_hours_worked"]?.trim() || null,
        workEmail,
        personalEmail,
      });
    }
  }

  if (parsed.length === 0) {
    const errorCsv = [errorHeaders, ...errorRows].join("\n");
    await db.insert(employeeImportLogTable).values({
      organizationId,
      filename: filename ?? null,
      uploadedBy: uploadedBy ?? null,
      totalRows: rows.length,
      inserted: 0,
      updated: 0,
      errors: errorRows.length,
      status: "failed",
      errorCsv: errorRows.length > 0 ? errorCsv : null,
    });
    return {
      inserted: 0, updated: 0, errors: errorRows.length,
      totalRows: rows.length, status: "failed",
      errorCsv: errorRows.length > 0 ? errorCsv : null,
    };
  }

  // BATCH STRATEGY:
  // 1. Fetch all existing employees for the org in one query
  // 2. Build lookup maps: employeeId → id, fullName → id
  // 3. Classify rows as insert vs update
  // 4. Bulk insert all new rows at once
  // 5. Batch update existing rows inside a transaction
  // 6. Second pass: resolve manager IDs in batch

  const existing = await db
    .select({ id: employeesTable.id, employeeId: employeesTable.employeeId, fullName: employeesTable.fullName })
    .from(employeesTable)
    .where(eq(employeesTable.organizationId, organizationId));

  const byEmployeeId = new Map<string, string>(); // employeeId → uuid
  const byFullName = new Map<string, string>();    // fullName.lower → uuid
  for (const e of existing) {
    if (e.employeeId) byEmployeeId.set(e.employeeId.toLowerCase(), e.id);
    byFullName.set(e.fullName.toLowerCase(), e.id);
  }

  const now = new Date();
  const toInsert: (typeof parsed[0] & { id?: string })[] = [];
  const toUpdate: { id: string; row: typeof parsed[0] }[] = [];

  for (const row of parsed) {
    const existingId = row.employeeId
      ? byEmployeeId.get(row.employeeId.toLowerCase())
      : byFullName.get(row.fullName.toLowerCase());

    if (existingId) {
      toUpdate.push({ id: existingId, row });
    } else {
      toInsert.push(row);
    }
  }

  // Bulk insert
  const insertedIds = new Map<string, string>(); // fullName.lower → new uuid
  if (toInsert.length > 0) {
    const inserted = await db.insert(employeesTable).values(
      toInsert.map((row) => ({
        organizationId,
        fullName: row.fullName,
        employeeId: row.employeeId,
        position: row.position,
        location: row.location,
        department: row.department,
        managerName: row.managerName,
        startDate: row.startDate ?? undefined,
        avgHoursWorked: row.avgHours ?? undefined,
        workEmail: row.workEmail ?? undefined,
        personalEmail: row.personalEmail ?? undefined,
        dataSource: "csv" as const,
        lastSyncAt: now,
      }))
    ).returning({ id: employeesTable.id, fullName: employeesTable.fullName });
    for (const r of inserted) {
      insertedIds.set(r.fullName.toLowerCase(), r.id);
    }
  }

  // Batch updates inside a transaction
  if (toUpdate.length > 0) {
    await db.transaction(async (tx: typeof db) => {
      for (const { id, row } of toUpdate) {
        await tx.update(employeesTable).set({
          fullName: row.fullName,
          employeeId: row.employeeId,
          position: row.position,
          location: row.location,
          department: row.department,
          managerName: row.managerName,
          startDate: row.startDate ?? undefined,
          avgHoursWorked: row.avgHours ?? undefined,
          workEmail: row.workEmail ?? undefined,
          personalEmail: row.personalEmail ?? undefined,
          dataSource: "csv" as const,
          lastSyncAt: now,
          updatedAt: now,
        }).where(eq(employeesTable.id, id));
      }
    });
  }

  // Build full name → id map (existing + newly inserted)
  const allById = new Map<string, string>();
  for (const e of existing) allById.set(e.fullName.toLowerCase(), e.id);
  for (const [name, id] of insertedIds) allById.set(name, id);
  // Also add updates to map (they already exist in byFullName)
  for (const { id, row } of toUpdate) allById.set(row.fullName.toLowerCase(), id);

  // Second pass: resolve manager IDs in batch
  const managerUpdates: { id: string; managerId: string }[] = [];
  for (const row of parsed) {
    if (!row.managerName) continue;
    const managerId = allById.get(row.managerName.toLowerCase());
    if (!managerId) continue;
    const employeeRowId = row.employeeId
      ? (byEmployeeId.get(row.employeeId.toLowerCase()) ?? insertedIds.get(row.fullName.toLowerCase()))
      : (byFullName.get(row.fullName.toLowerCase()) ?? insertedIds.get(row.fullName.toLowerCase()));
    if (employeeRowId && employeeRowId !== managerId) {
      managerUpdates.push({ id: employeeRowId, managerId });
    }
  }

  if (managerUpdates.length > 0) {
    await db.transaction(async (tx: typeof db) => {
      for (const { id, managerId } of managerUpdates) {
        await tx.update(employeesTable).set({ managerId }).where(eq(employeesTable.id, id));
      }
    });
  }

  const totalErrors = errorRows.length;
  const status: "success" | "partial" | "failed" =
    totalErrors === 0 ? "success" : parsed.length > 0 ? "partial" : "failed";
  const errorCsv = totalErrors > 0 ? [errorHeaders, ...errorRows].join("\n") : null;

  // Record import log
  await db.insert(employeeImportLogTable).values({
    organizationId,
    filename: filename ?? null,
    uploadedBy: uploadedBy ?? null,
    totalRows: rows.length,
    inserted: toInsert.length,
    updated: toUpdate.length,
    errors: totalErrors,
    status,
    errorCsv,
  });

  return {
    inserted: toInsert.length,
    updated: toUpdate.length,
    errors: totalErrors,
    totalRows: rows.length,
    status,
    errorCsv,
  };
}

/**
 * POST /api/employees/csv-upload
 * HR Admin uploads employees for their own organization.
 */
router.post("/employees/csv-upload", requireHrAdmin, async (req: Request, res: Response): Promise<void> => {
  const { organizationId, email } = (req as AuthenticatedRequest).user;
  if (!organizationId) { res.status(403).json({ error: "No organization" }); return; }

  const body = req.body as { csv?: string; filename?: string };
  if (!body.csv?.trim()) {
    res.status(400).json({ error: "CSV data is required in body.csv" });
    return;
  }

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
    organizationId,
    csv: body.csv,
    filename: body.filename,
    uploadedBy: email ?? "hr_admin",
  });

  res.json(result);
});

export default router;
