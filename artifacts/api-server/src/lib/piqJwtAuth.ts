import jwt from "jsonwebtoken";
import { type Request, type Response, type NextFunction } from "express";
import { db, piqUsersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { PiqRole } from "@workspace/db";

const JWT_SECRET = process.env["JWT_SECRET"];
if (!JWT_SECRET) throw new Error("JWT_SECRET environment variable is required");

export interface PiqJwtPayload {
  sub: string;
  email: string;
  role: PiqRole;
  organizationId: string;
  fullName: string;
  piq: true;
}

export interface PiqAuthenticatedRequest extends Request {
  piqUser: PiqJwtPayload;
}

export function signPiqToken(payload: PiqJwtPayload): string {
  return jwt.sign(payload, JWT_SECRET!, { expiresIn: "24h" });
}

export function verifyPiqToken(token: string): PiqJwtPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET!) as PiqJwtPayload;
    if (!decoded.piq) return null;
    return decoded;
  } catch {
    return null;
  }
}

export async function requirePiqAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = header.slice(7);
  const payload = verifyPiqToken(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  const [user] = await db
    .select({ id: piqUsersTable.id, isActive: piqUsersTable.isActive })
    .from(piqUsersTable)
    .where(eq(piqUsersTable.id, payload.sub));

  if (!user || !user.isActive) {
    res.status(401).json({ error: "Account is inactive or not found" });
    return;
  }

  (req as PiqAuthenticatedRequest).piqUser = payload;
  next();
}

/** Require hr_user, hr_admin, or system_admin */
export async function requirePiqHrAccess(req: Request, res: Response, next: NextFunction): Promise<void> {
  await requirePiqAuth(req, res, () => {
    const { role } = (req as PiqAuthenticatedRequest).piqUser;
    if (!["hr_user", "hr_admin", "system_admin"].includes(role)) {
      res.status(403).json({ error: "HR access required" });
      return;
    }
    next();
  });
}

/** Require hr_admin or system_admin */
export async function requirePiqHrAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  await requirePiqAuth(req, res, () => {
    const { role } = (req as PiqAuthenticatedRequest).piqUser;
    if (!["hr_admin", "system_admin"].includes(role)) {
      res.status(403).json({ error: "HR admin access required" });
      return;
    }
    next();
  });
}

/** Require supervisor, hr_user, hr_admin, or system_admin */
export async function requirePiqSupervisorOrHr(req: Request, res: Response, next: NextFunction): Promise<void> {
  await requirePiqAuth(req, res, () => {
    const { role } = (req as PiqAuthenticatedRequest).piqUser;
    if (!["supervisor", "hr_user", "hr_admin", "system_admin"].includes(role)) {
      res.status(403).json({ error: "Supervisor or HR access required" });
      return;
    }
    next();
  });
}
