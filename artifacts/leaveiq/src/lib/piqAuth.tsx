import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

const API_BASE = "";

export type PiqRole = "manager" | "supervisor" | "hr_user" | "hr_admin" | "system_admin";

export interface PiqUser {
  id: string;
  email: string;
  fullName: string;
  role: PiqRole;
  organizationId: string;
}

interface PiqAuthContextValue {
  user: PiqUser | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<PiqUser>;
  logout: () => void;
}

const PiqAuthContext = createContext<PiqAuthContextValue | null>(null);

const PIQ_TOKEN_KEY = "performiq_token";
const PIQ_USER_KEY = "performiq_user";

export async function piqApiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const token = localStorage.getItem(PIQ_TOKEN_KEY);
  const headers: Record<string, string> = {
    ...(opts?.headers as Record<string, string>),
  };
  if (token && !headers["Authorization"]) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  const data = await res.json();
  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem(PIQ_TOKEN_KEY);
      localStorage.removeItem(PIQ_USER_KEY);
      window.location.href = "/performiq/login?reason=session_expired";
      throw new Error("Session expired");
    }
    throw new Error((data as { error?: string }).error ?? "Request failed");
  }
  return data as T;
}

export function PiqAuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(PIQ_TOKEN_KEY));
  const [user, setUser] = useState<PiqUser | null>(() => {
    const raw = localStorage.getItem(PIQ_USER_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw) as PiqUser; } catch { return null; }
  });
  const [isLoading, setIsLoading] = useState(false);

  const login = useCallback(async (email: string, password: string): Promise<PiqUser> => {
    setIsLoading(true);
    try {
      const data = await piqApiFetch<{ token: string; user: PiqUser }>("/api/performiq/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem(PIQ_TOKEN_KEY, data.token);
      localStorage.setItem(PIQ_USER_KEY, JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      return data.user;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(PIQ_TOKEN_KEY);
    localStorage.removeItem(PIQ_USER_KEY);
    setToken(null);
    setUser(null);
  }, []);

  return (
    <PiqAuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </PiqAuthContext.Provider>
  );
}

export function usePiqAuth(): PiqAuthContextValue {
  const ctx = useContext(PiqAuthContext);
  if (!ctx) throw new Error("usePiqAuth must be used within PiqAuthProvider");
  return ctx;
}

export function usePiqRole() {
  const { user } = usePiqAuth();
  return {
    role: user?.role ?? null,
    isHr: user ? ["hr_user", "hr_admin", "system_admin"].includes(user.role) : false,
    isHrAdmin: user ? ["hr_admin", "system_admin"].includes(user.role) : false,
    isSupervisor: user?.role === "supervisor",
    isManager: user?.role === "manager",
  };
}
