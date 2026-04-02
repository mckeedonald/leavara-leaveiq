import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { Eye, EyeOff } from "lucide-react";

const API_BASE = "";

const C = {
  bg: "#F0EEE9",
  card: "#FFFFFF",
  border: "#D4C9BB",
  terracotta: "#C97E59",
  textDark: "#3D2010",
  textBody: "#5C3D28",
  textMuted: "#8C7058",
  inputBg: "#F7F4F0",
  inputBorder: "#C8BAA8",
  errorBg: "#FDF0EE",
  errorBorder: "#E8A898",
  errorText: "#9E4030",
  successBg: "#F0F7F2",
  successBorder: "#A8D0B8",
  successText: "#2D6A4F",
};

export default function ResetPassword() {
  const [location] = useLocation();
  const token = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : ""
  ).get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Reset failed");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  void location;

  const inputClass = "w-full px-4 py-2.5 rounded-xl text-sm transition-all outline-none focus:ring-2";

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: `linear-gradient(135deg, ${C.bg} 0%, #E8DDD4 100%)` }}>
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <img src="/leavara-logo.png" alt="Leavara" className="h-16 w-16 object-contain mb-4" />
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: C.textDark }}>Leavara LeaveIQ</h1>
          <p className="text-sm mt-1" style={{ color: C.textMuted }}>HR Decision Support Platform</p>
        </div>

        <div className="rounded-2xl p-8 shadow-lg border" style={{ background: C.card, borderColor: C.border }}>
          {!token ? (
            <div className="text-center">
              <p className="text-sm mb-4" style={{ color: C.errorText }}>Invalid or missing reset link.</p>
              <Link href="/login" className="text-sm font-medium transition-colors hover:opacity-80" style={{ color: C.terracotta }}>
                Back to sign in
              </Link>
            </div>
          ) : done ? (
            <div className="text-center">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 border" style={{ background: C.successBg, borderColor: C.successBorder }}>
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: C.successText }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold mb-2" style={{ color: C.textDark }}>Password reset!</h2>
              <p className="text-sm mb-6" style={{ color: C.textBody }}>You can now sign in with your new password.</p>
              <Link
                href="/login"
                className="inline-block px-6 py-2.5 text-white font-semibold rounded-xl text-sm transition-opacity hover:opacity-90"
                style={{ background: C.terracotta }}
              >
                Sign In
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-semibold mb-1" style={{ color: C.textDark }}>Set new password</h2>
              <p className="text-sm mb-6" style={{ color: C.textBody }}>Choose a strong password for your account.</p>

              {error && (
                <div className="mb-4 px-4 py-3 rounded-xl text-sm border" style={{ background: C.errorBg, borderColor: C.errorBorder, color: C.errorText }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: C.textBody }}>New password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      autoFocus
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min. 8 characters"
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
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: C.textBody }}>Confirm password</label>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Repeat your password"
                    className={inputClass}
                    style={{ background: C.inputBg, border: `1px solid ${C.inputBorder}`, color: C.textDark }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-opacity text-sm hover:opacity-90"
                  style={{ background: C.terracotta }}
                >
                  {loading ? "Saving…" : "Reset Password"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
