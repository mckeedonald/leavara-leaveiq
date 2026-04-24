import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";

const API_BASE = "";

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  position: string;
  role: "admin" | "user";
  isSuperAdmin?: boolean;
  organizationId?: string | null;
  organizationSlug?: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
  updateUser: (updated: Partial<Pick<AuthUser, "firstName" | "lastName" | "position">>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = "leaveiq_token";
const USER_KEY = "leaveiq_user";

export async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers: Record<string, string> = {
    ...(opts?.headers as Record<string, string>),
  };
  if (token && !headers["Authorization"]) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  const data = await res.json();
  if (!res.ok) {
    // Session expired or token invalid — clear stored credentials and send to login
    if (res.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      window.location.href = "/leaveiq/login?reason=session_expired";
      throw new Error("Your session has expired. Please log in again.");
    }
    throw new Error((data as { error?: string }).error ?? "Request failed");
  }
  return data as T;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<AuthUser | null>(() => {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState(false);

  // Wire token into the generated API client
  useEffect(() => {
    setAuthTokenGetter(() => localStorage.getItem(TOKEN_KEY));
  }, []);

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
      setToken(data.token);
      setUser(data.user);
      return data.user;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const updateUser = useCallback(
    (updated: Partial<Pick<AuthUser, "firstName" | "lastName" | "position">>) => {
      setUser((prev) => {
        if (!prev) return prev;
        const next = { ...prev, ...updated };
        localStorage.setItem(USER_KEY, JSON.stringify(next));
        return next;
      });
    },
    [],
  );

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
