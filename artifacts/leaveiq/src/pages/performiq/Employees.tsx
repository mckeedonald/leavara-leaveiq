import React, { useEffect, useState } from "react";
import { Search, UserPlus, Users, ChevronRight, CheckCircle2, XCircle } from "lucide-react";
import { PiqLayout } from "@/components/performiq/PiqLayout";
import { piqApiFetch } from "@/lib/piqAuth";
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
  jobTitle: string | null;
  department: string | null;
  hireDate: string | null;
  isActive: boolean;
}

export default function PiqEmployees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showActive, setShowActive] = useState(true);

  useEffect(() => {
    piqApiFetch<Employee[]>("/api/performiq/employees")
      .then(setEmployees)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = employees.filter((e) => {
    const matchesSearch =
      !search ||
      e.fullName.toLowerCase().includes(search.toLowerCase()) ||
      (e.department ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (e.workEmail ?? "").toLowerCase().includes(search.toLowerCase());
    return matchesSearch && e.isActive === showActive;
  });

  return (
    <PiqLayout>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: C.textDark }}>Employees</h1>
            <p className="text-sm mt-0.5" style={{ color: C.textMuted }}>
              {employees.filter((e) => e.isActive).length} active
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-5">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: C.textMuted }} />
            <input
              type="text"
              placeholder="Search name, department…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl outline-none border"
              style={{ background: C.card, borderColor: C.border, color: C.textDark }}
            />
          </div>
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
                  ? "Employees sync via HRIS or can be added by an HR Admin."
                  : "Try adjusting your filters."}
              </p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: C.border }}>
              {filtered.map((e) => (
                <div key={e.id} className="flex items-center gap-4 px-6 py-4 hover:bg-blue-50 transition-colors">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                    style={{ background: e.isActive ? C.perf : "#9CA3AF" }}
                  >
                    {e.fullName.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm" style={{ color: C.textDark }}>{e.fullName}</p>
                    <p className="text-xs" style={{ color: C.textMuted }}>
                      {[e.jobTitle, e.department, e.workEmail].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    {e.hireDate && (
                      <p className="text-xs" style={{ color: C.textMuted }}>
                        Hired {format(new Date(e.hireDate), "MMM yyyy")}
                      </p>
                    )}
                    <div className="flex items-center gap-1 justify-end mt-0.5">
                      {e.isActive ? (
                        <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "#065F46" }} />
                      ) : (
                        <XCircle className="w-3.5 h-3.5" style={{ color: "#6B7280" }} />
                      )}
                      <span className="text-xs" style={{ color: e.isActive ? "#065F46" : "#6B7280" }}>
                        {e.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
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
