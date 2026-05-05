import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { db, usersTable, piqInvitesTable, piqPasswordResetsTable, organizationsTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import { signPiqToken, requirePiqAuth, requirePiqHrAdmin, type PiqAuthenticatedRequest } from "../../lib/piqJwtAuth.js";
import { logger } from "../../lib/logger.js";
import type { UnifiedRole } from "@workspace/db";

const router = Router();

// POST /performiq/auth/login — legacy endpoint; unified login is /api/auth/login
router.post("/performiq/auth/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase().trim()))
      .limit(1);

    if (!user || !user.isActive) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    // Verify org has PerformIQ enabled
    let hasLeaveIq = false;
    let hasPerformIq = false;
    if (user.organizationId) {
      const [org] = await db
        .select({ hasPerformIq: organizationsTable.hasPerformIq, hasLeaveIq: organizationsTable.hasLeaveIq })
        .from(organizationsTable)
        .where(eq(organizationsTable.id, user.organizationId))
        .limit(1);
      if (!org?.hasPerformIq) {
        res.status(403).json({ error: "Your organization does not have PerformIQ enabled" });
        return;
      }
      hasLeaveIq = org.hasLeaveIq ?? false;
      hasPerformIq = org.hasPerformIq ?? false;
    }

    const token = signPiqToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      firstName: user.firstName,
      lastName: user.lastName,
      hasLeaveIq,
      hasPerformIq,
      isSuperAdmin: user.isSuperAdmin,
    });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        organizationId: user.organizationId,
      },
    });
  } catch (err) {
    logger.error({ err }, "PIQ login error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /performiq/auth/me
router.get("/performiq/auth/me", requirePiqAuth, async (req: Request, res: Response) => {
  try {
    const authed = req as PiqAuthenticatedRequest;
    const [user] = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        fullName: usersTable.fullName,
        role: usersTable.role,
        organizationId: usersTable.organizationId,
      })
      .from(usersTable)
      .where(eq(usersTable.id, authed.piqUser.sub))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(user);
  } catch (err) {
    logger.error({ err }, "PIQ /me error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /performiq/auth/invite  (hr_admin only)
router.post("/performiq/auth/invite", requirePiqHrAdmin, async (req: Request, res: Response) => {
  try {
    const authed = req as PiqAuthenticatedRequest;
    const { email, role } = req.body as { email?: string; role?: string };
    if (!email || !role) {
      res.status(400).json({ error: "email and role are required" });
      return;
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db.insert(piqInvitesTable).values({
      organizationId: authed.piqUser.organizationId,
      email: email.toLowerCase().trim(),
      role: role as UnifiedRole,
      token,
      sentByUserId: authed.piqUser.sub,
      expiresAt,
    });

    res.json({ token, expiresAt });
  } catch (err) {
    logger.error({ err }, "PIQ invite error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /performiq/auth/invite/validate
router.get("/performiq/auth/invite/validate", async (req: Request, res: Response) => {
  try {
    const { token } = req.query as { token?: string };
    if (!token) {
      res.status(400).json({ error: "Token is required" });
      return;
    }

    const [invite] = await db
      .select()
      .from(piqInvitesTable)
      .where(
        and(
          eq(piqInvitesTable.token, token),
          gt(piqInvitesTable.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!invite || invite.usedAt) {
      res.status(400).json({ error: "Invalid or expired invite" });
      return;
    }

    res.json({ email: invite.email, role: invite.role, organizationId: invite.organizationId });
  } catch (err) {
    logger.error({ err }, "PIQ invite validate error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /performiq/auth/register
router.post("/performiq/auth/register", async (req: Request, res: Response) => {
  try {
    const { token, fullName, password } = req.body as {
      token?: string;
      fullName?: string;
      password?: string;
    };
    if (!token || !fullName || !password) {
      res.status(400).json({ error: "token, fullName, and password are required" });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: "Password must be at least 8 characters" });
      return;
    }

    const [invite] = await db
      .select()
      .from(piqInvitesTable)
      .where(and(eq(piqInvitesTable.token, token), gt(piqInvitesTable.expiresAt, new Date())))
      .limit(1);

    if (!invite || invite.usedAt) {
      res.status(400).json({ error: "Invalid or expired invite" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const nameParts = fullName.trim().split(" ");
    const firstName = nameParts[0] ?? fullName;
    const lastName = nameParts.slice(1).join(" ") || firstName;

    const [user] = await db
      .insert(usersTable)
      .values({
        organizationId: invite.organizationId,
        fullName,
        firstName,
        lastName,
        email: invite.email,
        passwordHash,
        role: invite.role as UnifiedRole,
      })
      .returning();

    await db
      .update(piqInvitesTable)
      .set({ usedAt: new Date() })
      .where(eq(piqInvitesTable.id, invite.id));

    // Fetch org products for token
    let hasLeaveIq = false;
    let hasPerformIq = true;
    if (user.organizationId) {
      const [org] = await db
        .select({ hasPerformIq: organizationsTable.hasPerformIq, hasLeaveIq: organizationsTable.hasLeaveIq })
        .from(organizationsTable)
        .where(eq(organizationsTable.id, user.organizationId))
        .limit(1);
      hasLeaveIq = org?.hasLeaveIq ?? false;
      hasPerformIq = org?.hasPerformIq ?? true;
    }

    const jwtToken = signPiqToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      firstName: user.firstName,
      lastName: user.lastName,
      hasLeaveIq,
      hasPerformIq,
      isSuperAdmin: user.isSuperAdmin,
    });

    res.json({ token: jwtToken, user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role } });
  } catch (err) {
    logger.error({ err }, "PIQ register error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /performiq/auth/forgot-password
router.post("/performiq/auth/forgot-password", async (req: Request, res: Response) => {
  try {
    const { email } = req.body as { email?: string };
    if (!email) {
      res.status(400).json({ error: "Email is required" });
      return;
    }

    const [user] = await db
      .select({ id: usersTable.id, email: usersTable.email })
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase().trim()))
      .limit(1);

    if (!user) {
      res.json({ message: "If that email is registered, a reset link has been sent." });
      return;
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await db.insert(piqPasswordResetsTable).values({ userId: user.id, token, expiresAt });

    logger.info({ email: user.email, token }, "PIQ password reset token generated");

    res.json({ message: "If that email is registered, a reset link has been sent." });
  } catch (err) {
    logger.error({ err }, "PIQ forgot-password error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /performiq/auth/reset-password
router.post("/performiq/auth/reset-password", async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body as { token?: string; newPassword?: string };
    if (!token || !newPassword) {
      res.status(400).json({ error: "token and newPassword are required" });
      return;
    }
    if (newPassword.length < 8) {
      res.status(400).json({ error: "Password must be at least 8 characters" });
      return;
    }

    const [reset] = await db
      .select()
      .from(piqPasswordResetsTable)
      .where(and(eq(piqPasswordResetsTable.token, token), gt(piqPasswordResetsTable.expiresAt, new Date())))
      .limit(1);

    if (!reset || reset.usedAt) {
      res.status(400).json({ error: "Invalid or expired reset token" });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await db
      .update(usersTable)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(usersTable.id, reset.userId));

    await db
      .update(piqPasswordResetsTable)
      .set({ usedAt: new Date() })
      .where(eq(piqPasswordResetsTable.id, reset.id));

    res.json({ message: "Password reset successfully" });
  } catch (err) {
    logger.error({ err }, "PIQ reset-password error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /performiq/auth/users  (hr_admin)
router.get("/performiq/auth/users", requirePiqHrAdmin, async (req: Request, res: Response) => {
  try {
    const authed = req as PiqAuthenticatedRequest;
    const users = await db
      .select({
        id: usersTable.id,
        fullName: usersTable.fullName,
        email: usersTable.email,
        role: usersTable.role,
        isActive: usersTable.isActive,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable)
      .where(eq(usersTable.organizationId, authed.piqUser.organizationId));

    res.json(users);
  } catch (err) {
    logger.error({ err }, "PIQ users list error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /performiq/auth/users  (hr_admin) — create user directly with a temp password
router.post("/performiq/auth/users", requirePiqHrAdmin, async (req: Request, res: Response) => {
  try {
    const authed = req as PiqAuthenticatedRequest;
    const { fullName, email, role } = req.body as { fullName?: string; email?: string; role?: string };

    if (!fullName || !email || !role) {
      res.status(400).json({ error: "fullName, email, and role are required" });
      return;
    }
    const allowedRoles = ["manager", "supervisor", "hr_user", "hr_admin"];
    if (!allowedRoles.includes(role)) {
      res.status(400).json({ error: "Invalid role" });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check for existing user with this email in the org
    const [existing] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(and(eq(usersTable.email, normalizedEmail), eq(usersTable.organizationId, authed.piqUser.organizationId)))
      .limit(1);
    if (existing) {
      res.status(409).json({ error: "A user with this email already exists in your organization" });
      return;
    }

    // Generate a random temp password
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    const tempPassword = Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const nameParts = fullName.trim().split(" ");
    const firstName = nameParts[0] ?? fullName;
    const lastName = nameParts.slice(1).join(" ") || firstName;

    const [user] = await db
      .insert(usersTable)
      .values({
        organizationId: authed.piqUser.organizationId,
        fullName: fullName.trim(),
        firstName,
        lastName,
        email: normalizedEmail,
        passwordHash,
        role: role as UnifiedRole,
        isActive: true,
      })
      .returning({
        id: usersTable.id,
        fullName: usersTable.fullName,
        email: usersTable.email,
        role: usersTable.role,
        isActive: usersTable.isActive,
        createdAt: usersTable.createdAt,
      });

    res.status(201).json({ ...user, tempPassword });
  } catch (err) {
    logger.error({ err }, "PIQ create user error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /performiq/auth/users/:userId  (hr_admin)
router.patch("/performiq/auth/users/:userId", requirePiqHrAdmin, async (req: Request, res: Response) => {
  try {
    const authed = req as PiqAuthenticatedRequest;
    const { userId } = req.params;
    const { isActive, role } = req.body as { isActive?: boolean; role?: string };

    const [existing] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(and(eq(usersTable.id, userId), eq(usersTable.organizationId, authed.piqUser.organizationId)))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof isActive === "boolean") updates.isActive = isActive;
    if (role) updates.role = role;

    const [updated] = await db
      .update(usersTable)
      .set(updates)
      .where(eq(usersTable.id, userId))
      .returning({ id: usersTable.id, fullName: usersTable.fullName, role: usersTable.role, isActive: usersTable.isActive });

    res.json(updated);
  } catch (err) {
    logger.error({ err }, "PIQ user update error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
