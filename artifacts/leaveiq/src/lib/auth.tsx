import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

const API_BASE = "";
const TOKEN_KEY = "leavara_token";
const USER_KEY = "leavara_user";

export type UnifiedRole = "hr_admin" | "hr_user" | "manager";

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  position: string | null;
  role: UnifiedRole;
  customRoleId: string | null;
  organizationId: string | null;
  organizationSlug: string | null;
  hasLeaveIq: boolean;
  hasPerformIq: boolean;
  isSuperAdmin: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
  updateUser: (partial: Partial<AuthUser>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY) ?? localStorage.getItem("leaveiq_token");
  const headers: Record<string, string> = { ...(opts?.headers as Record<string, string>) };
  if (token && !headers["Authorization"]) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  const data = await res.json();
  if (!res.ok) {
    if (res.status === 401) {
      [TOKEN_KEY, USER_KEY, "leaveiq_token", "leaveiq_user"].forEach((k) => localStorage.removeItem(k));
      window.location.href = "/leaveiq/login?reason=session_expired";
      throw new Error("Session expired");
    }
    throw new Error((data as { error?: string }).error ?? "Request failed");
  }
  return data as T;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem(TOKEN_KEY) ?? localStorage.getItem("leaveiq_token")
  );
  const [user, setUser] = useState<AuthUser | null>(() => {
    const raw = localStorage.getItem(USER_KEY) ?? localStorage.getItem("leaveiq_user");
    if (!raw) return null;
    try { return JSON.parse(raw) as AuthUser; } catch { return null; }
  });
  const [isLoading, setIsLoading] = useState(false);

  const login = useCallback(async (email: string, password: string): Promise<AuthUser> => {
    setIsLoading(true);
    try {
      const data = await apiFetch<{ token: string; user: AuthUser }>("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      ["leaveiq_token", "leaveiq_user", "performiq_token", "performiq_user"].forEach((k) => localStorage.removeItem(k));
      setToken(data.token);
      setUser(data.user);
      return data.user;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    [TOKEN_KEY, USER_KEY, "leaveiq_token", "leaveiq_user", "performiq_token", "performiq_user"].forEach(
      (k) => localStorage.removeItem(k)
    );
    setToken(null);
    setUser(null);
  }, []);

  const updateUser = useCallback((partial: Partial<AuthUser>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...partial };
      localStorage.setItem(USER_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function useRole() {
  const { user } = useAuth();
  return {
    role: user?.role ?? null,
    isHrAdmin: user?.role === "hr_admin" || user?.isSuperAdmin === true,
    isHr: user ? ["hr_admin", "hr_user"].includes(user.role) : false,
    isManager: user?.role === "manager",
    hasLeaveIq: user?.hasLeaveIq ?? false,
    hasPerformIq: user?.hasPerformIq ?? false,
  };
}
