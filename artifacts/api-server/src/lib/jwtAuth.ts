import jwt from "jsonwebtoken";
import { type Request, type Response, type NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { UnifiedRole } from "@workspace/db";
import { logger } from "./logger";

const JWT_SECRET = process.env["JWT_SECRET"];
if (!JWT_SECRET) throw new Error("JWT_SECRET environment variable is required");

export interface JwtPayload {
  sub: string;
  email: string;
  role: UnifiedRole;
  customRoleId?: string;
  organizationId: string | null;
  firstName: string;
  lastName: string;
  hasLeaveIq: boolean;
  hasPerformIq: boolean;
  isSuperAdmin: boolean;
}

export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET!, { expiresIn: "24h" });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET!) as JwtPayload;
  } catch {
    return null;
  }
}

function normalizeRole(role: string): UnifiedRole {
  if (role === "admin" || role === "hr_admin") return "hr_admin";
  if (role === "manager") return "manager";
  return "hr_user";
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = header.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    const ip = req.ip ?? req.socket?.remoteAddress ?? "unknown";
    logger.warn({ ip, url: req.originalUrl }, "Auth failed: invalid or expired token");
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
  const [user] = await db
    .select({ id: usersTable.id, isActive: usersTable.isActive })
    .from(usersTable)
    .where(eq(usersTable.id, payload.sub));
  if (!user?.isActive) {
    const ip = req.ip ?? req.socket?.remoteAddress ?? "unknown";
    logger.warn({ ip, sub: payload.sub, url: req.originalUrl }, "Auth failed: account inactive or not found");
    res.status(401).json({ error: "Account is inactive or not found" });
    return;
  }
  (req as AuthenticatedRequest).user = { ...payload, role: normalizeRole(payload.role) };
  next();
}

export async function requireHrAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  await requireAuth(req, res, async () => {
    const { user } = req as AuthenticatedRequest;
    if (user.role !== "hr_admin" && !user.isSuperAdmin) {
      logger.warn({ sub: user.sub, role: user.role, url: req.originalUrl }, "Authorization failed: HR Admin role required");
      res.status(403).json({ error: "HR Admin access required" });
      return;
    }
    next();
  });
}

export async function requireHrAccess(req: Request, res: Response, next: NextFunction): Promise<void> {
  await requireAuth(req, res, async () => {
    const { user } = req as AuthenticatedRequest;
    if (!["hr_admin", "hr_user"].includes(user.role) && !user.isSuperAdmin) {
      res.status(403).json({ error: "HR access required" });
      return;
    }
    next();
  });
}

export async function requireLeaveIq(req: Request, res: Response, next: NextFunction): Promise<void> {
  await requireAuth(req, res, async () => {
    const { user } = req as AuthenticatedRequest;
    if (!user.hasLeaveIq && !user.isSuperAdmin) {
      res.status(403).json({ error: "LeaveIQ access required" });
      return;
    }
    next();
  });
}

export async function requirePerformIq(req: Request, res: Response, next: NextFunction): Promise<void> {
  await requireAuth(req, res, async () => {
    const { user } = req as AuthenticatedRequest;
    if (!user.hasPerformIq && !user.isSuperAdmin) {
      res.status(403).json({ error: "PerformIQ access required" });
      return;
    }
    next();
  });
}

export async function requireSuperAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  await requireAuth(req, res, async () => {
    const { user } = req as AuthenticatedRequest;
    if (!user.isSuperAdmin) {
      logger.warn({ sub: user.sub, role: user.role, url: req.originalUrl }, "Authorization failed: Super admin access required");
      res.status(403).json({ error: "Super admin access required" });
      return;
    }
    next();
  });
}

/**
 * Log a cross-tenant access attempt for breach detection.
 * Call this whenever isOrgAuthorized() returns false before sending a 403.
 */
export function logCrossOrgAttempt(req: Request, sub: string, userOrgId: string | null, caseOrgId: string | null): void {
  logger.warn(
    { sub, userOrgId, caseOrgId, url: req.originalUrl, ip: req.ip ?? req.socket?.remoteAddress },
    "SECURITY: cross-tenant access attempt blocked",
  );
}

// Legacy alias so existing imports continue to work
export const requireAdmin = requireHrAdmin;
