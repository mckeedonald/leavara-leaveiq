import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { apiFetch, useAuth } from "@/lib/auth";
import { piqApiFetch } from "@/lib/piqAuth";
import {
  ArrowRight,
  LogOut,
  CalendarDays,
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle2,
  FolderOpen,
  Loader2,
} from "lucide-react";

/* ── Brand tokens ───────────────────────────────────────────────── */
const C = {
  bg:           "#F7F4EE",
  card:         "#FFFFFF",
  border:       "#E6DECF",
  textDark:     "#18263A",
  textBody:     "#2A3A4C",
  textMuted:    "#5D6875",
  // Guildlight Leave
  leave:        "#B68B5E",
  leaveDark:    "#8E6A45",
  leaveBg:      "#FBF7EF",
  leaveBorder:  "#E2C49A",
  // Guildlight Grow
  perf:         "#B68B5E",
  perfDark:     "#6B5230",
  perfBg:       "#F4ECDD",
  perfBorder:   "#E4CBA0",
};

/* ── API types ─────────────────────────────────────────────────── */
interface LeaveCase { state: string; createdAt: string; }
interface PerfCase  { status: string; }

function thisMonth(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

/* ── Stat chip ─────────────────────────────────────────────────── */
function StatChip({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-2xl border px-4 py-3"
      style={{ background: C.card, borderColor: C.border }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: accent + "18" }}
      >
        <span style={{ color: accent }}>{icon}</span>
      </div>
      <div>
        <p className="text-2xl font-bold leading-tight" style={{ color: C.textDark }}>
          {value}
        </p>
        <p className="text-xs" style={{ color: C.textMuted }}>
          {label}
        </p>
      </div>
    </div>
  );
}

/* ── Product card ──────────────────────────────────────────────── */
function ProductCard({
  product,
  title,
  subtitle,
  accent,
  accentDark,
  accentBg,
  accentBorder,
  icon,
  stats,
  loading,
  href,
}: {
  product: "leave" | "perf";
  title: string;
  subtitle: string;
  accent: string;
  accentDark: string;
  accentBg: string;
  accentBorder: string;
  icon: React.ReactNode;
  stats: { label: string; value: number | string; icon: React.ReactNode }[];
  loading: boolean;
  href: string;
}) {
  const [, navigate] = useLocation();

  return (
    <div
      className="flex flex-col rounded-3xl border overflow-hidden cursor-pointer group transition-all hover:shadow-lg hover:-translate-y-0.5"
      style={{ background: C.card, borderColor: accentBorder }}
      onClick={() => navigate(href)}
    >
      {/* Colour bar */}
      <div className="h-1.5 w-full" style={{ background: accent }} />

      {/* Header */}
      <div className="px-7 pt-6 pb-5 border-b" style={{ background: accentBg, borderColor: accentBorder }}>
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center"
            style={{ background: accent + "25" }}
          >
            <span style={{ color: accent }}>{icon}</span>
          </div>
          <div>
            <h2 className="text-xl font-bold" style={{ color: C.textDark }}>{title}</h2>
            <p className="text-xs font-medium" style={{ color: accentDark }}>{subtitle}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="px-7 py-5 flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: accent }} />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {stats.map((s) => (
              <StatChip key={s.label} label={s.label} value={s.value} icon={s.icon} accent={accent} />
            ))}
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="px-7 pb-6 pt-2">
        <div
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-sm text-white transition-opacity group-hover:opacity-90"
          style={{ background: accent }}
        >
          Open {title} Dashboard
          <ArrowRight className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
}

