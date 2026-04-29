import React, { useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import { Search, Plus, Filter, FolderOpen, ArrowRight, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import { PiqLayout } from "@/components/performiq/PiqLayout";
import { piqApiFetch } from "@/lib/piqAuth";
import { format } from "date-fns";

const C = {
  perf: "#2E7B7B",
  card: "#FFFFFF",
  border: "#C4D9D9",
  textDark: "#1A3333",
  textMuted: "#6B9090",
  bg: "#F0EEE9",
};

interface CaseSummary {
  id: string;
  caseNumber: string;
  status: string;
  employeeName: string;
  employeeDept: string;
  docTypeLabel: string;
  docBaseType: string;
  initiatorName: string;
  createdAt: string;
  updatedAt: string;
}

const ALL_STATUSES = [
  { value: "", label: "All Statuses" },
  { value: "draft", label: "Draft" },
  { value: "supervisor_review", label: "Supervisor Review" },
  { value: "manager_revision", label: "Manager Revision" },
  { value: "hr_approval", label: "HR Approval" },
  { value: "delivery", label: "Ready to Deliver" },
  { value: "closed", label: "Closed" },
  { value: "cancelled", label: "Cancelled" },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft:             { label: "Draft",              color: "#6B9090", bg: "#EDF1F8" },
  supervisor_review: { label: "Supervisor Review",  color: "#B45309", bg: "#FEF3C7" },
  manager_revision:  { label: "Needs Revision",     color: "#B91C1C", bg: "#FEE2E2" },
  hr_approval:       { label: "HR Approval",        color: "#7C3AED", bg: "#EDE9FE" },
  delivery:          { label: "Ready to Deliver",   color: "#065F46", bg: "#D1FAE5" },
  closed:            { label: "Closed",             color: "#374151", bg: "#F3F4F6" },
  cancelled:         { label: "Cancelled",          color: "#6B7280", bg: "#F3F4F6" },
};

const BASE_TYPE_COLOR: Record<string, string> = {
  coaching:        "#2E7B7B",
  written_warning: "#B45309",
  final_warning:   "#B91C1C",
};

export default function PiqCaseList() {
  const searchStr = useSearch();
  const urlParams = new URLSearchParams(searchStr);
  const initialStatus = urlParams.get("status") ?? "";

  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(initialStatus);

  useEffect(() => {
    piqApiFetch<CaseSummary[]>("/api/performiq/cases")
      .then(setCases)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = cases.filter((c) => {
    const matchesSearch =
      !search ||
      c.employeeName.toLowerCase().includes(search.toLowerCase()) ||
      c.caseNumber.toLowerCase().includes(search.toLowerCase()) ||
      (c.employeeDept ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <PiqLayout>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: C.textDark }}>Cases</h1>
            <p className="text-sm mt-0.5" style={{ color: C.textMuted }}>
              {cases.length} total · {cases.filter((c) => !["closed", "cancelled"].includes(c.status)).length} active
            </p>
          </div>
          <Link
            href="/performiq/cases/new"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
            style={{ background: C.perf }}
          >
            <Plus className="w-4 h-4" /> New Case
          </Link>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-5">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: C.textMuted }} />
            <input
              type="text"
              placeholder="Search employee, case number…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl outline-none border"
              style={{ background: C.card, borderColor: C.border, color: C.textDark }}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 text-sm rounded-xl border outline-none"
            style={{ background: C.card, borderColor: C.border, color: C.textDark }}
          >
            {ALL_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="rounded-2xl border overflow-hidden" style={{ background: C.card, borderColor: C.border }}>
          {loading ? (
            <div className="p-12 text-center text-sm" style={{ color: C.textMuted }}>Loading cases…</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <FolderOpen className="w-10 h-10 mx-auto mb-3" style={{ color: C.textMuted }} />
              <p className="font-medium mb-1" style={{ color: C.textDark }}>No cases found</p>
              <p className="text-sm" style={{ color: C.textMuted }}>
                {cases.length === 0
                  ? "Create your first performance case to get started."
                  : "Try adjusting your search or filter."}
              </p>
            </div>
          ) : (
            <>
              {/* Column headers */}
              <div
                className="grid grid-cols-12 gap-4 px-6 py-3 text-xs font-semibold uppercase tracking-wide"
                style={{ background: "#F8FAFD", borderBottom: `1px solid ${C.border}`, color: C.textMuted }}
              >
                <div className="col-span-1">Case #</div>
                <div className="col-span-3">Employee</div>
                <div className="col-span-2">Type</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-2">Initiated By</div>
                <div className="col-span-1">Updated</div>
                <div className="col-span-1" />
              </div>
              <div className="divide-y" style={{ borderColor: C.border }}>
                {filtered.map((c) => {
                  const sc = STATUS_CONFIG[c.status] ?? { label: c.status, color: "#6B9090", bg: "#EDF1F8" };
                  const baseColor = BASE_TYPE_COLOR[c.docBaseType] ?? C.perf;
                  return (
                    <Link
                      key={c.id}
                      href={`/performiq/cases/${c.id}`}
                      className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-blue-50 transition-colors"
                    >
                      <div className="col-span-1">
                        <span className="text-xs font-mono font-semibold" style={{ color: C.textMuted }}>
                          {c.caseNumber}
                        </span>
                      </div>
                      <div className="col-span-3 min-w-0">
                        <p className="font-medium text-sm truncate" style={{ color: C.textDark }}>{c.employeeName}</p>
                        <p className="text-xs truncate" style={{ color: C.textMuted }}>{c.employeeDept}</p>
                      </div>
                      <div className="col-span-2">
                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded-full truncate block"
                          style={{ background: baseColor + "18", color: baseColor, maxWidth: "fit-content" }}
                        >
                          {c.docTypeLabel}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: sc.bg, color: sc.color }}
                        >
                          {sc.label}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs truncate" style={{ color: C.textMuted }}>{c.initiatorName}</p>
                      </div>
                      <div className="col-span-1">
                        <p className="text-xs" style={{ color: C.textMuted }}>
                          {format(new Date(c.updatedAt), "MMM d")}
                        </p>
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <ArrowRight className="w-4 h-4" style={{ color: C.textMuted }} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </PiqLayout>
  );
}
