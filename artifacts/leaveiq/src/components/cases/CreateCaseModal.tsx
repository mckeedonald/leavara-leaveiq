import React, { useState, useEffect, useRef } from "react";
import { useCreateCase, LeaveReasonCategory, getListCasesQueryKey } from "@workspace/api-client-react";
import { LEAVE_REASON_LABELS } from "@/components/ui/StatusBadge";
import { useQueryClient } from "@tanstack/react-query";
import { X, Loader2, UserRound, Sparkles, Search, Check } from "lucide-react";
import { apiFetch } from "@/lib/auth";

interface Employee {
  id: string;
  fullName: string;
  employeeId: string | null;
  workEmail: string | null;
  personalEmail: string | null;
  position: string | null;
  department: string | null;
  location: string | null;
  startDate: string | null;
  avgHoursWorked: string | null;
}

export function CreateCaseModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const createCase = useCreateCase();
  const [error, setError] = useState("");

  // Employee search / autofill
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [empSearch, setEmpSearch] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Form field state for autofill
  const [empNumber, setEmpNumber] = useState("");
  const [empFirstName, setEmpFirstName] = useState("");
  const [empLastName, setEmpLastName] = useState("");
  const [empEmail, setEmpEmail] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    apiFetch<Employee[]>("/api/employees").then(setEmployees).catch(() => {});
  }, [isOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!showDropdown) return;
    const handle = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [showDropdown]);

  const filtered = employees.filter((e) =>
    !empSearch ||
    e.fullName.toLowerCase().includes(empSearch.toLowerCase()) ||
    (e.employeeId ?? "").toLowerCase().includes(empSearch.toLowerCase()) ||
    (e.department ?? "").toLowerCase().includes(empSearch.toLowerCase())
  );

  function selectEmployee(emp: Employee) {
    setSelectedEmployee(emp);
    setShowDropdown(false);
    setEmpSearch(emp.fullName);

    // Autofill fields
    setEmpNumber(emp.employeeId ?? "");
    const parts = emp.fullName.trim().split(" ");
    setEmpFirstName(parts[0] ?? "");
    setEmpLastName(parts.slice(1).join(" "));
    setEmpEmail(emp.personalEmail ?? emp.workEmail ?? "");
  }

  function clearSelection() {
    setSelectedEmployee(null);
    setEmpSearch("");
    setEmpNumber("");
    setEmpFirstName("");
    setEmpLastName("");
    setEmpEmail("");
  }

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);

    const data = {
      employeeNumber: fd.get("employeeNumber") as string,
      employeeFirstName: (fd.get("employeeFirstName") as string) || null,
      employeeLastName: (fd.get("employeeLastName") as string) || null,
      employeeEmail: (fd.get("employeeEmail") as string) || null,
      requestedStart: fd.get("requestedStart") as string,
      requestedEnd: (fd.get("requestedEnd") as string) || null,
      leaveReasonCategory: fd.get("leaveReasonCategory") as LeaveReasonCategory,
      intermittent: fd.get("intermittent") === "on",
      submittedBy: "HR Admin",
    };

    createCase.mutate({ data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCasesQueryKey() });
        onClose();
      },
      onError: (err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to create case");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-lg rounded-2xl shadow-2xl border flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
        <div className="p-6 border-b flex justify-between items-center bg-slate-50/50">
          <h2 className="text-xl font-display font-bold">Intake New Leave Case</h2>
          <button onClick={onClose} className="text-muted-foreground hover:bg-slate-200 p-2 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4 overflow-y-auto max-h-[80vh]">
          {error && <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg border border-destructive/20">{error}</div>}

          {/* Employee Search / Autofill */}
          <div className="rounded-xl border bg-slate-50/50 p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <UserRound className="w-4 h-4 text-[#C97E59]" />
              <span className="text-sm font-semibold text-slate-700">Employee Information</span>
              {employees.length > 0 && (
                <span className="ml-auto flex items-center gap-1 text-[10px] font-medium text-[#9E5D38] bg-[#F5E8DF] px-2 py-0.5 rounded-full">
                  <Sparkles className="w-3 h-3" />
                  {employees.length} employees loaded
                </span>
              )}
            </div>

            {/* Employee search dropdown */}
            {employees.length > 0 && (
              <div className="space-y-1 relative" ref={dropdownRef}>
                <label className="text-sm font-semibold">Search Employee</label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={empSearch}
                    onChange={(e) => {
                      setEmpSearch(e.target.value);
                      setShowDropdown(true);
                      if (!e.target.value) clearSelection();
                    }}
                    onFocus={() => setShowDropdown(true)}
                    className="w-full pl-9 pr-4 border rounded-xl py-2.5 focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-white text-sm"
                    placeholder="Search by name, ID, or department…"
                    autoComplete="off"
                  />
                  {selectedEmployee && (
                    <Check className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-green-600" />
                  )}
                </div>
                {showDropdown && filtered.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                    {filtered.slice(0, 20).map((emp) => (
                      <button
                        key={emp.id}
                        type="button"
                        onClick={() => selectEmployee(emp)}
                        className="w-full px-4 py-2.5 text-left hover:bg-slate-50 transition-colors border-b last:border-0 flex items-center gap-3"
                      >
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                          style={{ background: "#C97E59" }}
                        >
                          {emp.fullName.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{emp.fullName}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {[emp.employeeId, emp.department, emp.position].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-sm font-semibold">Employee Number <span className="text-destructive">*</span></label>
              <input
                required
                name="employeeNumber"
                type="text"
                value={empNumber}
                onChange={(e) => setEmpNumber(e.target.value)}
                className="w-full border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-white"
                placeholder="e.g. 10042"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-semibold">First Name</label>
                <input
                  name="employeeFirstName"
                  type="text"
                  value={empFirstName}
                  onChange={(e) => setEmpFirstName(e.target.value)}
                  className="w-full border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-white"
                  placeholder="Jane"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold">Last Name</label>
                <input
                  name="employeeLastName"
                  type="text"
                  value={empLastName}
                  onChange={(e) => setEmpLastName(e.target.value)}
                  className="w-full border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-white"
                  placeholder="Smith"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-semibold">Employee Email</label>
              <input
                name="employeeEmail"
                type="email"
                value={empEmail}
                onChange={(e) => setEmpEmail(e.target.value)}
                className="w-full border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-white"
                placeholder="jane.smith@company.com"
              />
            </div>
          </div>

          {/* Leave Details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-semibold">Start Date <span className="text-destructive">*</span></label>
              <input required name="requestedStart" type="date" className="w-full border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-white" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold">End Date <span className="text-muted-foreground font-normal">(optional)</span></label>
              <input name="requestedEnd" type="date" className="w-full border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-white" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-semibold">Leave Reason <span className="text-destructive">*</span></label>
            <select required name="leaveReasonCategory" className="w-full border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-white">
              {Object.entries(LeaveReasonCategory).map(([, val]) => (
                <option key={val} value={val}>{LEAVE_REASON_LABELS[val] ?? val}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3 p-3 border rounded-xl bg-slate-50/50">
            <input type="checkbox" id="intermittent" name="intermittent" className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary" />
            <div>
              <label htmlFor="intermittent" className="font-semibold text-sm cursor-pointer">Intermittent Leave</label>
              <p className="text-xs text-muted-foreground">Check if leave is not continuous</p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={onClose} className="px-5 py-2.5 font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={createCase.isPending} className="px-5 py-2.5 font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center gap-2">
              {createCase.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Case
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
