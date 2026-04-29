import { Router, type Request, type Response } from "express";
import { db, employeesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
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
 * POST /api/employees/csv-upload
 * Accepts a CSV with columns:
 *   employee_name, employee_id, position, location, department,
 *   manager_name, start_date, avg_hours_worked, work_email, personal_email
 *
 * Upserts employees by employee_id (or full_name if no ID).
 * Resolves managerId by matching manager_name to existing employees in the same upload.
 * Data uploaded here is shared between LeaveIQ and PerformIQ (same employees table).
 */
router.post("/employees/csv-upload", requireHrAdmin, async (req: Request, res: Response): Promise<void> => {
  const { organizationId } = (req as AuthenticatedRequest).user;
  if (!organizationId) { res.status(403).json({ error: "No organization" }); return; }

  const body = req.body as { csv?: string };
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

  const required = ["employee_name"];
  for (const col of required) {
    if (!rows[0] || !(col in rows[0])) {
      res.status(400).json({ error: `CSV must include column: ${col}` });
      return;
    }
  }

  // Build name → record map for manager resolution
  const nameMap = new Map<string, string>(); // fullName → employee row id (resolved after first insert pass)

  // Upsert pass — insert/update without managerId first
  const upserted: { id: string; fullName: string; managerName: string | null }[] = [];

  for (const row of rows) {
    const fullName = (row["employee_name"] ?? "").trim();
    if (!fullName) continue;
    const employeeId = row["employee_id"]?.trim() || null;
    const position = row["position"]?.trim() || null;
    const location = row["location"]?.trim() || null;
    const department = row["department"]?.trim() || null;
    const managerName = row["manager_name"]?.trim() || null;
    const startDate = row["start_date"]?.trim() || null;
    const avgHours = row["avg_hours_worked"]?.trim() || null;
    const workEmail = row["work_email"]?.trim() || null;
    const personalEmail = row["personal_email"]?.trim() || null;

    // Upsert by employeeId if present, otherwise by fullName within org
    const existing = employeeId
      ? await db.select({ id: employeesTable.id }).from(employeesTable)
          .where(and(eq(employeesTable.organizationId, organizationId), eq(employeesTable.employeeId, employeeId))).limit(1)
      : await db.select({ id: employeesTable.id }).from(employeesTable)
          .where(and(eq(employeesTable.organizationId, organizationId), eq(employeesTable.fullName, fullName))).limit(1);

    let recordId: string;

    if (existing[0]) {
      await db.update(employeesTable).set({
        fullName, employeeId, position, location, department, managerName,
        startDate: startDate ?? undefined,
        avgHoursWorked: avgHours ?? undefined,
        workEmail: workEmail ?? undefined,
        personalEmail: personalEmail ?? undefined,
        dataSource: "csv",
        lastSyncAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(employeesTable.id, existing[0].id));
      recordId = existing[0].id;
    } else {
      const [inserted] = await db.insert(employeesTable).values({
        organizationId, fullName, employeeId, position, location, department, managerName,
        startDate: startDate ?? undefined,
        avgHoursWorked: avgHours ?? undefined,
        workEmail: workEmail ?? undefined,
        personalEmail: personalEmail ?? undefined,
        dataSource: "csv",
        lastSyncAt: new Date(),
      }).returning({ id: employeesTable.id });
      recordId = inserted.id;
    }

    nameMap.set(fullName.toLowerCase(), recordId);
    upserted.push({ id: recordId, fullName, managerName });
  }

  // Second pass — resolve managerId from nameMap
  for (const { id, managerName } of upserted) {
    if (!managerName) continue;
    const managerId = nameMap.get(managerName.toLowerCase());
    if (managerId) {
      await db.update(employeesTable).set({ managerId }).where(eq(employeesTable.id, id));
    }
  }

  res.json({ imported: upserted.length });
});

export default router;
