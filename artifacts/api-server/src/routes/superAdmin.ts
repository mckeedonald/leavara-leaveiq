import { Router, type IRouter, type Request, type Response } from "express";
import { eq, desc, isNull, isNotNull, and, count } from "drizzle-orm";
import { db, usersTable, organizationsTable, leaveCasesTable, piqUsersTable } from "@workspace/db";
import { requireSuperAdmin } from "../lib/jwtAuth";
import { sendWelcomeEmail } from "../lib/email";
import bcrypt from "bcryptjs";

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

export default router;
