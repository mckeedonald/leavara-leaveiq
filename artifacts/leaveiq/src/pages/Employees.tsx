import React, { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { apiFetch } from "@/lib/auth";
import { useAuth } from "@/lib/auth";
import {
  Users, Upload, Download, CheckCircle2, AlertTriangle, Loader2,
  FileSpreadsheet, X, Search, ChevronDown, FileText, Clock,
  RefreshCw, AlertCircle,
} from "lucide-react";

/* ─── Brand palette ───────────────────────────────────────── */
const S = {
  bg:           "#F0EEE9",
  card:         "#FFFFFF",
  border:       "#D4C9BB",
  terracotta:   "#C97E59",
  darkTerra:    "#9E5D38",
  mocha:        "#A47864",
  textDark:     "#3D2010",
  textMid:      "#7A5540",
  textMuted:    "#A07860",
  green:        "#16A34A",
  red:          "#DC2626",
  amber:        "#D97706",
  accentBg:     "#FDF6F0",
  accentBorder: "#FBDCBE",
};

/* ─── Types ──────────────────────────────────────────────── */
interface Employee {
  id: string;
  employeeId: string | null;
  fullName: string;
  position: string | null;
  location: string | null;
  department: string | null;
  managerName: string | null;
  workEmail: string | null;
  personalEmail: string | null;
  startDate: string | null;
  avgHoursWorked: string | null;
  isActive: boolean;
  dataSource: string;
  lastSyncAt: string | null;
}

interface ImportLog {
  id: string;
  filename: string | null;
  uploadedBy: string | null;
  totalRows: number;
  inserted: number;
  updated: number;
  errors: number;
  status: "success" | "partial" | "failed";
  createdAt: string;
}

interface UploadResult {
  inserted: number;
  updated: number;
  errors: number;
  totalRows: number;
  status: "success" | "partial" | "failed";
  errorCsv: string | null;
}

/* ─── CSV template ───────────────────────────────────────── */
const CSV_HEADERS = [
  "employee_name", "employee_id", "position", "location", "department",
  "manager_name", "start_date", "avg_hours_worked", "work_email", "personal_email",
];
const CSV_EXAMPLE = [
  "Jane Smith,EMP001,HR Manager,Los Angeles,Human Resources,John Doe,2021-03-15,40.0,jane.smith@company.com,jsmith@personal.com",
  "John Doe,EMP002,Director,Los Angeles,Human Resources,,2019-07-01,42.5,john.doe@company.com,",
];

function downloadTemplate() {
  const rows = [CSV_HEADERS.join(","), ...CSV_EXAMPLE];
  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "employee_data_template.csv"; a.click();
  URL.revokeObjectURL(url);
}

function downloadErrorCsv(csv: string, logId?: string) {
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `import_errors_${(logId ?? "report").slice(0, 8)}.csv`; a.click();
  URL.revokeObjectURL(url);
}

/* ─── Status badge ───────────────────────────────────────── */
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    success: { bg: "#F0FDF4", color: S.green, label: "Success" },
    partial: { bg: "#FFFBEB", color: S.amber, label: "Partial" },
    failed:  { bg: "#FEF2F2", color: S.red,   label: "Failed" },
  };
  const s = map[status] ?? map.failed;
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

