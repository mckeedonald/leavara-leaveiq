import React from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { TrendingDown, TrendingUp } from "lucide-react";

const C = {
  bg: "#F7F4EE",
  card: "#FFFFFF",
  border: "#E6DECF",
  terracotta: "#B68B5E",
  teal: "#B68B5E",
  textDark: "#18263A",
  textMuted: "#A89066",
};

export default function ProductSelector() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();

  if (!user) {
    navigate("/leave/login");
    return null;
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: `linear-gradient(135deg, ${C.bg} 0%, #EBE3D4 100%)` }}
    >
      <div className="navy-hero rounded-2xl shadow-premium px-10 py-8 mb-8 text-center w-full max-w-xl">
        <img src="/guildlight-logo.png" alt="Guildlight" className="h-14 w-14 object-contain mx-auto mb-4" />
        <h1 className="text-2xl font-bold" style={{ color: "#F7F4EE" }}>
          Welcome, {user.firstName}
        </h1>
        <p className="text-sm mt-1" style={{ color: "#C8CDD3" }}>
          Select a product to continue
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-5 w-full max-w-xl">
        {user.hasLeaveIq && (
          <button
            onClick={() => navigate("/leave/dashboard")}
            className="flex-1 rounded-2xl p-8 text-left shadow-md border hover:shadow-lg transition-shadow group"
            style={{ background: C.card, borderColor: C.border }}
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
              style={{ background: `${C.terracotta}18` }}
            >
              <TrendingDown className="w-6 h-6" style={{ color: C.terracotta }} />
            </div>
            <h2 className="text-lg font-bold mb-1" style={{ color: C.textDark }}>Guildlight Leave</h2>
            <p className="text-sm" style={{ color: C.textMuted }}>
              Leave management, FMLA tracking, and HR case workflow
            </p>
            <div
              className="mt-5 text-sm font-semibold"
              style={{ color: C.terracotta }}
            >
              Open Guildlight Leave →
            </div>
          </button>
        )}

        {user.hasPerformIq && (
          <button
            onClick={() => navigate("/grow/dashboard")}
            className="flex-1 rounded-2xl p-8 text-left shadow-md border hover:shadow-lg transition-shadow group"
            style={{ background: C.card, borderColor: "#E8DBC4" }}
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
              style={{ background: `${C.teal}18` }}
            >
              <TrendingUp className="w-6 h-6" style={{ color: C.teal }} />
            </div>
            <h2 className="text-lg font-bold mb-1" style={{ color: "#5E4A2E" }}>Guildlight Grow</h2>
            <p className="text-sm" style={{ color: "#C6A074" }}>
              Performance management, disciplinary documentation, and coaching workflows
            </p>
            <div
              className="mt-5 text-sm font-semibold"
              style={{ color: C.teal }}
            >
              Open Guildlight Grow →
            </div>
          </button>
        )}
      </div>

      <button
        onClick={() => { logout(); navigate("/leave/login"); }}
        className="mt-8 text-xs hover:opacity-70 transition-opacity"
        style={{ color: C.textMuted }}
      >
        Sign out
      </button>
    </div>
  );
}
