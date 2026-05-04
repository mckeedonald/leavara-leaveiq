import React, { useEffect, useState } from "react";
import { Search, Users, CheckCircle2, XCircle, ToggleLeft, ToggleRight, Loader2, ChevronRight } from "lucide-react";
import { PiqLayout } from "@/components/performiq/PiqLayout";
import { piqApiFetch, usePiqRole } from "@/lib/piqAuth";
import { useLocation } from "wouter";
import { format } from "date-fns";

const C = {
  perf: "#2E7B7B",
  card: "#FFFFFF",
  border: "#C4D9D9",
  textDark: "#1A3333",
  textMuted: "#6B9090",
};

interface Employee {
  id: string;
  fullName: string;
  workEmail: string | null;
  position: string | null;
  department: string | null;
  startDate: string | null;
  isActive: boolean;
}

export default function PiqEmployees() {
  const { isHrAdmin } = usePiqRole();
  const [, navigate] = useLocation();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showActive, setShowActive] = useState(true);
  const [deptFilter, setDeptFilter] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    loadEmployees();
  }, []);

  function loadEmployees() {
    setLoading(true);
    piqApiFetch<Employee[]>("/api/performiq/employees")
      .then(setEmployees)
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  async function toggleActive(emp: Employee) {
    if (togglingId) return;
    setTogglingId(emp.id);
    try {
      await piqApiFetch(`/api/performiq/employees/${emp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !emp.isActive }),
      });
      setEmployees((prev) =>
        prev.map((e) => (e.id === emp.id ? { ...e, isActive: !emp.isActive } : e))
      );
    } catch {
      // swallow — employee list will still show current state
    } finally {
      setTogglingId(null);
    }
  }

  const departments = [...new Set(employees.map((e) => e.department).filter(Boolean))].sort() as string[];

  const filtered = employees.filter((e) => {
    const matchesSearch =
      !search ||
      e.fullName.toLowerCase().includes(search.toLowerCase()) ||
      (e.department ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (e.workEmail ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesDept = !deptFilter || e.department === deptFilter;
    return matchesSearch && matchesDept && e.isActive === showActive;
  });

  return (
    <PiqLayout>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: C.textDark }}>Employees</h1>
            <p className="text-sm mt-0.5" style={{ color: C.textMuted }}>
              {employees.filter((e) => e.isActive).length} active · {employees.filter((e) => !e.isActive).length} inactive
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-5">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: C.textMuted }} />
            <input
              type="text"
              placeholder="Search name, department, email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl outline-none border"
              style={{ background: C.card, borderColor: C.border, color: C.textDark }}
            />
          </div>
          {departments.length > 0 && (
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="text-sm border rounded-xl px-3 py-2.5 outline-none"
              style={{ borderColor: C.border, color: deptFilter ? C.textDark : C.textMuted, background: C.card }}
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          )}
          <div className="flex rounded-xl border overflow-hidden" style={{ borderColor: C.border }}>
            {[{ label: "Active", value: true }, { label: "Inactive", value: false }].map(({ label, value }) => (
              <button
                key={label}
                onClick={() => setShowActive(value)}
                className="px-4 py-2.5 text-sm font-medium transition-colors"
                style={
                  showActive === value
                    ? { background: C.perf, color: "#FFF" }
                    : { background: C.card, color: C.textMuted }
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border overflow-hidden" style={{ background: C.card, borderColor: C.border }}>
          {loading ? (
            <div className="p-12 text-center text-sm" style={{ color: C.textMuted }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-10 h-10 mx-auto mb-3" style={{ color: C.textMuted }} />
              <p className="font-medium mb-1" style={{ color: C.textDark }}>No employees found</p>
              <p className="text-sm" style={{ color: C.textMuted }}>
                {employees.length === 0
                  ? "Upload employee data from HRIS Settings to populate this list."
                  : "Try adjusting your filters."}
              </p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: C.border }}>
              {filtered.map((e) => (
                <div key={e.id} className="flex items-center gap-4 px-6 py-4 hover:bg-teal-50/40 transition-colors">
                  {/* Clickable area — navigates to employee profile */}
                  <button
                    onClick={() => navigate(`/performiq/employees/${e.id}`)}
                    className="flex items-center gap-4 flex-1 min-w-0 text-left"
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                      style={{ background: e.isActive ? C.perf : "#9CA3AF" }}
                    >
                      {e.fullName.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm" style={{ color: C.textDark }}>{e.fullName}</p>
                      <p className="text-xs" style={{ color: C.textMuted }}>
                        {[e.position, e.department, e.workEmail].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </button>
                  <div className="flex items-center gap-4 shrink-0">
                    {e.startDate && (
                      <p className="text-xs hidden md:block" style={{ color: C.textMuted }}>
                        Hired {format(new Date(e.startDate), "MMM yyyy")}
                      </p>
                    )}
                    <div className="flex items-center gap-1">
                      {e.isActive ? (
                        <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "#065F46" }} />
                      ) : (
                        <XCircle className="w-3.5 h-3.5" style={{ color: "#6B7280" }} />
                      )}
                      <span className="text-xs" style={{ color: e.isActive ? "#065F46" : "#6B7280" }}>
                        {e.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                    {isHrAdmin && (
                      <button
                        onClick={(ev) => { ev.stopPropagation(); toggleActive(e); }}
                        disabled={togglingId === e.id}
                        title={e.isActive ? "Set Inactive" : "Set Active"}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:opacity-80 disabled:opacity-50"
                        style={
                          e.isActive
                            ? { borderColor: "#FCA5A5", color: "#B91C1C", background: "#FEF2F2" }
                            : { borderColor: C.border, color: C.perf, background: "#EBF5F5" }
                        }
                      >
                        {togglingId === e.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : e.isActive ? (
                          <ToggleLeft className="w-3.5 h-3.5" />
                        ) : (
                          <ToggleRight className="w-3.5 h-3.5" />
                        )}
                        {e.isActive ? "Deactivate" : "Activate"}
                      </button>
                    )}
                    <ChevronRight className="w-4 h-4" style={{ color: C.textMuted }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PiqLayout>
  );
}
