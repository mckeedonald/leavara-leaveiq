/**
 * piqAuth — thin wrapper over the unified auth context.
 * PerformIQ pages import usePiqAuth / usePiqRole / piqApiFetch from here.
 * All state is stored in leavara_token (unified).
 */
import { useAuth, apiFetch, type AuthUser } from "./auth";
import type { ReactNode } from "react";
import React from "react";

export type PiqRole = "hr_admin" | "hr_user" | "manager";

export interface PiqUser {
  id: string;
  email: string;
  fullName: string;
  role: PiqRole;
  organizationId: string;
}

function authUserToPiq(u: AuthUser): PiqUser {
  return {
    id: u.id,
    email: u.email,
    fullName: u.fullName || `${u.firstName} ${u.lastName}`.trim(),
    role: u.role as PiqRole,
    organizationId: u.organizationId ?? "",
  };
}

export function piqApiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  return apiFetch<T>(path, opts);
}

// PiqAuthProvider is now a no-op wrapper — auth state lives in AuthProvider
export function PiqAuthProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function usePiqAuth() {
  const { user, isLoading, logout } = useAuth();
  return {
    user: user && user.hasPerformIq ? authUserToPiq(user) : null,
    token: localStorage.getItem("leavara_token"),
    isLoading,
    logout,
    login: async (_email: string, _password: string): Promise<PiqUser> => {
      throw new Error("Use unified login at /leaveiq/login");
    },
  };
}

export function usePiqRole() {
  const { user } = useAuth();
  return {
    role: user?.role ?? null,
    isHr: user ? ["hr_user", "hr_admin"].includes(user.role) : false,
    isHrAdmin: user?.role === "hr_admin",
    isManager: user?.role === "manager",
    isSupervisor: false, // retired role
  };
}
