import React, { useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useListCases, LeaveState } from "@workspace/api-client-react";
import { BarChart2, TrendingUp, Clock, CheckCircle2, Users, FileText } from "lucide-react";

const PALETTE = {
  primary: "#C97E59",
  primaryLight: "#FDEBD9",
  teal: "#2E7B7B",
  tealLight: "#EBF5F5",
  card: "#FFFFFF",
  border: "#E8DDD4",
  bg: "#FAF8F5",
  textDark: "#3D2010",
  textMuted: "#8C7058",
};

const STATE_LABELS: Record<string, string> = {
  INTAKE: "Intake",
  ELIGIBILITY_ANALYSIS: "Eligibility Analysis",
  HR_REVIEW_QUEUE: "HR Review",
  NOTICE_DRAFTED: "Notice Drafted",
  CLOSED: "Closed",
};

const STATE_COLORS: Record<string, string> = {
  INTAKE: "#93C5FD",
  ELIGIBILITY_ANALYSIS: "#FCD34D",
  HR_REVIEW_QUEUE: "#F97316",
  NOTICE_DRAFTED: "#A78BFA",
  CLOSED: "#34D399",
};

const REASON_COLORS = [
  "#C97E59", "#2E7B7B", "#7C3AED", "#B45309", "#065F46",
  "#1D4ED8", "#B91C1C", "#4338CA", "#0891B2", "#6D28D9",
];

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: typeof BarChart2; color: string }) {
  return (
    <div className="rounded-2xl border p-5 flex items-center gap-4" style={{ background: PALETTE.card, borderColor: PALETTE.border }}>
      <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: color + "20" }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div>
        <p className="text-2xl font-bold" style={{ color: PALETTE.textDark }}>{value}</p>
        <p className="text-xs mt-0.5" style={{ color: PALETTE.textMuted }}>{label}</p>
      </div>
    </div>
  );
}

function HBar({ label, count, max, color }: { label: string; count: number; max: number; color: string }) {
  const pct = max === 0 ? 0 : Math.round((count / max) * 100);
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs w-36 truncate shrink-0 text-right" style={{ color: PALETTE.textMuted }}>{label}</span>
      <div className="flex-1 h-5 rounded-full overflow-hidden" style={{ background: PALETTE.primaryLight }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="text-xs font-semibold w-6 text-right" style={{ color: PALETTE.textDark }}>{count}</span>
    </div>
  );
}

