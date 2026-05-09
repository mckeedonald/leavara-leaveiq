import { Router, type Request, type Response } from "express";
import { db, organizationsTable, employeesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

/**
 * GET /api/public/employees/lookup
 * No auth required — used by the employee self-service portal.
 *
 * Query params:
 *   employeeId — the employee's HR identifier (employees.employee_id column)
 *   org        — the org slug (same ?org= used by case creation)
 *
 * Returns:
 *   { found: false }                               — not found / bad params
 *   { found: true, fullName: string, email: string | null } — found
 *
 * Security: only fullName + a single email are returned. No other fields.
 */
router.get("/public/employees/lookup", async (req: Request, res: Response): Promise<void> => {
  const { employeeId, org } = req.query as { employeeId?: string; org?: string };

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
      res.json({ found: false });
      return;
    }

    // Look up active employee by employeeId within that org
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
          eq(employeesTable.employeeId, employeeId.trim()),
          eq(employeesTable.isActive, true)
        )
      )
      .limit(1);

    if (!employee) {
      res.json({ found: false });
      return;
    }

    // Prefer personal email; fall back to work email
    const email = employee.personalEmail || employee.workEmail || null;

    res.json({ found: true, fullName: employee.fullName, email });
  } catch {
    // Fail silently — the portal handles the not-found path gracefully
    res.json({ found: false });
  }
});

export default router;
