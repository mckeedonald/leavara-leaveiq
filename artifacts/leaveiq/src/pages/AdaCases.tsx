import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { Search, Loader2, Filter, Plus, ShieldCheck, X } from "lucide-react";
import { apiFetch, useAuth } from "@/lib/auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface AdaCaseSummary {
  id: string;
  caseNumber: string;
  employeeFirstName?: string | null;
  employeeLastName?: string | null;
  employeeNumber?: string | null;
  accommodationRequested?: string | null;
  status: string;
  displayStatus?: string | null;
  decision?: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  pending_review:     { bg: "#FFF7ED", text: "#92400E", border: "#FDE68A" },
  in_process:         { bg: "#EFF6FF", text: "#1E40AF", border: "#BFDBFE" },
  awaiting_physician: { bg: "#F5F3FF", text: "#5B21B6", border: "#DDD6FE" },
  approved:           { bg: "#F0FDF4", text: "#166534", border: "#BBF7D0" },
  denied:             { bg: "#FEF2F2", text: "#991B1B", border: "#FECACA" },
  closed:             { bg: "#F9FAFB", text: "#374151", border: "#E5E7EB" },
};

const STATUS_LABELS: Record<string, string> = {
  pending_review:     "Pending Review",
  in_process:         "In Process",
  awaiting_physician: "Awaiting Physician",
  approved:           "Approved",
  denied:             "Denied",
  closed:             "Closed",
};

const ALL_STATUSES = Object.keys(STATUS_LABELS);

