import React, { useEffect, useMemo, useState } from "react";
import { PiqLayout } from "@/components/performiq/PiqLayout";
import { piqApiFetch } from "@/lib/piqAuth";
import { BarChart2, Clock, CheckCircle2, AlertTriangle, FileText, Users } from "lucide-react";

const C = {
  perf: "#2E7B7B",
  perfLight: "#EBF5F5",
  card: "#FFFFFF",
  border: "#C4D9D9",
  textDark: "#1A3333",
  textMuted: "#6B9090",
  agentBg: "#F0EEE9",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "#93C5FD",
  supervisor_review: "#FCD34D",
  manager_revision: "#F87171",
  hr_approval: "#A78BFA",
  delivery: "#34D399",
  closed: "#6B7280",
  cancelled: "#D1D5DB",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  supervisor_review: "Supervisor Review",
  manager_revision: "Needs Revision",
  hr_approval: "HR Approval",
  delivery: "Ready to Deliver",
  closed: "Closed",
  cancelled: "Cancelled",
};

const BASE_TYPE_COLORS: Record<string, string> = {
  coaching: "#2E7B7B",
  written_warning: "#B45309",
  final_warning: "#B91C1C",
};

const BASE_TYPE_LABELS: Record<string, string> = {
  coaching: "Coaching",
  written_warning: "Written Warning",
  final_warning: "Final Warning",
};

const CHART_COLORS = [
  "#2E7B7B", "#B45309", "#B91C1C", "#7C3AED", "#065F46",
  "#1D4ED8", "#6D28D9", "#0891B2", "#4338CA", "#B91C1C",
];

interface CaseSummary {
  id: string;
  caseNumber: string;
  status: string;
  employeeName: string;
  employeeDept: string;
  docTypeLabel: string;
  docBaseType: string;
  createdAt: string;
  updatedAt: string;
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: typeof BarChart2; color: string }) {
  return (
    <div className="rounded-2xl border p-5 flex items-center gap-4" style={{ background: C.card, borderColor: C.border }}>
      <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: color + "20" }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div>
        <p className="text-2xl font-bold" style={{ color: C.textDark }}>{value}</p>
        <p className="text-xs mt-0.5" style={{ color: C.textMuted }}>{label}</p>
      </div>
    </div>
  );
}

function HBar({ label, count, max, color }: { label: string; count: number; max: number; color: string }) {
  const pct = max === 0 ? 0 : Math.round((count / max) * 100);
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs w-36 truncate shrink-0 text-right" style={{ color: C.textMuted }}>{label}</span>
      <div className="flex-1 h-5 rounded-full overflow-hidden" style={{ background: C.agentBg }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-semibold w-6 text-right" style={{ color: C.textDark }}>{count}</span>
    </div>
  );
}

