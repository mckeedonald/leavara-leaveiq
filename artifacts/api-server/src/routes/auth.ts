import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, isNull, gt } from "drizzle-orm";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { db, usersTable, invitesTable, passwordResetsTable, organizationsTable } from "@workspace/db";
import { signToken, requireAuth, requireAdmin, type AuthenticatedRequest } from "../lib/jwtAuth";
import { sendPasswordResetEmail, sendInviteEmail } from "../lib/email";
import { loginLimiter } from "../lib/rateLimiters";

const router: IRouter = Router();

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

// POST /auth/login
router.post("/auth/login", loginLimiter, async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase().trim()));

  if (!user || !user.isActive) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const token = signToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId ?? null,
    isSuperAdmin: user.isSuperAdmin ?? false,
  });

  let organizationSlug: string | null = null;
  if (user.organizationId) {
    const [org] = await db
      .select({ slug: organizationsTable.slug })
      .from(organizationsTable)
      .where(eq(organizationsTable.id, user.organizationId))
      .limit(1);
    organizationSlug = org?.slug ?? null;
  }

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      position: user.position,
      role: user.role,
      organizationId: user.organizationId ?? null,
      organizationSlug,
      isSuperAdmin: user.isSuperAdmin ?? false,
    },
  });
});

// GET /auth/me
router.get("/auth/me", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const authed = req as AuthenticatedRequest;

  const [user] = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      position: usersTable.position,
      role: usersTable.role,
      organizationId: usersTable.organizationId,
    })
    .from(usersTable)
    .where(eq(usersTable.id, authed.user.sub));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({ user });
});

// POST /auth/forgot-password
router.post("/auth/forgot-password", async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body as { email?: string };

  if (!email) {
    res.status(400).json({ error: "Email is required" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.email, email.toLowerCase().trim()), eq(usersTable.isActive, true)));

  if (user) {
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await db.insert(passwordResetsTable).values({
      userId: user.id,
      token,
      expiresAt,
    });

    await sendPasswordResetEmail(user.email, token).catch((err) =>
      req.log.error({ err }, "Failed to send password reset email"),
    );
  }

  res.json({ message: "If that email exists, a reset link has been sent." });
});

