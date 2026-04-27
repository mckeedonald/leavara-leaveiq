import { Router, type Request, type Response } from "express";
import { db, employeesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requirePiqAuth, requirePiqHrAdmin, type PiqAuthenticatedRequest } from "../../lib/piqJwtAuth.js";
import { logger } from "../../lib/logger.js";

const router = Router();

// GET /performiq/employees
router.get("/performiq/employees", requirePiqAuth, async (req: Request, res: Response) => {
  try {
    const authed = req as PiqAuthenticatedRequest;
    const { search, isActive } = req.query as { search?: string; isActive?: string };

    const employees = await db
      .select({
        id: employeesTable.id,
        fullName: employeesTable.fullName,
        workEmail: employeesTable.workEmail,
        position: employeesTable.position,
        department: employeesTable.department,
        location: employeesTable.location,
        managerId: employeesTable.managerId,
        managerName: employeesTable.managerName,
        startDate: employeesTable.startDate,
        isActive: employeesTable.isActive,
        dataSource: employeesTable.dataSource,
        createdAt: employeesTable.createdAt,
      })
      .from(employeesTable)
      .where(eq(employeesTable.organizationId, authed.piqUser.organizationId));

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
      .from(employeesTable)
      .where(
        and(
          eq(employeesTable.id, employeeId),
          eq(employeesTable.organizationId, authed.piqUser.organizationId),
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
    const { fullName, personalEmail, workEmail, position, department, location, managerId, startDate, hrisId } =
      req.body as {
        fullName?: string;
        personalEmail?: string;
        workEmail?: string;
        position?: string;
        department?: string;
        location?: string;
        managerId?: string;
        startDate?: string;
        hrisId?: string;
      };

    if (!fullName) {
      res.status(400).json({ error: "fullName is required" });
      return;
    }

    // Validate managerId is an employee in this org (self-referential)
    if (managerId) {
      const [manager] = await db
        .select({ id: employeesTable.id })
        .from(employeesTable)
        .where(and(eq(employeesTable.id, managerId), eq(employeesTable.organizationId, authed.piqUser.organizationId)))
        .limit(1);
      if (!manager) {
        res.status(400).json({ error: "Manager not found in this organization" });
        return;
      }
    }

    const [employee] = await db
      .insert(employeesTable)
      .values({
        organizationId: authed.piqUser.organizationId,
        fullName,
        personalEmail,
        workEmail,
        position,
        department,
        location,
        managerId,
        startDate,
        hrisId,
        dataSource: "manual",
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
      .select({ id: employeesTable.id })
      .from(employeesTable)
      .where(
        and(eq(employeesTable.id, employeeId), eq(employeesTable.organizationId, authed.piqUser.organizationId)),
      )
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Employee not found" });
      return;
    }

    const allowed = ["fullName", "personalEmail", "workEmail", "position", "department", "location", "managerId", "startDate", "isActive", "hrisId"];
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    for (const key of allowed) {
      if (key in req.body) updates[key] = req.body[key];
    }

    const [updated] = await db
      .update(employeesTable)
      .set(updates)
      .where(eq(employeesTable.id, employeeId))
      .returning();

    res.json(updated);
  } catch (err) {
    logger.error({ err }, "PIQ employee update error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
