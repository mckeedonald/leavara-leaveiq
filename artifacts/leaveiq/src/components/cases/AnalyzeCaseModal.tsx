import React, { useState, useEffect } from "react";
import { useAnalyzeCase, getGetCaseQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { X, Loader2, Info, Sparkles } from "lucide-react";
import { apiFetch } from "@/lib/auth";

interface Employee {
  id: string;
  fullName: string;
  employeeId: string | null;
  startDate: string | null;
  avgHoursWorked: string | null;
}

interface CaseDataProp {
  caseNumber?: string;
  employeeNumber?: string;
  employeeFirstName?: string | null;
  employeeLastName?: string | null;
}

export function AnalyzeCaseModal({
  isOpen,
  onClose,
  caseId,
  caseData,
}: {
  isOpen: boolean;
  onClose: () => void;
  caseId: string;
  caseData?: CaseDataProp;
}) {
  const queryClient = useQueryClient();
  const analyzeCase = useAnalyzeCase();
  const [error, setError] = useState("");

  // Auto-populated from HRIS
  const [hireDate, setHireDate] = useState("");
  const [avgHours, setAvgHours] = useState<number>(40);
  const [autoFilled, setAutoFilled] = useState(false);
  const [loadingHris, setLoadingHris] = useState(false);

  const employeeName = caseData
    ? [caseData.employeeFirstName, caseData.employeeLastName].filter(Boolean).join(" ") ||
      (caseData.employeeNumber ? `Employee #${caseData.employeeNumber}` : null)
    : null;

  // Try to fetch employee data from HRIS when modal opens
  useEffect(() => {
    if (!isOpen || !caseData?.employeeNumber) return;
    setLoadingHris(true);
    apiFetch<Employee[]>("/api/employees")
      .then((employees) => {
        const match = employees.find(
          (e) =>
            e.employeeId === caseData.employeeNumber ||
            e.employeeId === `EMP-${caseData.employeeNumber}` ||
            e.employeeId?.replace(/^EMP-/i, "") === caseData.employeeNumber,
        );
        if (match) {
          if (match.startDate) setHireDate(match.startDate);
          if (match.avgHoursWorked) {
            const parsed = parseFloat(match.avgHoursWorked);
            if (!isNaN(parsed)) setAvgHours(parsed);
          }
          if (match.startDate || match.avgHoursWorked) setAutoFilled(true);
        }
      })
      .catch(() => {}) // non-fatal
      .finally(() => setLoadingHris(false));
  }, [isOpen, caseData?.employeeNumber]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);

    const data = {
      avgHoursPerWeek: parseFloat(fd.get("avgHoursPerWeek") as string),
      employeeHireDate: fd.get("employeeHireDate") as string,
      employeeCount: parseInt(fd.get("employeeCount") as string, 10),
      analyzedBy: "System Analysis",
    };

    analyzeCase.mutate(
      { caseId, data },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetCaseQueryKey(caseId) });
          onClose();
        },
        onError: (err: unknown) => {
          setError(err instanceof Error ? err.message : "Analysis failed");
        },
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-lg rounded-2xl shadow-2xl border flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
        <div className="p-6 border-b flex justify-between items-center bg-slate-50/50">
          <div>
            <h2 className="text-xl font-display font-bold">Run Eligibility Analysis</h2>
            {employeeName && (
              <p className="text-sm text-muted-foreground mt-0.5">
                For <span className="font-medium text-foreground">{employeeName}</span>
                {caseData?.caseNumber && (
                  <span className="ml-1 text-xs text-muted-foreground">— {caseData.caseNumber}</span>
                )}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:bg-slate-200 p-2 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          {autoFilled && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium" style={{ background: "#F0F7F4", color: "#1A5C44", border: "1px solid #A8D5C5" }}>
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              Fields pre-filled from your HRIS — verify before running analysis
            </div>
          )}
          {loadingHris && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" /> Loading HRIS data…
            </div>
          )}

          <div className="bg-amber-50 text-amber-800 p-3 rounded-xl border border-amber-100 flex gap-3 text-sm">
            <Info className="w-5 h-5 shrink-0 text-amber-500" />
            <p>Provide employee parameters. The system will look back 12 months from today's date.</p>
          </div>

          {error && (
            <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg border border-destructive/20">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-sm font-semibold">
              Average Hours/Week (Past 12 Months) <span className="text-destructive">*</span>
            </label>
            <input
              required
              name="avgHoursPerWeek"
              type="number"
              step="0.1"
              value={avgHours}
              onChange={(e) => setAvgHours(parseFloat(e.target.value) || 0)}
              className="w-full border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-semibold">
              Employee Hire Date <span className="text-destructive">*</span>
            </label>
            <input
              required
              name="employeeHireDate"
              type="date"
              value={hireDate}
              onChange={(e) => setHireDate(e.target.value)}
              className="w-full border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-semibold">
              Employer Headcount (75-mile radius) <span className="text-destructive">*</span>
            </label>
            <input
              required
              name="employeeCount"
              type="number"
              defaultValue={500}
              className="w-full border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            />
          </div>

          <div className="mt-6 flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={analyzeCase.isPending}
              className="px-5 py-2.5 font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {analyzeCase.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Run Analysis
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