export default function PiqAnalytics() {
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    piqApiFetch<CaseSummary[]>("/api/performiq/cases")
      .then(setCases)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // By status
  const byStatus = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of cases) map[c.status] = (map[c.status] ?? 0) + 1;
    return Object.entries(STATUS_LABELS).map(([key, label]) => ({
      key, label, count: map[key] ?? 0, color: STATUS_COLORS[key] ?? "#9CA3AF",
    })).filter((s) => s.count > 0);
  }, [cases]);

  // By base type
  const byType = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of cases) map[c.docBaseType] = (map[c.docBaseType] ?? 0) + 1;
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => ({
        key,
        label: BASE_TYPE_LABELS[key] ?? key.replace(/_/g, " "),
        count,
        color: BASE_TYPE_COLORS[key] ?? "#9CA3AF",
      }));
  }, [cases]);

  // By department
  const byDept = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of cases) {
      const d = c.employeeDept || "No Department";
      map[d] = (map[d] ?? 0) + 1;
    }
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7)
      .map(([label, count], i) => ({ label, count, color: CHART_COLORS[i % CHART_COLORS.length] }));
  }, [cases]);

  // Monthly volume (last 6 months)
  const monthly = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const next = new Date(now.getFullYear(), now.getMonth() - (5 - i) + 1, 1);
      const label = d.toLocaleString("default", { month: "short", year: "2-digit" });
      const count = cases.filter((c) => { const cd = new Date(c.createdAt); return cd >= d && cd < next; }).length;
      return { label, count };
    });
  }, [cases]);
  const monthlyMax = Math.max(...monthly.map((m) => m.count), 1);

  const activeCases = cases.filter((c) => c.status !== "closed" && c.status !== "cancelled");
  const closedCases = cases.filter((c) => c.status === "closed");
  const needsAction = cases.filter((c) => ["supervisor_review", "hr_approval", "delivery"].includes(c.status));

  const avgClose = useMemo(() => {
    const closed = cases.filter((c) => c.status === "closed" && c.updatedAt && c.createdAt);
    if (!closed.length) return null;
    const total = closed.reduce((sum, c) => sum + (new Date(c.updatedAt).getTime() - new Date(c.createdAt).getTime()) / 86_400_000, 0);
    return Math.round(total / closed.length);
  }, [cases]);

  const statusMax = Math.max(...byStatus.map((s) => s.count), 1);
  const typeMax = Math.max(...byType.map((t) => t.count), 1);
  const deptMax = Math.max(...byDept.map((d) => d.count), 1);

  return (
    <PiqLayout>
      <div className="max-w-5xl mx-auto">
        <div className="mb-7">
          <h1 className="text-2xl font-bold" style={{ color: C.textDark }}>Analytics</h1>
          <p className="text-sm mt-0.5" style={{ color: C.textMuted }}>Performance documentation trends and summaries</p>
        </div>

        {loading ? (
          <div className="text-center py-20 text-sm" style={{ color: C.textMuted }}>Loading analytics…</div>
        ) : cases.length === 0 ? (
          <div className="text-center py-20">
            <BarChart2 className="w-12 h-12 mx-auto mb-3" style={{ color: C.textMuted }} />
            <p className="font-medium" style={{ color: C.textDark }}>No data yet</p>
            <p className="text-sm mt-1" style={{ color: C.textMuted }}>Analytics will appear once cases are created.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Total Cases" value={cases.length} icon={FileText} color={C.perf} />
              <StatCard label="Active Cases" value={activeCases.length} icon={Clock} color="#F97316" />
              <StatCard label="Needs Action" value={needsAction.length} icon={AlertTriangle} color="#B45309" />
              <StatCard label="Avg. Close Time" value={avgClose !== null ? `${avgClose}d` : "—"} icon={CheckCircle2} color={C.perf} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* By status */}
              <div className="rounded-2xl border p-5" style={{ background: C.card, borderColor: C.border }}>
                <p className="font-semibold text-sm mb-4" style={{ color: C.textDark }}>Cases by Status</p>
                {byStatus.length === 0 ? (
                  <p className="text-sm text-center py-6" style={{ color: C.textMuted }}>No data.</p>
                ) : (
                  <div className="space-y-3">
                    {byStatus.map((s) => <HBar key={s.key} label={s.label} count={s.count} max={statusMax} color={s.color} />)}
                  </div>
                )}
              </div>

              {/* By document type */}
              <div className="rounded-2xl border p-5" style={{ background: C.card, borderColor: C.border }}>
                <p className="font-semibold text-sm mb-4" style={{ color: C.textDark }}>Cases by Document Type</p>
                {byType.length === 0 ? (
                  <p className="text-sm text-center py-6" style={{ color: C.textMuted }}>No data.</p>
                ) : (
                  <div className="space-y-3">
                    {byType.map((t) => <HBar key={t.key} label={t.label} count={t.count} max={typeMax} color={t.color} />)}
                  </div>
                )}
              </div>
            </div>

            {/* Monthly volume */}
            <div className="rounded-2xl border p-5" style={{ background: C.card, borderColor: C.border }}>
              <p className="font-semibold text-sm mb-4" style={{ color: C.textDark }}>Monthly Case Volume (Last 6 Months)</p>
              <div className="flex items-end gap-3 h-40">
                {monthly.map((m) => {
                  const pct = m.count / monthlyMax;
                  return (
                    <div key={m.label} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-xs font-semibold" style={{ color: C.textDark }}>{m.count > 0 ? m.count : ""}</span>
                      <div className="w-full rounded-t-lg transition-all duration-500" style={{
                        height: `${Math.max(pct * 120, m.count > 0 ? 8 : 0)}px`,
                        background: C.perf,
                        opacity: pct === 0 ? 0.15 : 1,
                        minHeight: "4px",
                      }} />
                      <span className="text-xs" style={{ color: C.textMuted }}>{m.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* By department */}
              {byDept.length > 0 && (
                <div className="rounded-2xl border p-5" style={{ background: C.card, borderColor: C.border }}>
                  <p className="font-semibold text-sm mb-4" style={{ color: C.textDark }}>Cases by Department</p>
                  <div className="space-y-3">
                    {byDept.map((d) => <HBar key={d.label} label={d.label} count={d.count} max={deptMax} color={d.color} />)}
                  </div>
                </div>
              )}

              {/* Open vs closed */}
              <div className="rounded-2xl border p-5" style={{ background: C.card, borderColor: C.border }}>
                <p className="font-semibold text-sm mb-4" style={{ color: C.textDark }}>Open vs. Closed</p>
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex-1 h-4 rounded-full overflow-hidden flex" style={{ background: "#F3F4F6" }}>
                    <div style={{ width: `${cases.length ? (activeCases.length / cases.length) * 100 : 0}%`, background: C.perf }} className="h-full" />
                    <div style={{ width: `${cases.length ? (closedCases.length / cases.length) * 100 : 0}%`, background: "#6B7280" }} className="h-full" />
                  </div>
                </div>
                <div className="flex gap-4 text-xs mb-6">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: C.perf }} />Open ({activeCases.length})</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: "#6B7280" }} />Closed ({closedCases.length})</span>
                </div>
                <p className="text-4xl font-bold" style={{ color: C.perf }}>
                  {cases.length ? Math.round((closedCases.length / cases.length) * 100) : 0}%
                </p>
                <p className="text-xs mt-1" style={{ color: C.textMuted }}>closure rate — {closedCases.length} of {cases.length} cases</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </PiqLayout>
  );
}
