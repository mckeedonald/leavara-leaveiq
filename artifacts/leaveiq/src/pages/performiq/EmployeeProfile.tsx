import React, { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import {
  ArrowLeft,
  Loader2,
  User,
  FolderOpen,
  Calendar,
  Mail,
  MapPin,
  Briefcase,
  Building2,
  ChevronRight,
} from "lucide-react";
import { PiqLayout } from "@/components/performiq/PiqLayout";
import { piqApiFetch } from "@/lib/piqAuth";
import { format } from "date-fns";

const C = {
  perf: "#2E7B7B",
  card: "#FFFFFF",
  border: "#C4D9D9",
  textDark: "#1A3333",
  textMuted: "#6B9090",
  agentBg: "#F0EEE9",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft:             { label: "Draft",              color: "#6B9090", bg: "#EDF1F8" },
  supervisor_review: { label: "Supervisor Review",  color: "#B45309", bg: "#FEF3C7" },
  manager_revision:  { label: "Needs Revision",     color: "#B91C1C", bg: "#FEE2E2" },
  hr_approval:       { label: "HR Approval",        color: "#7C3AED", bg: "#EDE9FE" },
  delivery:          { label: "Ready to Deliver",   color: "#065F46", bg: "#D1FAE5" },
  closed:            { label: "Closed",             color: "#374151", bg: "#F3F4F6" },
  cancelled:         { label: "Cancelled",          color: "#6B7280", bg: "#F3F4F6" },
};

interface Employee {
  id: string;
  fullName: string;
  workEmail: string | null;
  personalEmail: string | null;
  position: string | null;
  department: string | null;
  location: string | null;
  managerName: string | null;
  startDate: string | null;
  isActive: boolean;
  hrisId: string | null;
}

interface Case {
  id: string;
  caseNumber: string;
  status: string;
  docTypeLabel: string | null;
  initiatorName: string | null;
  createdAt: string;
  updatedAt: string;
}

const DOC_TYPE_FILTERS = [
  { label: "All Types", value: "" },
  { label: "Verbal Coaching", value: "coaching" },
  { label: "Written Warning", value: "written_warning" },
  { label: "Final Warning", value: "final_warning" },
  { label: "Performance Review", value: "performance_review" },
  { label: "Goal Setting", value: "goal_setting" },
  { label: "Termination", value: "termination_request" },
];

const STATUS_FILTERS = [
  { label: "All Statuses", value: "" },
  { label: "Draft", value: "draft" },
  { label: "In Review", value: "supervisor_review" },
  { label: "HR Approval", value: "hr_approval" },
  { label: "Ready to Deliver", value: "delivery" },
  { label: "Needs Revision", value: "manager_revision" },
  { label: "Closed", value: "closed" },
];

export default function PiqEmployeeProfile() {
  const { employeeId } = useParams<{ employeeId: string }>();
  const [, navigate] = useLocation();

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [casesLoading, setCasesLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState("");
  const [docTypeFilter, setDocTypeFilter] = useState("");

  useEffect(() => {
    loadEmployee();
    loadCases();
  }, [employeeId]);

  async function loadEmployee() {
    try {
      const data = await piqApiFetch<Employee>(`/api/performiq/employees/${employeeId}`);
      setEmployee(data);
    } catch {
      // handle
    } finally {
      setLoading(false);
    }
  }

  async function loadCases() {
    setCasesLoading(true);
    try {
      const data = await piqApiFetch<Case[]>(`/api/performiq/cases?employeeId=${employeeId}`);
      setCases(data);
    } catch {
      // handle
    } finally {
      setCasesLoading(false);
    }
  }

  const filteredCases = cases.filter((c) => {
    if (statusFilter && c.status !== statusFilter) return false;
    // docTypeFilter matches against docTypeLabel (approximate)
    if (docTypeFilter) {
      const label = (c.docTypeLabel ?? "").toLowerCase();
      const typeMap: Record<string, string[]> = {
        coaching: ["coaching", "verbal"],
        written_warning: ["written warning"],
        final_warning: ["final warning"],
        performance_review: ["performance review"],
        goal_setting: ["goal"],
        termination_request: ["termination"],
      };
      const keywords = typeMap[docTypeFilter] ?? [];
      if (!keywords.some((kw) => label.includes(kw))) return false;
    }
    return true;
  });

  const initials = employee
    ? employee.fullName.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  if (loading) {
    return (
      <PiqLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: C.perf }} />
        </div>
      </PiqLayout>
    );
  }

  if (!employee) {
    return (
      <PiqLayout>
        <div className="text-center py-20" style={{ color: C.textMuted }}>Employee not found.</div>
      </PiqLayout>
    );
  }

  return (
    <PiqLayout>
      <div className="max-w-5xl mx-auto">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm mb-6" style={{ color: C.textMuted }}>
          <button
            onClick={() => navigate("/performiq/employees")}
            className="hover:opacity-70 flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" /> Employees
          </button>
          <ChevronRight className="w-4 h-4" />
          <span style={{ color: C.textDark }}>{employee.fullName}</span>
        </div>

        {/* Employee header card */}
        <div className="rounded-2xl border p-6 mb-6" style={{ background: C.card, borderColor: C.border }}>
          <div className="flex items-start gap-5">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl shrink-0"
              style={{ background: employee.isActive ? C.perf : "#9CA3AF" }}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap mb-1">
                <h1 className="text-2xl font-bold" style={{ color: C.textDark }}>{employee.fullName}</h1>
                <span
                  className="text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={employee.isActive
                    ? { background: "#D1FAE5", color: "#065F46" }
                    : { background: "#F3F4F6", color: "#6B7280" }}
                >
                  {employee.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
                {employee.position && (
                  <div className="flex items-center gap-2 text-sm" style={{ color: C.textMuted }}>
                    <Briefcase className="w-4 h-4 shrink-0" />
                    <span>{employee.position}</span>
                  </div>
                )}
                {employee.department && (
                  <div className="flex items-center gap-2 text-sm" style={{ color: C.textMuted }}>
                    <Building2 className="w-4 h-4 shrink-0" />
                    <span>{employee.department}</span>
                  </div>
                )}
                {employee.location && (
                  <div className="flex items-center gap-2 text-sm" style={{ color: C.textMuted }}>
                    <MapPin className="w-4 h-4 shrink-0" />
                    <span>{employee.location}</span>
                  </div>
                )}
                {employee.workEmail && (
                  <div className="flex items-center gap-2 text-sm" style={{ color: C.textMuted }}>
                    <Mail className="w-4 h-4 shrink-0" />
                    <span className="truncate">{employee.workEmail}</span>
                  </div>
                )}
                {employee.startDate && (
                  <div className="flex items-center gap-2 text-sm" style={{ color: C.textMuted }}>
                    <Calendar className="w-4 h-4 shrink-0" />
                    <span>Hired {format(new Date(employee.startDate), "MMMM d, yyyy")}</span>
                  </div>
                )}
                {employee.managerName && (
                  <div className="flex items-center gap-2 text-sm" style={{ color: C.textMuted }}>
                    <User className="w-4 h-4 shrink-0" />
                    <span>Reports to {employee.managerName}</span>
                  </div>
                )}
              </div>
              {employee.hrisId && (
                <p className="text-xs mt-2" style={{ color: C.textMuted }}>
                  HRIS ID: {employee.hrisId}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Cases section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-lg" style={{ color: C.textDark }}>
                Performance Cases
              </h2>
              <p className="text-sm" style={{ color: C.textMuted }}>
                {cases.length} total case{cases.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-sm border rounded-xl px-3 py-2 outline-none"
              style={{ borderColor: C.border, color: C.textDark, background: C.card }}
            >
              {STATUS_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
            <select
              value={docTypeFilter}
              onChange={(e) => setDocTypeFilter(e.target.value)}
              className="text-sm border rounded-xl px-3 py-2 outline-none"
              style={{ borderColor: C.border, color: C.textDark, background: C.card }}
            >
              {DOC_TYPE_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
            {(statusFilter || docTypeFilter) && (
              <button
                onClick={() => { setStatusFilter(""); setDocTypeFilter(""); }}
                className="text-sm px-3 py-2 rounded-xl border"
                style={{ borderColor: C.border, color: C.textMuted }}
              >
                Clear filters
              </button>
            )}
          </div>

          <div className="rounded-2xl border overflow-hidden" style={{ background: C.card, borderColor: C.border }}>
            {casesLoading ? (
              <div className="p-12 text-center text-sm" style={{ color: C.textMuted }}>Loading cases…</div>
            ) : filteredCases.length === 0 ? (
              <div className="p-12 text-center">
                <FolderOpen className="w-10 h-10 mx-auto mb-3" style={{ color: C.textMuted }} />
                <p className="font-medium mb-1" style={{ color: C.textDark }}>
                  {cases.length === 0 ? "No cases yet" : "No cases match your filters"}
                </p>
                <p className="text-sm" style={{ color: C.textMuted }}>
                  {cases.length === 0
                    ? "No performance cases have been opened for this employee."
                    : "Try adjusting your filters to see more cases."}
                </p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: C.border }}>
                {filteredCases.map((c) => {
                  const sc = STATUS_CONFIG[c.status] ?? { label: c.status, color: "#6B9090", bg: "#EDF1F8" };
                  return (
                    <button
                      key={c.id}
                      onClick={() => navigate(`/performiq/cases/${c.id}`)}
                      className="w-full flex items-center gap-4 px-6 py-4 hover:bg-teal-50/40 transition-colors text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-sm font-medium" style={{ color: C.textDark }}>
                            {c.caseNumber}
                          </span>
                          <span
                            className="text-xs font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: sc.bg, color: sc.color }}
                          >
                            {sc.label}
                          </span>
                        </div>
                        <p className="text-sm" style={{ color: C.textMuted }}>
                          {c.docTypeLabel ?? "Unknown type"}
                          {c.initiatorName && ` · Opened by ${c.initiatorName}`}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs" style={{ color: C.textMuted }}>
                          {format(new Date(c.createdAt), "MMM d, yyyy")}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: C.textMuted }}>
                          Updated {format(new Date(c.updatedAt), "MMM d")}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 shrink-0" style={{ color: C.textMuted }} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </PiqLayout>
  );
}
