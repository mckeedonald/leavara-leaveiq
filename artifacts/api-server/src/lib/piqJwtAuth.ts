/**
 * piqJwtAuth — backward-compat shim.
 * Auth is now handled by jwtAuth.ts (unified token).
 * This shim bridges the old `req.piqUser` API used by PerformIQ route files.
 */
import type { Request, Response, NextFunction } from "express";
import {
  requireAuth,
  requireHrAccess,
  requireHrAdmin,
  requirePerformIq,
  signToken,
  verifyToken,
  type AuthenticatedRequest,
  type JwtPayload,
} from "./jwtAuth.js";

export type { JwtPayload as PiqJwtPayload };

/** PerformIQ request type — exposes `piqUser` alias for the unified JWT payload */
export interface PiqAuthenticatedRequest extends Request {
  piqUser: JwtPayload;
  user: JwtPayload;
}

function withPiqUser(
  middleware: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  return async (req, res, next) => {
    await middleware(req, res, () => {
      (req as PiqAuthenticatedRequest).piqUser = (req as AuthenticatedRequest).user;
      next();
    });
  };
}

export const requirePiqAuth = withPiqUser(requireAuth);
export const requirePiqHrAccess = withPiqUser(requireHrAccess);
export const requirePiqHrAdmin = withPiqUser(requireHrAdmin);
export const requirePiqSupervisorOrHr = withPiqUser(requireHrAccess);
export { requirePerformIq };
export const signPiqToken = signToken;
export const verifyPiqToken = verifyToken;
