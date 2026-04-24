import React, { useState } from "react";
import { useLocation, Link } from "wouter";
import { Eye, EyeOff, TrendingUp } from "lucide-react";
import { usePiqAuth } from "@/lib/piqAuth";

const C = {
  bg: "#EDF1F8",
  card: "#FFFFFF",
  border: "#C8D5E8",
  perf: "#4F6FA5",
  perfDark: "#2E4D80",
  textDark: "#1A2D4A",
  textBody: "#3A4F6E",
  textMuted: "#6B7FA8",
  inputBg: "#F4F6FB",
  inputBorder: "#B8C8E0",
  errorBg: "#FDF0EE",
  errorBorder: "#E8A898",
  errorText: "#9E4030",
};

export default function PiqLogin() {
  const { login, isLoading } = usePiqAuth();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionExpired =
    new URLSearchParams(window.location.search).get("reason") === "session_expired";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
      navigate("/performiq/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  }

  const inputClass =
    "w-full px-4 py-2.5 rounded-xl text-sm transition-all outline-none focus:ring-2 focus:ring-blue-300";

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: `linear-gradient(135deg, ${C.bg} 0%, #D9E4F5 100%)` }}
    >
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-lg" style={{ background: C.perf }}>
            <TrendingUp className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: C.textDark }}>
            Perform<span style={{ color: C.perf }}>IQ</span>
          </h1>
          <p className="text-sm mt-1" style={{ color: C.textMuted }}>
            Smart Performance Management · by Leavara
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-8 shadow-lg border" style={{ background: C.card, borderColor: C.border }}>
          <h2 className="text-xl font-semibold mb-6" style={{ color: C.textDark }}>
            Sign in to your account
          </h2>

          {sessionExpired && !error && (
            <div
              className="mb-4 px-4 py-3 rounded-xl text-sm border"
              style={{ background: "#FFF8E7", borderColor: "#F5C842", color: "#7A5A00" }}
            >
              Your session expired. Please sign in again.
            </div>
          )}

          {error && (
            <div
              className="mb-4 px-4 py-3 rounded-xl text-sm border"
              style={{ background: C.errorBg, borderColor: C.errorBorder, color: C.errorText }}
            >
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
                style={{ background: C.inputBg, border: `1px solid ${C.inputBorder}`, color: C.textDark }}
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
                  style={{ background: C.inputBg, border: `1px solid ${C.inputBorder}`, color: C.textDark }}
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
                <Link
                  href="/performiq/forgot-password"
                  className="text-xs font-medium transition-colors hover:opacity-80"
                  style={{ color: C.perf }}
                >
                  Forgot Password?
                </Link>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-opacity mt-2 text-sm hover:opacity-90"
              style={{ background: C.perf }}
            >
              {isLoading ? "Signing in…" : "Sign In"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: C.textMuted }}>
          © 2026 Leavara · PerformIQ Performance Management
        </p>
      </div>
    </div>
  );
}
