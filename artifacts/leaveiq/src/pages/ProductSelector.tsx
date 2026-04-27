import React from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { TrendingDown, TrendingUp } from "lucide-react";

const C = {
  bg: "#F0EEE9",
  card: "#FFFFFF",
  border: "#D4C9BB",
  terracotta: "#C97E59",
  teal: "#2E7B7B",
  textDark: "#3D2010",
  textMuted: "#A07860",
};

export default function ProductSelector() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();

  if (!user) {
    navigate("/leaveiq/login");
    return null;
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: `linear-gradient(135deg, ${C.bg} 0%, #E8DDD4 100%)` }}
    >
      <div className="mb-8 text-center">
        <img src="/leavara-logo.png" alt="Leavara" className="h-14 w-14 object-contain mx-auto mb-4" />
        <h1 className="text-2xl font-bold" style={{ color: C.textDark }}>
          Welcome, {user.firstName}
        </h1>
        <p className="text-sm mt-1" style={{ color: C.textMuted }}>
          Select a product to continue
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-5 w-full max-w-xl">
        {user.hasLeaveIq && (
          <button
            onClick={() => navigate("/leaveiq/dashboard")}
            className="flex-1 rounded-2xl p-8 text-left shadow-md border hover:shadow-lg transition-shadow group"
            style={{ background: C.card, borderColor: C.border }}
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
              style={{ background: `${C.terracotta}18` }}
            >
              <TrendingDown className="w-6 h-6" style={{ color: C.terracotta }} />
            </div>
            <h2 className="text-lg font-bold mb-1" style={{ color: C.textDark }}>LeaveIQ</h2>
            <p className="text-sm" style={{ color: C.textMuted }}>
              Leave management, FMLA tracking, and HR case workflow
            </p>
            <div
              className="mt-5 text-sm font-semibold"
              style={{ color: C.terracotta }}
            >
              Open LeaveIQ →
            </div>
          </button>
        )}

        {user.hasPerformIq && (
          <button
            onClick={() => navigate("/performiq/dashboard")}
            className="flex-1 rounded-2xl p-8 text-left shadow-md border hover:shadow-lg transition-shadow group"
            style={{ background: C.card, borderColor: "#C4D9D9" }}
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
              style={{ background: `${C.teal}18` }}
            >
              <TrendingUp className="w-6 h-6" style={{ color: C.teal }} />
            </div>
            <h2 className="text-lg font-bold mb-1" style={{ color: "#1A3333" }}>PerformIQ</h2>
            <p className="text-sm" style={{ color: "#6B9090" }}>
              Performance management, disciplinary documentation, and coaching workflows
            </p>
            <div
              className="mt-5 text-sm font-semibold"
              style={{ color: C.teal }}
            >
              Open PerformIQ →
            </div>
          </button>
        )}
      </div>

      <button
        onClick={() => { logout(); navigate("/leaveiq/login"); }}
        className="mt-8 text-xs hover:opacity-70 transition-opacity"
        style={{ color: C.textMuted }}
      >
        Sign out
      </button>
    </div>
  );
}
