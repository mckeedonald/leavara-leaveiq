import jwt from "jsonwebtoken";
import { type Request, type Response, type NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const JWT_SECRET = process.env["JWT_SECRET"];

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: "admin" | "user";
  organizationId: string | null;
  isSuperAdmin?: boolean;
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

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const token = header.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  const [user] = await db
    .select({ id: usersTable.id, isActive: usersTable.isActive })
    .from(usersTable)
    .where(eq(usersTable.id, payload.sub));

  if (!user || !user.isActive) {
    res.status(401).json({ error: "Account is inactive or not found" });
    return;
  }

  (req as AuthenticatedRequest).user = payload;
  next();
}

export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  await requireAuth(req, res, async () => {
    const authedReq = req as AuthenticatedRequest;
    if (authedReq.user?.role !== "admin" && !authedReq.user?.isSuperAdmin) {
      res.status(403).json({ error: "Administrator access required" });
      return;
    }
    next();
  });
}

export async function requireSuperAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  await requireAuth(req, res, async () => {
    const authedReq = req as AuthenticatedRequest;
    if (!authedReq.user?.isSuperAdmin) {
      res.status(403).json({ error: "Super admin access required" });
      return;
    }
    next();
  });
}
