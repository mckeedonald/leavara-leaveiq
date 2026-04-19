import React, { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/lib/auth";

const API_BASE = "";

const C = {
  bg: "#F0EEE9",
  card: "#FFFFFF",
  border: "#D4C9BB",
  terracotta: "#C97E59",
  rose: "#EAA292",
  textDark: "#3D2010",
  textBody: "#5C3D28",
  textMuted: "#8C7058",
  inputBg: "#F7F4F0",
  inputBorder: "#C8BAA8",
  errorBg: "#FDF0EE",
  errorBorder: "#E8A898",
  errorText: "#9E4030",
};

interface InviteInfo {
  email: string;
  role: "admin" | "user";
}

export default function Register() {
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const token = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : ""
  ).get("token") ?? "";

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [validating, setValidating] = useState(!!token);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [position, setPosition] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) { navigate("/"); return; }
    if (!token) { setValidating(false); return; }

    fetch(`${API_BASE}/api/auth/invite/validate?token=${token}`)
      .then(async (res) => {
        const data = (await res.json()) as { email?: string; role?: string; error?: string };
        if (!res.ok) throw new Error(data.error ?? "Invalid invitation");
        setInvite({ email: data.email!, role: data.role as "admin" | "user" });
      })
      .catch((err: Error) => setInviteError(err.message))
      .finally(() => setValidating(false));
  }, [token, user, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) { setError("Passwords do not match"); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, firstName, lastName, position, password }),
      });
      const data = (await res.json()) as { error?: string; token?: string };
      if (!res.ok) throw new Error(data.error ?? "Registration failed");
      localStorage.setItem("leaveiq_token", data.token!);
      window.location.href = "/leaveiq/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

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
          {validating ? (
            <p className="text-sm text-center" style={{ color: C.textMuted }}>Validating invitation…</p>
          ) : inviteError ? (
            <div className="text-center">
              <p className="text-sm mb-4" style={{ color: C.errorText }}>{inviteError}</p>
              <Link href="/leaveiq/login" className="text-sm font-medium transition-colors hover:opacity-80" style={{ color: C.terracotta }}>
                Back to sign in
              </Link>
            </div>
          ) : !token ? (
            <div className="text-center">
              <img src="/leavara-logo.png" alt="Leavara" className="h-14 w-14 object-contain mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2" style={{ color: C.textDark }}>Enrollment by Invitation</h2>
              <p className="text-sm mb-6" style={{ color: C.textBody }}>
                To create a Leavara LeaveIQ account, you need an invitation link from your administrator. Please contact your HR administrator to request access.
              </p>
              <Link href="/leaveiq/login" className="text-sm font-medium transition-colors hover:opacity-80" style={{ color: C.terracotta }}>
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold mb-3 border" style={{ background: C.rose + "22", borderColor: C.rose + "55", color: "#9E4030" }}>
                  {invite?.role === "admin" ? "Administrator" : "HR User"} Enrollment
                </span>
                <h2 className="text-xl font-semibold" style={{ color: C.textDark }}>Complete your enrollment</h2>
                <p className="text-sm mt-1" style={{ color: C.textBody }}>
                  You're enrolling as <span className="font-medium">{invite?.email}</span>
                </p>
              </div>

              {error && (
                <div className="mb-4 px-4 py-3 rounded-xl text-sm border" style={{ background: C.errorBg, borderColor: C.errorBorder, color: C.errorText }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: C.textBody }}>First name</label>
                    <input
                      type="text"
                      required
                      autoFocus
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Jane"
                      className={inputClass}
                      style={{ background: C.inputBg, border: `1px solid ${C.inputBorder}`, color: C.textDark }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: C.textBody }}>Last name</label>
                    <input
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Doe"
                      className={inputClass}
                      style={{ background: C.inputBg, border: `1px solid ${C.inputBorder}`, color: C.textDark }}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: C.textBody }}>Position / Title</label>
                  <input
                    type="text"
                    required
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    placeholder="HR Business Partner"
                    className={inputClass}
                    style={{ background: C.inputBg, border: `1px solid ${C.inputBorder}`, color: C.textDark }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: C.textBody }}>Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
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
                  {loading ? "Creating account…" : "Create Account"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