export default function Analytics() {
  const { data: casesData, isLoading } = useListCases();
  const cases = casesData?.cases ?? [];

  // Cases by state
  const byState = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of cases) map[c.state] = (map[c.state] ?? 0) + 1;
    return Object.entries(STATE_LABELS).map(([key, label]) => ({
      key, label, count: map[key] ?? 0, color: STATE_COLORS[key] ?? "#9CA3AF",
    }));
  }, [cases]);

  // Cases by leave reason
  const byReason = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of cases) {
      const r = c.leaveReasonCategory ?? "unknown";
      map[r] = (map[r] ?? 0) + 1;
    }
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([key, count], i) => ({
        key,
        label: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, " "),
        count,
        color: REASON_COLORS[i % REASON_COLORS.length],
      }));
  }, [cases]);

  // Monthly volume (last 6 months)
  const monthly = useMemo(() => {
    const now = new Date();
    const months: { label: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const label = d.toLocaleString("default", { month: "short", year: "2-digit" });
      const count = cases.filter((c) => {
        const cd = new Date(c.createdAt);
        return cd >= d && cd < next;
      }).length;
      months.push({ label, count });
    }
    return months;
  }, [cases]);
  const monthlyMax = Math.max(...monthly.map((m) => m.count), 1);

  const activeCases = cases.filter((c) => c.state !== "CLOSED");
  const closedCases = cases.filter((c) => c.state === "CLOSED");
  const hrReview = cases.filter((c) => c.state === "HR_REVIEW_QUEUE");

  // Avg close time (days)
  const avgClose = useMemo(() => {
    const closed = cases.filter((c) => c.state === "CLOSED" && c.updatedAt && c.createdAt);
    if (!closed.length) return null;
    const totalDays = closed.reduce((sum, c) => {
      const days = (new Date(c.updatedAt).getTime() - new Date(c.createdAt).getTime()) / 86_400_000;
      return sum + days;
    }, 0);
    return Math.round(totalDays / closed.length);
  }, [cases]);

  const stateMax = Math.max(...byState.map((s) => s.count), 1);
  const reasonMax = Math.max(...byReason.map((r) => r.count), 1);

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto">
        <div className="mb-7">
          <h2 className="text-3xl font-bold" style={{ color: PALETTE.textDark }}>Analytics</h2>
          <p className="text-sm mt-1" style={{ color: PALETTE.textMuted }}>Leave case trends and summaries for your organization</p>
        </div>

        {isLoading ? (
          <div className="text-center py-20 text-sm" style={{ color: PALETTE.textMuted }}>Loading analytics…</div>
        ) : cases.length === 0 ? (
          <div className="text-center py-20">
            <BarChart2 className="w-12 h-12 mx-auto mb-3" style={{ color: PALETTE.textMuted }} />
            <p className="font-medium" style={{ color: PALETTE.textDark }}>No data yet</p>
            <p className="text-sm mt-1" style={{ color: PALETTE.textMuted }}>Analytics will appear once cases are created.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Top stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Total Cases" value={cases.length} icon={FileText} color={PALETTE.primary} />
              <StatCard label="Active Cases" value={activeCases.length} icon={Clock} color="#F97316" />
              <StatCard label="Awaiting HR Review" value={hrReview.length} icon={Users} color="#7C3AED" />
              <StatCard label="Avg. Close Time" value={avgClose !== null ? `${avgClose}d` : "—"} icon={CheckCircle2} color={PALETTE.teal} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Cases by state */}
              <div className="rounded-2xl border p-5" style={{ background: PALETTE.card, borderColor: PALETTE.border }}>
                <p className="font-semibold text-sm mb-4" style={{ color: PALETTE.textDark }}>Cases by Status</p>
                <div className="space-y-3">
                  {byState.map((s) => (
                    <HBar key={s.key} label={s.label} count={s.count} max={stateMax} color={s.color} />
                  ))}
                </div>
              </div>

              {/* Cases by reason */}
              <div className="rounded-2xl border p-5" style={{ background: PALETTE.card, borderColor: PALETTE.border }}>
                <p className="font-semibold text-sm mb-4" style={{ color: PALETTE.textDark }}>Cases by Leave Reason</p>
                {byReason.length === 0 ? (
                  <p className="text-sm text-center py-6" style={{ color: PALETTE.textMuted }}>No reason data available.</p>
                ) : (
                  <div className="space-y-3">
                    {byReason.map((r) => (
                      <HBar key={r.key} label={r.label} count={r.count} max={reasonMax} color={r.color} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Monthly volume */}
            <div className="rounded-2xl border p-5" style={{ background: PALETTE.card, borderColor: PALETTE.border }}>
              <p className="font-semibold text-sm mb-4" style={{ color: PALETTE.textDark }}>Monthly Case Volume (Last 6 Months)</p>
              <div className="flex items-end gap-3 h-40">
                {monthly.map((m) => {
                  const pct = monthlyMax === 0 ? 0 : m.count / monthlyMax;
                  return (
                    <div key={m.label} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-xs font-semibold" style={{ color: PALETTE.textDark }}>{m.count > 0 ? m.count : ""}</span>
                      <div className="w-full rounded-t-lg transition-all duration-500" style={{
                        height: `${Math.max(pct * 120, m.count > 0 ? 8 : 0)}px`,
                        background: PALETTE.primary,
                        opacity: pct === 0 ? 0.15 : 1,
                        minHeight: "4px",
                      }} />
                      <span className="text-xs" style={{ color: PALETTE.textMuted }}>{m.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Open vs closed */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="rounded-2xl border p-5 col-span-1" style={{ background: PALETTE.card, borderColor: PALETTE.border }}>
                <p className="font-semibold text-sm mb-4" style={{ color: PALETTE.textDark }}>Open vs. Closed</p>
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex-1 h-4 rounded-full overflow-hidden flex" style={{ background: "#F3F4F6" }}>
                    <div style={{ width: `${cases.length ? (activeCases.length / cases.length) * 100 : 0}%`, background: PALETTE.primary }} className="h-full" />
                    <div style={{ width: `${cases.length ? (closedCases.length / cases.length) * 100 : 0}%`, background: PALETTE.teal }} className="h-full" />
                  </div>
                </div>
                <div className="flex gap-4 text-xs">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: PALETTE.primary }} />Open ({activeCases.length})</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: PALETTE.teal }} />Closed ({closedCases.length})</span>
                </div>
              </div>
              <div className="rounded-2xl border p-5 col-span-2" style={{ background: PALETTE.card, borderColor: PALETTE.border }}>
                <p className="font-semibold text-sm mb-1" style={{ color: PALETTE.textDark }}>Closure Rate</p>
                <p className="text-4xl font-bold mt-3" style={{ color: PALETTE.teal }}>
                  {cases.length ? Math.round((closedCases.length / cases.length) * 100) : 0}%
                </p>
                <p className="text-xs mt-1" style={{ color: PALETTE.textMuted }}>
                  {closedCases.length} of {cases.length} total cases closed
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