/* ── Hub Dashboard ─────────────────────────────────────────────── */
export default function HubDashboard() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();

  const [leaveCases, setLeaveCases]   = useState<LeaveCase[]>([]);
  const [perfCases,  setPerfCases]    = useState<PerfCase[]>([]);
  const [leaveLoading, setLeaveLoading] = useState(true);
  const [perfLoading,  setPerfLoading]  = useState(true);

  useEffect(() => {
    apiFetch<{ cases: LeaveCase[] }>("/api/cases")
      .then((d) => setLeaveCases(d.cases ?? []))
      .catch(() => {})
      .finally(() => setLeaveLoading(false));
  }, []);

  useEffect(() => {
    if (!user?.hasPerformIq) { setPerfLoading(false); return; }
    piqApiFetch<PerfCase[]>("/api/performiq/cases")
      .then(setPerfCases)
      .catch(() => {})
      .finally(() => setPerfLoading(false));
  }, [user?.hasPerformIq]);

  /* Guildlight Leave derived stats */
  const leaveTotal    = leaveCases.length;
  const leavePending  = leaveCases.filter((c) => c.state === "hr_review_queue").length;
  const leaveAnalysis = leaveCases.filter((c) => c.state === "eligibility_analysis").length;
  const leaveNewMonth = leaveCases.filter((c) => thisMonth(c.createdAt)).length;

  /* Guildlight Grow derived stats */
  const perfActive  = perfCases.filter((c) => !["closed", "cancelled"].includes(c.status)).length;
  const perfPending = perfCases.filter((c) =>
    ["draft", "manager_revision", "delivery"].includes(c.status)
  ).length;
  const perfReview  = perfCases.filter((c) =>
    ["supervisor_review", "hr_approval"].includes(c.status)
  ).length;
  const perfClosed  = perfCases.filter((c) => c.status === "closed").length;

  function handleLogout() {
    logout();
    navigate("/leave/login");
  }

  const firstName = user?.firstName ?? "";

  return (
    <div className="min-h-screen flex flex-col" style={{ background: C.bg }}>
      {/* Top bar */}
      <header
        className="navy-hero h-16 sticky top-0 z-50 flex items-center justify-between px-6 shadow-sm"
        style={{ borderBottom: "1px solid #2A3A4C" }}
      >
        <div className="flex items-center gap-2.5">
          <img src="/guildlight-logo.png" alt="Guildlight" className="h-8 w-8 object-contain" />
          <span className="font-bold text-lg tracking-tight" style={{ color: "#F7F4EE" }}>Guildlight</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-70"
          style={{ color: "#C8CDD3" }}
        >
          <LogOut className="w-4 h-4" /> Sign out
        </button>
      </header>

      {/* Page */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-12">
        {/* Welcome */}
        <div className="navy-hero rounded-2xl shadow-premium px-8 py-10 mb-10 text-center">
          <h1 className="text-4xl font-bold mb-1" style={{ color: "#F7F4EE" }}>
            Welcome back{firstName ? `, ${firstName}` : ""}.
          </h1>
          <p className="text-base" style={{ color: "#C8CDD3" }}>
            Here's what's happening across your HR platform today.
          </p>
        </div>

        {/* Product cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {user?.hasLeaveIq && (
            <ProductCard
              product="leave"
              title="Guildlight Leave"
              subtitle="Leave Management"
              accent={C.leave}
              accentDark={C.leaveDark}
              accentBg={C.leaveBg}
              accentBorder={C.leaveBorder}
              icon={<CalendarDays className="w-5 h-5" />}
              href="/leave/dashboard"
              loading={leaveLoading}
              stats={[
                { label: "Total Cases",       value: leaveTotal,    icon: <FolderOpen className="w-4 h-4" /> },
                { label: "Pending HR Review", value: leavePending,  icon: <AlertTriangle className="w-4 h-4" /> },
                { label: "In Analysis",       value: leaveAnalysis, icon: <Clock className="w-4 h-4" /> },
                { label: "New This Month",    value: leaveNewMonth, icon: <CheckCircle2 className="w-4 h-4" /> },
              ]}
            />
          )}

          {user?.hasPerformIq && (
            <ProductCard
              product="perf"
              title="Guildlight Grow"
              subtitle="Performance Management"
              accent={C.perf}
              accentDark={C.perfDark}
              accentBg={C.perfBg}
              accentBorder={C.perfBorder}
              icon={<TrendingUp className="w-5 h-5" />}
              href="/grow/dashboard"
              loading={perfLoading}
              stats={[
                { label: "Active Cases",    value: perfActive,  icon: <FolderOpen className="w-4 h-4" /> },
                { label: "Needs Action",    value: perfPending, icon: <AlertTriangle className="w-4 h-4" /> },
                { label: "In Review",       value: perfReview,  icon: <Clock className="w-4 h-4" /> },
                { label: "Closed Cases",    value: perfClosed,  icon: <CheckCircle2 className="w-4 h-4" /> },
              ]}
            />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-xs" style={{ color: C.textMuted }}>
        © {new Date().getFullYear()} Guildlight, LLC · All rights reserved.
      </footer>
    </div>
  );
}
