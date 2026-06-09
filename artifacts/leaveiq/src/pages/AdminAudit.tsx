import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { apiFetch } from "@/lib/auth";
import { ClipboardList, Search, Filter, ChevronLeft, ChevronRight, Sparkles, Send, FileText, UserCheck } from "lucide-react";

const C = {
  bg: "#F0EEE9",
  card: "#FFFFFF",
  border: "#D4C9BB",
  terracotta: "#C97E59",
  darkTerra: "#9E5D38",
  textDark: "#3D2010",
  textMid: "#7A5540",
  textMuted: "#A07860",
};

interface AuditEntry {
  id: string;
  action: string;
  actor: string;
  entityId: string;
  caseNumber: string | null;
  employeeFirstName: string | null;
  employeeLastName: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

function actionLabel(action: string): string {
  const map: Record<string, string> = {
    CASE_CREATED: "Case Created",
    AI_RECOMMENDATION_GENERATED: "AI Recommendation",
    AI_DOCUMENTATION_REVIEW: "Doc Review (Ave)",
    HR_DOCUMENT_UPLOADED: "Document Uploaded",
    CASE_CLOSED_RTW_CONFIRMED: "Case Closed — RTW",
    NOTICE_SENT_ELIGIBILITY_NOTICE: "Eligibility Notice Sent",
    NOTICE_SENT_RIGHTS_RESPONSIBILITIES: "Rights & Responsibilities Sent",
    NOTICE_SENT_DESIGNATION_NOTICE: "Designation Notice Sent",
    NOTICE_SENT_MEDICAL_CERTIFICATION: "Medical Certification Sent",
  };
  return map[action] ?? action.replace(/_/g, " ");
}

function actionIcon(action: string) {
  if (action.startsWith("AI_")) return <Sparkles className="w-3.5 h-3.5 text-amber-500" />;
  if (action.startsWith("NOTICE_SENT_")) return <Send className="w-3.5 h-3.5 text-green-600" />;
  if (action === "HR_DOCUMENT_UPLOADED") return <FileText className="w-3.5 h-3.5 text-blue-500" />;
  if (action === "CASE_CREATED") return <UserCheck className="w-3.5 h-3.5" style={{ color: C.terracotta }} />;
  return <ClipboardList className="w-3.5 h-3.5 text-slate-400" />;
}

export default function AdminAudit() {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState("");
  const [actorFilter, setActorFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const params = new URLSearchParams({ page: String(page) });
  if (actionFilter) params.set("action", actionFilter);
  if (actorFilter) params.set("actor", actorFilter);
  if (startDate) params.set("startDate", startDate);
  if (endDate) params.set("endDate", endDate);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-audit", page, actionFilter, actorFilter, startDate, endDate],
    queryFn: () => apiFetch<{ entries: AuditEntry[]; page: number; limit: number }>(`/api/admin/audit?${params.toString()}`),
  });

  const entries = data?.entries ?? [];

  function applyFilters() { setPage(1); }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-6 py-8" style={{ fontFamily: "Inter, sans-serif" }}>
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <ClipboardList className="w-6 h-6" style={{ color: C.terracotta }} />
            <h1 className="text-2xl font-bold" style={{ color: C.textDark, fontFamily: "Plus Jakarta Sans, sans-serif" }}>Audit Log</h1>
          </div>
          <p className="text-sm" style={{ color: C.textMuted }}>Full record of all AI interactions, notice deliveries, case events, and HR actions across your organization.</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border p-4 mb-5 flex flex-wrap gap-3 items-end" style={{ borderColor: C.border }}>
          <div className="flex flex-col gap-1 min-w-[180px]">
            <label className="text-xs font-medium" style={{ color: C.textMid }}>Action keyword</label>
            <div className="flex items-center gap-2 border rounded-lg px-3 py-2" style={{ borderColor: C.border }}>
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                value={actionFilter}
                onChange={e => setActionFilter(e.target.value)}
                placeholder="e.g. AI_RECOMMENDATION"
                className="text-sm outline-none flex-1 bg-transparent"
                style={{ color: C.textDark }}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1 min-w-[180px]">
            <label className="text-xs font-medium" style={{ color: C.textMid }}>Actor (email)</label>
            <div className="flex items-center gap-2 border rounded-lg px-3 py-2" style={{ borderColor: C.border }}>
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                value={actorFilter}
                onChange={e => setActorFilter(e.target.value)}
                placeholder="name@company.com"
                className="text-sm outline-none flex-1 bg-transparent"
                style={{ color: C.textDark }}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: C.textMid }}>From</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: C.border, color: C.textDark }} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: C.textMid }}>To</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: C.border, color: C.textDark }} />
          </div>
          <button
            onClick={applyFilters}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: C.terracotta }}
          >
            <Filter className="w-3.5 h-3.5" /> Apply
          </button>
          <button
            onClick={() => { setActionFilter(""); setActorFilter(""); setStartDate(""); setEndDate(""); setPage(1); }}
            className="px-3 py-2 rounded-lg text-sm border transition-colors hover:bg-slate-50"
            style={{ borderColor: C.border, color: C.textMid }}
          >
            Clear
          </button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: C.border }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: C.textMuted }}>Timestamp</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: C.textMuted }}>Event</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: C.textMuted }}>Case</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: C.textMuted }}>Employee</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: C.textMuted }}>By</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: C.border }}>
                {isLoading && (
                  <tr><td colSpan={5} className="text-center py-12 text-sm" style={{ color: C.textMuted }}>Loading&hellip;</td></tr>
                )}
                {!isLoading && entries.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-12 text-sm" style={{ color: C.textMuted }}>No audit entries found for the selected filters.</td></tr>
                )}
                {entries.map(entry => (
                  <tr key={entry.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: C.textMuted }}>
                      {new Date(entry.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {actionIcon(entry.action)}
                        <span className="font-medium" style={{ color: C.textDark }}>{actionLabel(entry.action)}</span>
                        {entry.metadata && (entry.metadata as any).feedbackProvided && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">w/feedback</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold" style={{ color: C.terracotta }}>
                      {entry.caseNumber ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: C.textDark }}>
                      {[entry.employeeFirstName, entry.employeeLastName].filter(Boolean).join(" ") || "—"}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: C.textMuted }}>
                      {entry.actor}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: C.border }}>
            <p className="text-xs" style={{ color: C.textMuted }}>
              Page {page} &middot; {entries.length} entries shown
            </p>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="p-1.5 rounded-lg border transition-colors disabled:opacity-40 hover:bg-slate-50"
                style={{ borderColor: C.border }}
              >
                <ChevronLeft className="w-4 h-4" style={{ color: C.textMid }} />
              </button>
              <button
                disabled={entries.length < 100}
                onClick={() => setPage(p => p + 1)}
                className="p-1.5 rounded-lg border transition-colors disabled:opacity-40 hover:bg-slate-50"
                style={{ borderColor: C.border }}
              >
                <ChevronRight className="w-4 h-4" style={{ color: C.textMid }} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
