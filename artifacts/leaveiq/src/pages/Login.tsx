import React, { useState } from "react";
import { useLocation, Link } from "wouter";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/lib/auth";

const C = {
  bg: "#F0EEE9",
  card: "#FFFFFF",
  border: "#D4C9BB",
  mocha: "#A47864",
  mochaDark: "#7A5540",
  terracotta: "#C97E59",
  terracottaHover: "#B36A44",
  rose: "#EAA292",
  textDark: "#3D2010",
  textBody: "#5C3D28",
  textMuted: "#8C7058",
  inputBg: "#F7F4F0",
  inputBorder: "#C8BAA8",
  focusRing: "#C97E59",
  errorBg: "#FDF0EE",
  errorBorder: "#E8A898",
  errorText: "#9E4030",
};

export default function Login() {
  const { login, isLoading } = useAuth();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Show a banner if redirected here due to session expiry
  const sessionExpired = new URLSearchParams(window.location.search).get("reason") === "session_expired";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const loggedInUser = await login(email, password);
      navigate(loggedInUser.isSuperAdmin ? "/superadmin" : "/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  }

  const inputClass = "w-full px-4 py-2.5 rounded-xl text-sm transition-all outline-none focus:ring-2";

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: `linear-gradient(135deg, ${C.bg} 0%, #E8DDD4 100%)` }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img src="/leavara-logo.png" alt="Leavara" className="h-16 w-16 object-contain mb-4" />
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: C.textDark }}>Leavara LeaveIQ</h1>
          <p className="text-sm mt-1" style={{ color: C.textMuted }}>HR Decision Support Platform</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-8 shadow-lg border" style={{ background: C.card, borderColor: C.border }}>
          <h2 className="text-xl font-semibold mb-6" style={{ color: C.textDark }}>Sign in to your account</h2>

          {sessionExpired && !error && (
            <div className="mb-4 px-4 py-3 rounded-xl text-sm border" style={{ background: "#FFF8E7", borderColor: "#F5C842", color: "#7A5A00" }}>
              Your session expired. Please sign in again to continue.
            </div>
          )}

          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl text-sm border" style={{ background: C.errorBg, borderColor: C.errorBorder, color: C.errorText }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: C.textBody }}>
                Email address
              </label>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className={inputClass}
                style={{ background: C.inputBg, border: `1px solid ${C.inputBorder}`, color: C.textDark, "--tw-ring-color": C.focusRing + "50" } as React.CSSProperties}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: C.textBody }}>
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={inputClass + " pr-10"}
                  style={{ background: C.inputBg, border: `1px solid ${C.inputBorder}`, color: C.textDark, "--tw-ring-color": C.focusRing + "50" } as React.CSSProperties}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: C.textMuted }}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="mt-2 text-right">
                <Link href="/forgot-password" className="text-xs font-medium transition-colors hover:opacity-80" style={{ color: C.terracotta }}>
                  Forgot Password?
                </Link>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-opacity mt-2 text-sm hover:opacity-90"
              style={{ background: C.terracotta }}
            >
              {isLoading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <div className="mt-6 pt-5 text-center" style={{ borderTop: `1px solid ${C.border}` }}>
            <p className="text-sm" style={{ color: C.textMuted }}>
              New user?{" "}
              <Link href="/register" className="font-medium transition-colors hover:opacity-80" style={{ color: C.terracotta }}>
                Enroll here
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: C.textMuted }}>
          © 2026 Leavara · Leave of Absence Management
        </p>
      </div>
    </div>
  );
}
