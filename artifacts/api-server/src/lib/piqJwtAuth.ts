/**
 * piqJwtAuth — thin compatibility shim.
 * All auth is now handled by jwtAuth.ts (unified token).
 * PerformIQ routes use requireAuth / requireHrAccess / requireHrAdmin / requirePerformIq.
 */
export {
  requireAuth as requirePiqAuth,
  requireHrAccess as requirePiqHrAccess,
  requireHrAdmin as requirePiqHrAdmin,
  requirePerformIq,
  requireHrAccess as requirePiqSupervisorOrHr,
  signToken as signPiqToken,
  verifyToken as verifyPiqToken,
  type AuthenticatedRequest as PiqAuthenticatedRequest,
  type JwtPayload as PiqJwtPayload,
} from "./jwtAuth.js";