function StatusBadge({ status }: { status: string }) {
  const colors = STATUS_COLORS[status] ?? { bg: "#F9FAFB", text: "#374151", border: "#E5E7EB" };
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border"
      style={{ background: colors.bg, color: colors.text, borderColor: colors.border }}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

// ── Create ADA Case Modal ──────────────────────────────────────────────────────

function CreateAdaCaseModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [isTemporary, setIsTemporary] = useState(false);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);

    const orgSlug = user?.organizationSlug;
    if (!orgSlug) {
      setError("Unable to determine your organization. Please refresh and try again.");
      return;
    }

    const body = {
      employeeNumber:       fd.get("employeeNumber") as string,
      employeeFirstName:    (fd.get("employeeFirstName") as string) || undefined,
      employeeLastName:     (fd.get("employeeLastName") as string) || undefined,
      employeeEmail:        (fd.get("employeeEmail") as string) || undefined,
      functionalLimitations: fd.get("functionalLimitations") as string,
      accommodationRequested: fd.get("accommodationRequested") as string,
      isTemporary,
      estimatedDuration:    isTemporary ? ((fd.get("estimatedDuration") as string) || undefined) : undefined,
      additionalNotes:      (fd.get("additionalNotes") as string) || undefined,
      submittedBy:          [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "HR",
    };

    setSubmitting(true);
    try {
      const result = await apiFetch<{ case: { id: string } }>(`/api/ada/cases?org=${orgSlug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      queryClient.invalidateQueries({ queryKey: ["ada-cases"] });
      onClose();
      navigate(`/leaveiq/ada-cases/${result.case.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create case. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls = "w-full border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-violet-300 outline-none transition-all bg-white text-sm";
  const labelCls = "text-sm font-semibold text-slate-700";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-lg rounded-2xl shadow-2xl border flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="p-6 border-b flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#EDE9FE" }}>
              <ShieldCheck className="w-4 h-4" style={{ color: "#7C3AED" }} />
            </div>
            <h2 className="text-lg font-display font-bold">New ADA Case</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:bg-slate-200 p-2 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4 overflow-y-auto max-h-[80vh]">
          {error && (
            <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg border border-destructive/20">{error}</div>
          )}

          {/* Employee Info */}
          <div className="rounded-xl border bg-slate-50/50 p-4 space-y-3">
            <p className="text-sm font-semibold text-slate-700 mb-1">Employee Information</p>

            <div className="space-y-1">
              <label className={labelCls}>Employee Number <span className="text-destructive">*</span></label>
              <input required name="employeeNumber" type="text" className={inputCls} placeholder="e.g. 10042" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className={labelCls}>First Name</label>
                <input name="employeeFirstName" type="text" className={inputCls} placeholder="Jane" />
              </div>
              <div className="space-y-1">
                <label className={labelCls}>Last Name</label>
                <input name="employeeLastName" type="text" className={inputCls} placeholder="Smith" />
              </div>
            </div>

            <div className="space-y-1">
              <label className={labelCls}>Employee Email</label>
              <input name="employeeEmail" type="email" className={inputCls} placeholder="jane.smith@company.com" />
            </div>
          </div>

          {/* Accommodation Details */}
          <div className="space-y-1">
            <label className={labelCls}>Functional Limitations <span className="text-destructive">*</span></label>
            <textarea
              required
              name="functionalLimitations"
              rows={3}
              className={inputCls}
              placeholder="Describe the employee's functional limitations that require accommodation…"
            />
          </div>

          <div className="space-y-1">
            <label className={labelCls}>Accommodation Requested <span className="text-destructive">*</span></label>
            <textarea
              required
              name="accommodationRequested"
              rows={3}
              className={inputCls}
              placeholder="Describe the accommodation(s) being requested…"
            />
          </div>

          {/* Temporary toggle */}
          <div className="flex items-center gap-3 p-3 border rounded-xl bg-slate-50/50">
            <input
              type="checkbox"
              id="isTemporary"
              checked={isTemporary}
              onChange={(e) => setIsTemporary(e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 accent-violet-600"
            />
            <div>
              <label htmlFor="isTemporary" className="font-semibold text-sm cursor-pointer">Temporary Accommodation</label>
              <p className="text-xs text-muted-foreground">Check if this accommodation has an expected end date</p>
            </div>
          </div>

          {isTemporary && (
            <div className="space-y-1">
              <label className={labelCls}>Estimated Duration</label>
              <input name="estimatedDuration" type="text" className={inputCls} placeholder="e.g. 6 weeks, 3 months" />
            </div>
          )}

          <div className="space-y-1">
            <label className={labelCls}>Additional Notes</label>
            <textarea
              name="additionalNotes"
              rows={2}
              className={inputCls}
              placeholder="Any additional context or notes…"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={onClose} className="px-5 py-2.5 font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors text-sm">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 font-medium text-white rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center gap-2 text-sm hover:opacity-90"
              style={{ background: "#7C3AED" }}
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Create ADA Case
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function AdaCases() {
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const { data, isLoading } = useQuery<{ cases: AdaCaseSummary[] }>({
    queryKey: ["ada-cases", filterStatus],
    queryFn: () =>
      apiFetch<{ cases: AdaCaseSummary[] }>(
        filterStatus === "ALL" ? "/api/ada/cases" : `/api/ada/cases?status=${filterStatus}`
      ),
  });

  const cases = (data?.cases ?? []).filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const name = [c.employeeFirstName, c.employeeLastName].filter(Boolean).join(" ").toLowerCase();
    return (
      (c.caseNumber ?? "").toLowerCase().includes(q) ||
      name.includes(q) ||
      (c.employeeNumber ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <AppLayout>
      <div className="mb-8 animate-in opacity-0 stagger-1">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#EDE9FE" }}>
            <ShieldCheck className="w-5 h-5" style={{ color: "#7C3AED" }} />
          </div>
          <div>
            <h2 className="text-3xl font-display font-bold text-foreground">ADA Cases</h2>
            <p className="text-muted-foreground mt-0.5">Manage accommodation requests and the interactive process</p>
          </div>
        </div>
      </div>

      <div className="bg-card border shadow-sm rounded-2xl overflow-hidden animate-in opacity-0 stagger-2">
        {/* Toolbar */}
        <div className="p-4 border-b flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50/50">
          <div className="relative w-full sm:max-w-xs">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name or case #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-white border rounded-xl focus:ring-2 focus:ring-violet-300 outline-none transition-all"
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full sm:w-auto py-2 px-3 text-sm bg-white border rounded-xl focus:ring-2 focus:ring-violet-300 outline-none cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              {ALL_STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white whitespace-nowrap shadow-sm hover:opacity-90 transition-all"
              style={{ background: "#7C3AED" }}
            >
              <Plus className="w-4 h-4" /> New ADA Case
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="p-20 flex flex-col items-center justify-center text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin mb-4" style={{ color: "#7C3AED" }} />
            <p>Loading ADA cases...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/30 text-muted-foreground text-xs uppercase tracking-wider font-semibold border-b">
                <tr>
                  <th className="px-6 py-4">Case #</th>
                  <th className="px-6 py-4">Employee</th>
                  <th className="px-6 py-4">Accommodation Requested</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Decision</th>
                  <th className="px-6 py-4">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {cases.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center text-muted-foreground">
                      <ShieldCheck className="w-10 h-10 mx-auto mb-3 opacity-30" style={{ color: "#7C3AED" }} />
                      <p className="font-medium">No ADA cases found</p>
                      <p className="text-xs mt-1">Cases appear here when employees submit accommodation requests, or create one manually above.</p>
                    </td>
                  </tr>
                ) : (
                  cases.map((c) => {
                    const name = [c.employeeFirstName, c.employeeLastName].filter(Boolean).join(" ") ||
                      `Employee #${c.employeeNumber}`;
                    return (
                      <tr key={c.id} className="hover:bg-muted/20 transition-colors group">
                        <td className="px-6 py-4">
                          <Link href={`/leaveiq/ada-cases/${c.id}`}>
                            <span className="font-mono font-semibold text-xs hover:underline cursor-pointer" style={{ color: "#7C3AED" }}>
                              {c.caseNumber}
                            </span>
                          </Link>
                        </td>
                        <td className="px-6 py-4 font-medium text-foreground">{name}</td>
                        <td className="px-6 py-4 text-muted-foreground max-w-[280px]">
                          <span className="line-clamp-2">{c.accommodationRequested ?? "—"}</span>
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={c.status} />
                        </td>
                        <td className="px-6 py-4 text-muted-foreground capitalize">
                          {c.decision ?? "—"}
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">
                          {new Date(c.createdAt).toLocaleDateString("en-US", {
                            month: "short", day: "numeric", year: "numeric",
                          })}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateAdaCaseModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
    </AppLayout>
  );
}
