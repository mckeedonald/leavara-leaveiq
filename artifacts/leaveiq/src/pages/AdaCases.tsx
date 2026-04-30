import React, { useState } from "react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { Search, Loader2, Filter, Plus, ShieldCheck } from "lucide-react";
import { apiFetch } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";

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

export default function AdaCases() {
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

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
            <Link href="/leaveiq/ada-cases/new">
              <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white whitespace-nowrap shadow-sm hover:opacity-90 transition-all"
                style={{ background: "#7C3AED" }}>
                <Plus className="w-4 h-4" /> New ADA Case
              </button>
            </Link>
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
                      <p className="text-xs mt-1">Cases will appear here when employees submit accommodation requests.</p>
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
    </AppLayout>
  );
}