// POST /auth/reset-password
router.post("/auth/reset-password", async (req: Request, res: Response): Promise<void> => {
  const { token, password } = req.body as { token?: string; password?: string };

  if (!token || !password) {
    res.status(400).json({ error: "Token and password are required" });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  const now = new Date();

  const [reset] = await db
    .select()
    .from(passwordResetsTable)
    .where(
      and(
        eq(passwordResetsTable.token, token),
        isNull(passwordResetsTable.usedAt),
        gt(passwordResetsTable.expiresAt, now),
      ),
    );

  if (!reset) {
    res.status(400).json({ error: "Invalid or expired reset link" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await db
    .update(usersTable)
    .set({ passwordHash, updatedAt: now })
    .where(eq(usersTable.id, reset.userId));

  await db
    .update(passwordResetsTable)
    .set({ usedAt: now })
    .where(eq(passwordResetsTable.id, reset.id));

  res.json({ message: "Password reset successfully" });
});

// POST /auth/invite  (admin only — scoped to caller's org)
router.post(
  "/auth/invite",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const authed = req as AuthenticatedRequest;
    const { email, role } = req.body as { email?: string; role?: string };

    if (!email) {
      res.status(400).json({ error: "Email is required" });
      return;
    }

    const inviteRole = role === "admin" ? "admin" : "user";

    const [existing] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase().trim()));

    if (existing) {
      res.status(409).json({ error: "A user with this email already exists" });
      return;
    }

    const token = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db.insert(invitesTable).values({
      organizationId: authed.user.organizationId,
      email: email.toLowerCase().trim(),
      role: inviteRole,
      token,
      sentByUserId: authed.user.sub,
      expiresAt,
    });

    const [sender] = await db
      .select({ firstName: usersTable.firstName, lastName: usersTable.lastName })
      .from(usersTable)
      .where(eq(usersTable.id, authed.user.sub));

    const senderName = sender
      ? `${sender.firstName} ${sender.lastName}`
      : "Your administrator";

    await sendInviteEmail(email.toLowerCase().trim(), token, inviteRole, senderName).catch(
      (err) => req.log.error({ err }, "Failed to send invite email"),
    );

    res.status(201).json({ message: "Invitation sent successfully" });
  },
);

// GET /auth/invite/validate?token=xxx
router.get("/auth/invite/validate", async (req: Request, res: Response): Promise<void> => {
  const { token } = req.query as { token?: string };

  if (!token) {
    res.status(400).json({ error: "Token is required" });
    return;
  }

  const now = new Date();

  const [invite] = await db
    .select()
    .from(invitesTable)
    .where(
      and(
        eq(invitesTable.token, token),
        isNull(invitesTable.usedAt),
        gt(invitesTable.expiresAt, now),
      ),
    );

  if (!invite) {
    res.status(400).json({ error: "Invalid or expired invitation" });
    return;
  }

  res.json({ email: invite.email, role: invite.role });
});

// POST /auth/register  (from invite token)
router.post("/auth/register", async (req: Request, res: Response): Promise<void> => {
  const { token, firstName, lastName, position, password } = req.body as {
    token?: string;
    firstName?: string;
    lastName?: string;
    position?: string;
    password?: string;
  };

  if (!token || !firstName || !lastName || !position || !password) {
    res.status(400).json({ error: "All fields are required" });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  const now = new Date();

  const [invite] = await db
    .select()
    .from(invitesTable)
    .where(
      and(
        eq(invitesTable.token, token),
        isNull(invitesTable.usedAt),
        gt(invitesTable.expiresAt, now),
      ),
    );

  if (!invite) {
    res.status(400).json({ error: "Invalid or expired invitation link" });
    return;
  }

  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, invite.email));

  if (existing) {
    res.status(409).json({ error: "An account with this email already exists" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const [newUser] = await db
    .insert(usersTable)
    .values({
      organizationId: invite.organizationId,
      email: invite.email,
      passwordHash,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      position: position.trim(),
      role: invite.role,
    })
    .returning();

  await db
    .update(invitesTable)
    .set({ usedAt: now })
    .where(eq(invitesTable.id, invite.id));

  const jwtToken = signToken({
    sub: newUser.id,
    email: newUser.email,
    role: newUser.role,
    organizationId: newUser.organizationId ?? null,
  });

  res.status(201).json({
    token: jwtToken,
    user: {
      id: newUser.id,
      email: newUser.email,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      position: newUser.position,
      role: newUser.role,
      organizationId: newUser.organizationId ?? null,
    },
  });
});

// PATCH /auth/me
router.patch("/auth/me", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const authed = req as AuthenticatedRequest;
  const { firstName, lastName, position } = req.body as {
    firstName?: string;
    lastName?: string;
    position?: string;
  };

  if (!firstName?.trim() || !lastName?.trim() || !position?.trim()) {
    res.status(400).json({ error: "First name, last name, and position are required" });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      position: position.trim(),
      updatedAt: new Date(),
    })
    .where(eq(usersTable.id, authed.user.sub))
    .returning({
      id: usersTable.id,
      email: usersTable.email,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      position: usersTable.position,
      role: usersTable.role,
    });

  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({ user: updated });
});

// POST /auth/change-password
router.post(
  "/auth/change-password",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const authed = req as AuthenticatedRequest;
    const { currentPassword, newPassword } = req.body as {
      currentPassword?: string;
      newPassword?: string;
    };

    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: "Current password and new password are required" });
      return;
    }

    if (newPassword.length < 8) {
      res.status(400).json({ error: "New password must be at least 8 characters" });
      return;
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, authed.user.sub));

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Current password is incorrect" });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await db
      .update(usersTable)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(usersTable.id, authed.user.sub));

    res.json({ message: "Password changed successfully" });
  },
);

// GET /auth/users  (admin only — scoped to caller's org)
router.get(
  "/auth/users",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const authed = req as AuthenticatedRequest;

    let query = db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        position: usersTable.position,
        role: usersTable.role,
        isActive: usersTable.isActive,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable)
      .$dynamic();

    if (authed.user.organizationId) {
      query = query.where(eq(usersTable.organizationId, authed.user.organizationId));
    }

    const users = await query.orderBy(usersTable.createdAt);
    res.json({ users });
  },
);

// PATCH /auth/users/:userId  (admin only)
router.patch(
  "/auth/users/:userId",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const { userId } = req.params;
    const { isActive } = req.body as { isActive?: boolean };

    if (typeof isActive !== "boolean") {
      res.status(400).json({ error: "isActive (boolean) is required" });
      return;
    }

    const [updated] = await db
      .update(usersTable)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(usersTable.id, userId))
      .returning({ id: usersTable.id });

    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({ message: "User updated" });
  },
);

export default router;
