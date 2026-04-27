import React, { useEffect, useState } from "react";
import { Link } from "wouter";
import { FolderOpen, Clock, CheckCircle2, AlertTriangle, Plus, ArrowRight, TrendingUp } from "lucide-react";
import { PiqLayout } from "@/components/performiq/PiqLayout";
import { usePiqAuth, piqApiFetch } from "@/lib/piqAuth";
import { format } from "date-fns";

const C = {
  perf: "#2E7B7B",
  perfDark: "#2E4D80",
  perfLight: "#7B97C4",
  perfBg: "#EDF1F8",
  card: "#FFFFFF",
  border: "#C4D9D9",
  textDark: "#1A3333",
  textMuted: "#6B9090",
};

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

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  draft:             { label: "Draft",              color: "#6B9090", bg: "#EDF1F8",   icon: Clock },
  supervisor_review: { label: "Supervisor Review",  color: "#B45309", bg: "#FEF3C7",  icon: AlertTriangle },
  manager_revision:  { label: "Needs Revision",     color: "#B91C1C", bg: "#FEE2E2",  icon: AlertTriangle },
  hr_approval:       { label: "HR Approval",        color: "#7C3AED", bg: "#EDE9FE",  icon: Clock },
  delivery:          { label: "Ready to Deliver",   color: "#065F46", bg: "#D1FAE5",  icon: CheckCircle2 },
  closed:            { label: "Closed",             color: "#374151", bg: "#F3F4F6",  icon: CheckCircle2 },
  cancelled:         { label: "Cancelled",          color: "#6B7280", bg: "#F3F4F6",  icon: FolderOpen },
};

const BASE_TYPE_BADGE: Record<string, { label: string; color: string }> = {
  coaching:       { label: "Coaching",        color: "#2E7B7B" },
  written_warning:{ label: "Written Warning", color: "#B45309" },
  final_warning:  { label: "Final Warning",   color: "#B91C1C" },
};

export default function PiqDashboard() {
  const { user } = usePiqAuth();
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    piqApiFetch<CaseSummary[]>("/api/performiq/cases")
      .then(setCases)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const activeCases = cases.filter((c) => !["closed", "cancelled"].includes(c.status));
  const pendingAction = cases.filter((c) =>
    ["draft", "manager_revision", "delivery"].includes(c.status),
  );
  const inReview = cases.filter((c) =>
    ["supervisor_review", "hr_approval"].includes(c.status),
  );
  const closed = cases.filter((c) => c.status === "closed");

  const stat = (label: string, value: number, sub: string, color: string) => (
    <div className="rounded-2xl p-5 border" style={{ background: C.card, borderColor: C.border }}>
      <p className="text-sm font-medium mb-1" style={{ color: C.textMuted }}>{label}</p>
      <p className="text-3xl font-bold" style={{ color }}>{value}</p>
      <p className="text-xs mt-1" style={{ color: C.textMuted }}>{sub}</p>
    </div>
  );

  return (
    <PiqLayout>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: C.textDark }}>
              Welcome back, {user?.fullName.split(" ")[0]}
            </h1>
            <p className="text-sm mt-0.5" style={{ color: C.textMuted }}>
              Performance Management Dashboard
            </p>
          </div>
          <Link
            href="/performiq/cases/new"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: C.perf }}
          >
            <Plus className="w-4 h-4" />
            New Case
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {stat("Active Cases", activeCases.length, "in progress", C.perf)}
          {stat("Needs Your Action", pendingAction.length, "draft or revision needed", "#B45309")}
          {stat("In Review", inReview.length, "with supervisor or HR", "#7C3AED")}
          {stat("Closed", closed.length, "completed this year", "#065F46")}
        </div>

        {/* Recent Cases */}
        <div className="rounded-2xl border overflow-hidden" style={{ background: C.card, borderColor: C.border }}>
          <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${C.border}` }}>
            <h2 className="font-semibold" style={{ color: C.textDark }}>Recent Cases</h2>
            <Link href="/performiq/cases" className="text-xs font-medium hover:opacity-80" style={{ color: C.perf }}>
              View all <ArrowRight className="w-3 h-3 inline" />
            </Link>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm" style={{ color: C.textMuted }}>Loading…</div>
          ) : cases.length === 0 ? (
            <div className="p-12 text-center">
              <TrendingUp className="w-10 h-10 mx-auto mb-3" style={{ color: C.textMuted }} />
              <p className="font-medium mb-1" style={{ color: C.textDark }}>No cases yet</p>
              <p className="text-sm mb-4" style={{ color: C.textMuted }}>
                Start a new case to begin the documentation process.
              </p>
              <Link
                href="/performiq/cases/new"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
                style={{ background: C.perf }}
              >
                <Plus className="w-4 h-4" /> Create First Case
              </Link>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: C.border }}>
              {cases.slice(0, 8).map((c) => {
                const sc = STATUS_CONFIG[c.status] ?? { label: c.status, color: "#6B9090", bg: "#EDF1F8", icon: Clock };
                const bt = BASE_TYPE_BADGE[c.docBaseType];
                return (
                  <Link
                    key={c.id}
                    href={`/performiq/cases/${c.id}`}
                    className="flex items-center gap-4 px-6 py-4 hover:bg-blue-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono font-semibold" style={{ color: C.textMuted }}>
                          {c.caseNumber}
                        </span>
                        {bt && (
                          <span
                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                            style={{ background: bt.color + "18", color: bt.color }}
                          >
                            {bt.label}
                          </span>
                        )}
                      </div>
                      <p className="font-medium text-sm truncate" style={{ color: C.textDark }}>
                        {c.employeeName}
                      </p>
                      <p className="text-xs truncate" style={{ color: C.textMuted }}>
                        {c.employeeDept} · {c.docTypeLabel}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className="text-xs font-semibold px-2.5 py-1 rounded-full"
                        style={{ background: sc.bg, color: sc.color }}
                      >
                        {sc.label}
                      </span>
                      <span className="text-xs" style={{ color: C.textMuted }}>
                        {format(new Date(c.updatedAt), "MMM d")}
                      </span>
                      <ArrowRight className="w-4 h-4" style={{ color: C.textMuted }} />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </PiqLayout>
  );
}
