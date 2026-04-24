import { Router, type Request, type Response } from "express";
import { db, piqEmployeesTable, piqUsersTable } from "@workspace/db";
import { eq, and, ilike, or } from "drizzle-orm";
import { requirePiqAuth, requirePiqHrAdmin, type PiqAuthenticatedRequest } from "../../lib/piqJwtAuth.js";
import { logger } from "../../lib/logger.js";

const router = Router();

// GET /performiq/employees
router.get("/performiq/employees", requirePiqAuth, async (req: Request, res: Response) => {
  try {
    const authed = req as PiqAuthenticatedRequest;
    const { search, isActive } = req.query as { search?: string; isActive?: string };

    let query = db
      .select({
        id: piqEmployeesTable.id,
        fullName: piqEmployeesTable.fullName,
        workEmail: piqEmployeesTable.workEmail,
        jobTitle: piqEmployeesTable.jobTitle,
        department: piqEmployeesTable.department,
        managerId: piqEmployeesTable.managerId,
        hireDate: piqEmployeesTable.hireDate,
        isActive: piqEmployeesTable.isActive,
        createdAt: piqEmployeesTable.createdAt,
      })
      .from(piqEmployeesTable)
      .where(eq(piqEmployeesTable.organizationId, authed.piqUser.organizationId))
      .$dynamic();

    const employees = await query;

    let filtered = employees;
    if (isActive !== undefined) {
      const active = isActive === "true";
      filtered = filtered.filter((e) => e.isActive === active);
    }
    if (search) {
      const term = search.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.fullName.toLowerCase().includes(term) ||
          (e.workEmail ?? "").toLowerCase().includes(term) ||
          (e.department ?? "").toLowerCase().includes(term),
      );
    }

    res.json(filtered);
  } catch (err) {
    logger.error({ err }, "PIQ employees list error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /performiq/employees/:employeeId
router.get("/performiq/employees/:employeeId", requirePiqAuth, async (req: Request, res: Response) => {
  try {
    const authed = req as PiqAuthenticatedRequest;
    const { employeeId } = req.params;

    const [employee] = await db
      .select()
      .from(piqEmployeesTable)
      .where(
        and(
          eq(piqEmployeesTable.id, employeeId),
          eq(piqEmployeesTable.organizationId, authed.piqUser.organizationId),
        ),
      )
      .limit(1);

    if (!employee) {
      res.status(404).json({ error: "Employee not found" });
      return;
    }

    res.json(employee);
  } catch (err) {
    logger.error({ err }, "PIQ employee get error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /performiq/employees  (hr_admin)
router.post("/performiq/employees", requirePiqHrAdmin, async (req: Request, res: Response) => {
  try {
    const authed = req as PiqAuthenticatedRequest;
    const { fullName, personalEmail, workEmail, jobTitle, department, managerId, hireDate, hrisEmployeeId } =
      req.body as {
        fullName?: string;
        personalEmail?: string;
        workEmail?: string;
        jobTitle?: string;
        department?: string;
        managerId?: string;
        hireDate?: string;
        hrisEmployeeId?: string;
      };

    if (!fullName) {
      res.status(400).json({ error: "fullName is required" });
      return;
    }

    // Validate managerId belongs to this org
    if (managerId) {
      const [manager] = await db
        .select({ id: piqUsersTable.id })
        .from(piqUsersTable)
        .where(and(eq(piqUsersTable.id, managerId), eq(piqUsersTable.organizationId, authed.piqUser.organizationId)))
        .limit(1);
      if (!manager) {
        res.status(400).json({ error: "Manager not found in this organization" });
        return;
      }
    }

    const [employee] = await db
      .insert(piqEmployeesTable)
      .values({
        organizationId: authed.piqUser.organizationId,
        fullName,
        personalEmail,
        workEmail,
        jobTitle,
        department,
        managerId,
        hireDate,
        hrisEmployeeId,
      })
      .returning();

    res.status(201).json(employee);
  } catch (err) {
    logger.error({ err }, "PIQ employee create error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /performiq/employees/:employeeId  (hr_admin)
router.patch("/performiq/employees/:employeeId", requirePiqHrAdmin, async (req: Request, res: Response) => {
  try {
    const authed = req as PiqAuthenticatedRequest;
    const { employeeId } = req.params;

    const [existing] = await db
      .select({ id: piqEmployeesTable.id })
      .from(piqEmployeesTable)
      .where(
        and(eq(piqEmployeesTable.id, employeeId), eq(piqEmployeesTable.organizationId, authed.piqUser.organizationId)),
      )
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Employee not found" });
      return;
    }

    const allowed = ["fullName", "personalEmail", "workEmail", "jobTitle", "department", "managerId", "hireDate", "isActive", "hrisEmployeeId"];
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    for (const key of allowed) {
      if (key in req.body) updates[key === "fullName" ? "fullName" : key] = req.body[key];
    }

    const [updated] = await db
      .update(piqEmployeesTable)
      .set(updates)
      .where(eq(piqEmployeesTable.id, employeeId))
      .returning();

    res.json(updated);
  } catch (err) {
    logger.error({ err }, "PIQ employee update error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
