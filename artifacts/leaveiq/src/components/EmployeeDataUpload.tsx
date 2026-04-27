import React, { useRef, useState } from "react";
import { Upload, Download, CheckCircle2, AlertTriangle, Loader2, FileSpreadsheet, X } from "lucide-react";
import { apiFetch } from "@/lib/auth";

const CSV_HEADERS = [
  "employee_name",
  "employee_id",
  "position",
  "location",
  "department",
  "manager_name",
  "start_date",
  "avg_hours_worked",
];

const CSV_EXAMPLE = [
  "Jane Smith,EMP001,HR Manager,Los Angeles,Human Resources,John Doe,2021-03-15,40.0",
  "John Doe,EMP002,Director,Los Angeles,Human Resources,,2019-07-01,42.5",
];

function downloadTemplate() {
  const rows = [CSV_HEADERS.join(","), ...CSV_EXAMPLE];
  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "employee_data_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

interface EmployeeDataUploadProps {
  /** Tint color for accents — defaults to terracotta */
  accentColor?: string;
  /** Optional heading override */
  heading?: string;
}

export function EmployeeDataUpload({
  accentColor = "#C97E59",
  heading = "Employee Data Upload",
}: EmployeeDataUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ imported: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFile(file: File) {
    if (!file.name.endsWith(".csv")) {
      setError("Please select a .csv file.");
      return;
    }
    setSelectedFile(file);
    setResult(null);
    setError(null);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  async function handleUpload() {
    if (!selectedFile) return;
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const csv = await selectedFile.text();
      const data = await apiFetch<{ imported: number }>("/api/employees/csv-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv }),
      });
      setResult(data);
      setSelectedFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Please check your file and try again.");
    } finally {
      setUploading(false);
    }
  }

  const borderStyle = { borderColor: accentColor + "40" };
  const accentBg = accentColor + "12";

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-base" style={{ color: "#3D2010" }}>{heading}</h3>
          <p className="text-xs mt-0.5" style={{ color: "#8C7058" }}>
            Upload a CSV file to add or update employee records. Manager relationships are resolved automatically by name.
            Upload weekly to keep data current.
          </p>
        </div>
        <button
          onClick={downloadTemplate}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors hover:opacity-80 shrink-0"
          style={{ borderColor: accentColor + "60", color: accentColor, background: accentBg }}
        >
          <Download className="w-3.5 h-3.5" /> Download Template
        </button>
      </div>

      {/* Expected columns */}
      <div className="rounded-xl p-4 text-xs" style={{ background: accentBg, border: `1px solid ${accentColor}25` }}>
        <p className="font-semibold mb-2" style={{ color: "#3D2010" }}>Required CSV columns</p>
        <div className="flex flex-wrap gap-1.5">
          {CSV_HEADERS.map((h) => (
            <span
              key={h}
              className="px-2 py-0.5 rounded-md font-mono"
              style={{ background: accentColor + "20", color: accentColor }}
            >
              {h}
            </span>
          ))}
        </div>
        <p className="mt-2" style={{ color: "#8C7058" }}>
          Only <span className="font-semibold">employee_name</span> is required. Include manager_name to build the reporting hierarchy.
          Date format: YYYY-MM-DD.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className="relative border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all"
        style={{
          borderColor: isDragOver ? accentColor : accentColor + "50",
          background: isDragOver ? accentBg : "#FAFAF8",
        }}
      >
        <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={onFileChange} />
        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: accentBg }}>
          <FileSpreadsheet className="w-6 h-6" style={{ color: accentColor }} />
        </div>
        {selectedFile ? (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium" style={{ color: "#3D2010" }}>{selectedFile.name}</span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
              className="p-0.5 rounded-full hover:bg-black/10"
            >
              <X className="w-3.5 h-3.5 text-gray-400" />
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm font-medium" style={{ color: "#3D2010" }}>
              Drop your CSV here, or <span style={{ color: accentColor }}>click to browse</span>
            </p>
            <p className="text-xs" style={{ color: "#8C7058" }}>.csv files only</p>
          </>
        )}
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-start gap-2 text-sm rounded-xl px-4 py-3 border" style={{ background: "#FDF0EE", borderColor: "#E8A898", color: "#9E4030" }}>
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}
      {result && (
        <div className="flex items-start gap-2 text-sm rounded-xl px-4 py-3 border" style={{ background: "#F0FDF4", borderColor: "#86EFAC", color: "#166534" }}>
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          Successfully imported <strong>{result.imported}</strong> employee record{result.imported !== 1 ? "s" : ""}.
          Employee data is now available in both LeaveIQ and PerformIQ.
        </div>
      )}

      {/* Upload button */}
      <div className="flex justify-end">
        <button
          onClick={handleUpload}
          disabled={!selectedFile || uploading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-50"
          style={{ background: accentColor }}
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {uploading ? "Importing…" : "Import Employees"}
        </button>
      </div>
    </div>
  );
}