/* ─── Main page ──────────────────────────────────────────── */
export default function Employees() {
  const { user } = useAuth();
  const isAdmin = user?.role === "hr_admin" || user?.isSuperAdmin === true;
  const qc = useQueryClient();

  /* Employee list */
  const [search, setSearch] = useState("");
  const { data: empData, isLoading: empLoading } = useQuery({
    queryKey: ["employees"],
    queryFn: () => apiFetch<{ employees: Employee[] }>("/api/employees"),
  });
  const employees = empData?.employees ?? [];
  const filtered = employees.filter((e) => {
    const q = search.toLowerCase();
    return !q || e.fullName.toLowerCase().includes(q) ||
      (e.employeeId ?? "").toLowerCase().includes(q) ||
      (e.department ?? "").toLowerCase().includes(q) ||
      (e.position ?? "").toLowerCase().includes(q);
  });

  /* Import log */
  const { data: logData } = useQuery({
    queryKey: ["employee-import-log"],
    queryFn: () => apiFetch<{ logs: ImportLog[] }>("/api/employees/import-log"),
    enabled: isAdmin,
  });
  const importLogs = logData?.logs ?? [];

  /* Upload state */
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const csv = await file.text();
      return apiFetch<UploadResult>("/api/employees/csv-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv, filename: file.name }),
      });
    },
    onSuccess: (data) => {
      setUploadResult(data);
      setSelectedFile(null);
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["employee-import-log"] });
    },
    onError: (err) => {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    },
  });

  function handleFile(file: File) {
    if (!file.name.endsWith(".csv")) { setUploadError("Please select a .csv file."); return; }
    setSelectedFile(file);
    setUploadResult(null);
    setUploadError(null);
  }

  /* ─── Render ─────────────────────────────────────────── */
  return (
    <AppLayout>
      <div style={{ maxWidth: 1100 }}>
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: S.textDark }}>Employees</h1>
            <p className="text-sm mt-0.5" style={{ color: S.textMuted }}>
              Employee directory shared across LeaveIQ and PerformIQ — {employees.length.toLocaleString()} record{employees.length !== 1 ? "s" : ""}
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors shrink-0"
              style={{ borderColor: S.accentBorder, color: S.terracotta, background: S.accentBg }}
            >
              <Download className="w-3.5 h-3.5" /> Download Template
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6" style={{ gridTemplateColumns: isAdmin ? "1fr 380px" : "1fr" }}>
          {/* ── Left column: directory ── */}
          <div>
            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: S.textMuted }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, ID, department, or position…"
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm outline-none"
                style={{ borderColor: S.border, color: S.textDark, background: S.card }}
              />
            </div>

            {/* Table */}
            <div className="rounded-2xl border overflow-hidden" style={{ borderColor: S.border, background: S.card }}>
              {empLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-5 h-5 animate-spin" style={{ color: S.terracotta }} />
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Users className="w-10 h-10 opacity-20" style={{ color: S.terracotta }} />
                  <p className="text-sm font-medium" style={{ color: S.textMid }}>
                    {search ? "No employees match your search" : "No employees yet — upload a CSV to get started"}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: "#F5F0EB", borderBottom: `1px solid ${S.border}` }}>
                        {["Name", "ID", "Position", "Department", "Location", "Email", "Source"].map((h) => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: S.textMid }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((e, i) => (
                        <tr key={e.id} style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${S.border}` : undefined, background: i % 2 === 0 ? S.card : "#FDFAF7" }}>
                          <td className="px-4 py-3 font-medium whitespace-nowrap" style={{ color: S.textDark }}>{e.fullName}</td>
                          <td className="px-4 py-3 font-mono text-xs" style={{ color: S.textMid }}>{e.employeeId ?? "—"}</td>
                          <td className="px-4 py-3" style={{ color: S.textMid }}>{e.position ?? "—"}</td>
                          <td className="px-4 py-3" style={{ color: S.textMid }}>{e.department ?? "—"}</td>
                          <td className="px-4 py-3" style={{ color: S.textMid }}>{e.location ?? "—"}</td>
                          <td className="px-4 py-3 text-xs" style={{ color: S.textMuted }}>{e.personalEmail ?? e.workEmail ?? "—"}</td>
                          <td className="px-4 py-3">
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{
                              background: e.dataSource === "hris" ? "#EBF5F5" : e.dataSource === "csv" ? S.accentBg : "#F5F0EB",
                              color: e.dataSource === "hris" ? "#2E7B7B" : e.dataSource === "csv" ? S.darkTerra : S.mocha,
                            }}>
                              {e.dataSource}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filtered.length < employees.length && (
                    <div className="px-4 py-2 text-xs text-center" style={{ color: S.textMuted, borderTop: `1px solid ${S.border}` }}>
                      Showing {filtered.length} of {employees.length} employees
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Right column: upload + import log (admin only) ── */}
          {isAdmin && (
            <div className="flex flex-col gap-5">
              {/* Upload card */}
              <div className="rounded-2xl border p-5" style={{ borderColor: S.border, background: S.card }}>
                <div className="flex items-center gap-2 mb-3">
                  <Upload className="w-4 h-4" style={{ color: S.terracotta }} />
                  <h2 className="font-semibold text-sm" style={{ color: S.textDark }}>Import from CSV</h2>
                </div>
                <p className="text-xs mb-3" style={{ color: S.textMuted }}>
                  Upload a CSV to add or update employee records. Manager relationships are resolved by name automatically.
                </p>

                {/* Column reference */}
                <div className="rounded-xl p-3 mb-4 text-xs" style={{ background: S.accentBg, border: `1px solid ${S.accentBorder}` }}>
                  <p className="font-semibold mb-1.5" style={{ color: S.textDark }}>CSV columns</p>
                  <div className="flex flex-wrap gap-1">
                    {CSV_HEADERS.map((h) => (
                      <span key={h} className="px-1.5 py-0.5 rounded font-mono" style={{ background: S.terracotta + "20", color: S.darkTerra }}>
                        {h}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2" style={{ color: S.textMuted }}>Only <strong>employee_name</strong> is required. Use YYYY-MM-DD for dates.</p>
                </div>

                {/* Drop zone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setIsDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all"
                  style={{ borderColor: isDragOver ? S.terracotta : S.accentBorder, background: isDragOver ? S.accentBg : "#FAFAF8" }}
                >
                  <input ref={fileInputRef} type="file" accept=".csv" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
                  <FileSpreadsheet className="w-7 h-7" style={{ color: selectedFile ? S.terracotta : S.textMuted }} />
                  {selectedFile ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium" style={{ color: S.textDark }}>{selectedFile.name}</span>
                      <button type="button" onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                        className="p-0.5 rounded-full hover:bg-black/10"><X className="w-3.5 h-3.5 text-gray-400" /></button>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs font-medium text-center" style={{ color: S.textDark }}>
                        Drop CSV here or <span style={{ color: S.terracotta }}>browse</span>
                      </p>
                      <p className="text-xs" style={{ color: S.textMuted }}>.csv only</p>
                    </>
                  )}
                </div>

                {/* Alerts */}
                {uploadError && (
                  <div className="flex items-start gap-2 text-xs rounded-xl px-3 py-2.5 border mt-3" style={{ background: "#FEF2F2", borderColor: "#FCA5A5", color: S.red }}>
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    {uploadError}
                  </div>
                )}

                {uploadResult && (
                  <div className="mt-3 rounded-xl p-3 border text-xs space-y-1" style={{
                    background: uploadResult.status === "success" ? "#F0FDF4" : uploadResult.status === "partial" ? "#FFFBEB" : "#FEF2F2",
                    borderColor: uploadResult.status === "success" ? "#86EFAC" : uploadResult.status === "partial" ? "#FCD34D" : "#FCA5A5",
                    color: uploadResult.status === "success" ? S.green : uploadResult.status === "partial" ? S.amber : S.red,
                  }}>
                    <div className="flex items-center gap-1.5 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {uploadResult.status === "success" ? "Import complete" : uploadResult.status === "partial" ? "Import completed with errors" : "Import failed"}
                    </div>
                    <div style={{ color: S.textMid }}>
                      {uploadResult.inserted > 0 && <p>✦ {uploadResult.inserted} new records added</p>}
                      {uploadResult.updated > 0 && <p>✦ {uploadResult.updated} existing records updated</p>}
                      {uploadResult.errors > 0 && <p>✦ {uploadResult.errors} rows had errors</p>}
                    </div>
                    {uploadResult.errorCsv && (
                      <button
                        onClick={() => downloadErrorCsv(uploadResult.errorCsv!)}
                        className="flex items-center gap-1.5 mt-1 px-2.5 py-1.5 rounded-lg font-medium border transition-colors"
                        style={{ borderColor: S.accentBorder, color: S.darkTerra, background: S.accentBg }}
                      >
                        <Download className="w-3 h-3" /> Download error report
                      </button>
                    )}
                  </div>
                )}

                {/* Upload button */}
                <button
                  onClick={() => selectedFile && uploadMutation.mutate(selectedFile)}
                  disabled={!selectedFile || uploadMutation.isPending}
                  className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-50"
                  style={{ background: S.terracotta }}
                >
                  {uploadMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {uploadMutation.isPending ? "Importing…" : "Import Employees"}
                </button>
              </div>

              {/* Import history */}
              {importLogs.length > 0 && (
                <div className="rounded-2xl border" style={{ borderColor: S.border, background: S.card }}>
                  <div className="px-4 py-3 flex items-center gap-2 border-b" style={{ borderColor: S.border }}>
                    <Clock className="w-4 h-4" style={{ color: S.terracotta }} />
                    <h2 className="font-semibold text-sm" style={{ color: S.textDark }}>Import History</h2>
                  </div>
                  <div className="divide-y" style={{ borderColor: S.border }}>
                    {importLogs.map((log) => (
                      <div key={log.id} className="px-4 py-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate" style={{ color: S.textDark }}>
                              {log.filename ?? "Unnamed upload"}
                            </p>
                            <p className="text-xs mt-0.5" style={{ color: S.textMuted }}>
                              {new Date(log.createdAt).toLocaleString()} · {log.uploadedBy ?? "unknown"}
                            </p>
                          </div>
                          <StatusBadge status={log.status} />
                        </div>
                        <div className="flex gap-3 mt-1.5 text-xs" style={{ color: S.textMid }}>
                          <span>{log.totalRows} rows</span>
                          {log.inserted > 0 && <span className="text-green-700">+{log.inserted} new</span>}
                          {log.updated > 0 && <span style={{ color: S.mocha }}>~{log.updated} updated</span>}
                          {log.errors > 0 && (
                            <button
                              onClick={() => window.open(`/api/employees/import-log/${log.id}/errors`, "_blank")}
                              className="flex items-center gap-0.5 hover:underline"
                              style={{ color: S.red }}
                            >
                              <AlertCircle className="w-3 h-3" />
                              {log.errors} errors
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
