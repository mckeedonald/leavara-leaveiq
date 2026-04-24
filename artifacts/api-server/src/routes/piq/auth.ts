import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { db, piqUsersTable, piqInvitesTable, piqPasswordResetsTable, organizationsTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import { signPiqToken, requirePiqAuth, requirePiqHrAdmin, type PiqAuthenticatedRequest } from "../../lib/piqJwtAuth.js";
import { logger } from "../../lib/logger.js";

const router = Router();

// POST /performiq/auth/login
router.post("/performiq/auth/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    const [user] = await db
      .select()
      .from(piqUsersTable)
      .where(eq(piqUsersTable.email, email.toLowerCase().trim()))
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
    if (user.organizationId) {
      const [org] = await db
        .select({ hasPerformIq: organizationsTable.hasPerformIq })
        .from(organizationsTable)
        .where(eq(organizationsTable.id, user.organizationId))
        .limit(1);
      if (!org?.hasPerformIq) {
        res.status(403).json({ error: "Your organization does not have PerformIQ enabled" });
        return;
      }
    }

    const token = signPiqToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId!,
      fullName: user.fullName,
      piq: true,
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
        id: piqUsersTable.id,
        email: piqUsersTable.email,
        fullName: piqUsersTable.fullName,
        role: piqUsersTable.role,
        organizationId: piqUsersTable.organizationId,
      })
      .from(piqUsersTable)
      .where(eq(piqUsersTable.id, authed.piqUser.sub))
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
      role: role as any,
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
    const [user] = await db
      .insert(piqUsersTable)
      .values({
        organizationId: invite.organizationId,
        fullName,
        email: invite.email,
        passwordHash,
        role: invite.role,
      })
      .returning();

    await db
      .update(piqInvitesTable)
      .set({ usedAt: new Date() })
      .where(eq(piqInvitesTable.id, invite.id));

    const jwtToken = signPiqToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId!,
      fullName: user.fullName,
      piq: true,
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
      .select({ id: piqUsersTable.id, email: piqUsersTable.email })
      .from(piqUsersTable)
      .where(eq(piqUsersTable.email, email.toLowerCase().trim()))
      .limit(1);

    // Always return 200 to prevent email enumeration
    if (!user) {
      res.json({ message: "If that email is registered, a reset link has been sent." });
      return;
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.insert(piqPasswordResetsTable).values({ userId: user.id, token, expiresAt });

    // Email would be sent here via email service
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
      .update(piqUsersTable)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(piqUsersTable.id, reset.userId));

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
        id: piqUsersTable.id,
        fullName: piqUsersTable.fullName,
        email: piqUsersTable.email,
        role: piqUsersTable.role,
        isActive: piqUsersTable.isActive,
        createdAt: piqUsersTable.createdAt,
      })
      .from(piqUsersTable)
      .where(eq(piqUsersTable.organizationId, authed.piqUser.organizationId));

    res.json(users);
  } catch (err) {
    logger.error({ err }, "PIQ users list error");
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
      .select({ id: piqUsersTable.id })
      .from(piqUsersTable)
      .where(and(eq(piqUsersTable.id, userId), eq(piqUsersTable.organizationId, authed.piqUser.organizationId)))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof isActive === "boolean") updates.isActive = isActive;
    if (role) updates.role = role;

    const [updated] = await db
      .update(piqUsersTable)
      .set(updates)
      .where(eq(piqUsersTable.id, userId))
      .returning({ id: piqUsersTable.id, fullName: piqUsersTable.fullName, role: piqUsersTable.role, isActive: piqUsersTable.isActive });

    res.json(updated);
  } catch (err) {
    logger.error({ err }, "PIQ user update error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
