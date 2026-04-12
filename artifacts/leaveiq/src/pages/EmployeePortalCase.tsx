import React, { useState, useEffect, useRef } from "react";
import { EmployeeLayout } from "@/components/layout/EmployeeLayout";
import { Upload, FileText, Download, CheckCircle2, AlertTriangle, Loader2, File, X } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useOrgBranding } from "@/lib/useOrgBranding";

interface CaseDoc {
  id: string;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  uploadedBy: "employee" | "hr";
  createdAt: string;
}

interface CaseSummary {
  id: string;
  caseNumber: string;
  state: string;
  leaveReasonCategory: string;
  requestedStart: string;
  requestedEnd: string | null;
  employeeFirstName: string | null;
  employeeLastName: string | null;
  intermittent: boolean;
  returnedToWorkAt: string | null;
}

const REASON_LABELS: Record<string, string> = {
  own_health: "Employee's Own Health",
  care_family: "Care for a Family Member",
  pregnancy_disability: "Pregnancy Disability",
  bonding: "Bonding with a New Child",
  personal: "Personal",
};

const STATUS_LABELS: Record<string, string> = {
  INTAKE: "Received",
  ELIGIBILITY_ANALYSIS: "Under Review",
  HR_REVIEW_QUEUE: "HR Review",
  NOTICE_DRAFTED: "Notice Sent",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function EmployeePortalCase() {
  const { logoUrl: orgLogoUrl, orgName } = useOrgBranding();
  const token = new URLSearchParams(window.location.search).get("token") ?? "";

  const [caseData, setCaseData] = useState<CaseSummary | null>(null);
  const [documents, setDocuments] = useState<CaseDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const todayStr = new Date().toISOString().split("T")[0] ?? "";
  const [rtwDate, setRtwDate] = useState(todayStr);
  const [rtwSubmitting, setRtwSubmitting] = useState(false);
  const [rtwSuccess, setRtwSuccess] = useState("");
  const [rtwError, setRtwError] = useState("");

  useEffect(() => {
    if (!token) {
      setError("Invalid or missing access link. Please use the link sent to your email.");
      setIsLoading(false);
      return;
    }
    loadCase();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadCase() {
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/portal/case?token=${encodeURIComponent(token)}`);
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Failed to load case.");
      setCaseData(data.case as CaseSummary);
      setDocuments(data.documents as CaseDoc[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load your case.");
    } finally {
      setIsLoading(false);
    }
  }

  async function uploadFile(file: File) {
    if (!caseData) return;
    const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic",
      "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!ALLOWED.includes(file.type) && !file.name.match(/\.(pdf|jpg|jpeg|png|webp|heic|doc|docx)$/i)) {
      setUploadError("Unsupported file type. Please upload a PDF, image, or Word document.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setUploadError("File is too large. Maximum size is 20 MB.");
      return;
    }

    setIsUploading(true);
    setUploadError("");
    setUploadSuccess("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(
        `/api/portal/case/${caseData.id}/documents?token=${encodeURIComponent(token)}`,
        { method: "POST", body: formData },
      );
      const result = await res.json();
      if (!res.ok) throw new Error((result as { error?: string }).error ?? "Upload failed.");
      setDocuments((prev) => [result as CaseDoc, ...prev]);
      setUploadSuccess(`"${file.name}" uploaded successfully.`);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDownload(docId: string, fileName: string) {
    if (!caseData) return;
    try {
      const res = await fetch(
        `/api/portal/case/${caseData.id}/documents/${docId}/download?token=${encodeURIComponent(token)}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Download failed.");
      const a = document.createElement("a");
      a.href = (data as { url: string }).url;
      a.download = fileName;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Download failed.");
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }

  async function handleRtwSubmit() {
    if (!caseData || !rtwDate) return;
    setRtwSubmitting(true);
    setRtwError("");
    setRtwSuccess("");
    try {
      const res = await fetch(
        `/api/portal/case/${caseData.id}/return-to-work?token=${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ returnDate: rtwDate }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Failed to submit.");
      setRtwSuccess("Your return to work date has been reported to HR.");
      // Refresh case data to reflect returnedToWorkAt
      await loadCase();
    } catch (err) {
      setRtwError(err instanceof Error ? err.message : "Failed to submit return to work date.");
    } finally {
      setRtwSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <EmployeeLayout orgLogoUrl={orgLogoUrl} orgName={orgName}>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </EmployeeLayout>
    );
  }

  if (error || !caseData) {
    return (
      <EmployeeLayout orgLogoUrl={orgLogoUrl} orgName={orgName}>
        <div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto px-4 text-center">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-xl font-display font-bold mb-2" style={{ color: "#3D2010" }}>Unable to Load Case</h2>
          <p className="text-muted-foreground text-sm mb-4">{error || "Something went wrong. Please try again using the link in your email."}</p>
          <p className="text-xs text-muted-foreground">If this problem persists, please contact your HR department and provide the error message above.</p>
        </div>
      </EmployeeLayout>
    );
  }

  return (
    <EmployeeLayout orgLogoUrl={orgLogoUrl} orgName={orgName}>
      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-8 space-y-6">
        {/* Case Summary Card */}
        <div className="rounded-2xl border bg-white overflow-hidden shadow-sm">
          <div className="px-6 py-5 flex items-center justify-between" style={{ background: "#C97E59" }}>
            <div>
              <h2 className="font-display font-bold text-xl text-white">{caseData.caseNumber}</h2>
              <p className="text-sm text-white/80 mt-0.5">
                {caseData.employeeFirstName} {caseData.employeeLastName}
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-semibold" style={{ background: "rgba(255,255,255,0.25)", color: "#fff" }}>
              {STATUS_LABELS[caseData.state] ?? caseData.state}
            </span>
          </div>
          <div className="px-6 py-5 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Reason</p>
              <p className="font-medium">{REASON_LABELS[caseData.leaveReasonCategory] ?? caseData.leaveReasonCategory}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Schedule</p>
              <p className="font-medium">{caseData.intermittent ? "Intermittent" : "Continuous"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Start Date</p>
              <p className="font-medium">{formatDate(caseData.requestedStart)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">End Date</p>
              <p className="font-medium">{caseData.requestedEnd ? formatDate(caseData.requestedEnd) : "Not specified"}</p>
            </div>
          </div>
        </div>

        {/* Upload Section */}
        <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b bg-slate-50/50">
            <h3 className="font-display font-bold text-base flex items-center gap-2">
              <Upload className="w-4 h-4 text-primary" />
              Upload Documentation
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Upload medical certifications, doctor's notes, or other supporting documents. Accepted: PDF, images, Word documents (max 20 MB).
            </p>
          </div>

          <div className="p-6 space-y-4">
            {uploadError && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {uploadError}
                <button onClick={() => setUploadError("")} className="ml-auto"><X className="w-4 h-4" /></button>
              </div>
            )}
            {uploadSuccess && (
              <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {uploadSuccess}
                <button onClick={() => setUploadSuccess("")} className="ml-auto"><X className="w-4 h-4" /></button>
              </div>
            )}

            <div
              className="border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer"
              style={{
                borderColor: isDragging ? "#C97E59" : "#D4C9BB",
                background: isDragging ? "#FDF6F0" : "#FAFAF8",
              }}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
            >
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ""; }}
                disabled={isUploading}
              />
              {isUploading ? (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-sm font-medium">Uploading…</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "#F5E8DF" }}>
                    <Upload className="w-6 h-6" style={{ color: "#C97E59" }} />
                  </div>
                  <p className="font-medium text-sm" style={{ color: "#3D2010" }}>Drop a file here, or click to browse</p>
                  <p className="text-xs text-muted-foreground">PDF, JPG, PNG, HEIC, DOC, DOCX · Max 20 MB</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Documents List */}
        {documents.length > 0 && (
          <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b bg-slate-50/50 flex items-center justify-between">
              <h3 className="font-display font-bold text-base flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                Uploaded Documents
              </h3>
              <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">{documents.length}</span>
            </div>
            <div className="divide-y divide-border">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 px-6 py-4">
                  <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <File className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(doc.createdAt).toLocaleDateString()}
                      {doc.sizeBytes ? ` · ${formatBytes(doc.sizeBytes)}` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDownload(doc.id, doc.fileName)}
                    className="flex-shrink-0 p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-muted-foreground hover:text-primary"
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Return to Work Section */}
        {caseData.state !== "CLOSED" && caseData.state !== "CANCELLED" && !caseData.returnedToWorkAt && (
          <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b bg-slate-50/50">
              <h3 className="font-display font-bold text-base flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                Report Return to Work
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Let your HR team know when you returned or plan to return to work.
              </p>
            </div>
            <div className="p-6 space-y-4">
              {rtwError && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {rtwError}
                  <button onClick={() => setRtwError("")} className="ml-auto"><X className="w-4 h-4" /></button>
                </div>
              )}
              {rtwSuccess && (
                <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  {rtwSuccess}
                </div>
              )}
              {!rtwSuccess && (
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                      Return Date
                    </label>
                    <input
                      type="date"
                      value={rtwDate}
                      onChange={(e) => setRtwDate(e.target.value)}
                      disabled={rtwSubmitting}
                      className="w-full border rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2"
                      style={{ borderColor: "#D4C9BB", color: "#3D2010" }}
                    />
                  </div>
                  <button
                    onClick={handleRtwSubmit}
                    disabled={rtwSubmitting || !rtwDate}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white transition-all disabled:opacity-50 shrink-0"
                    style={{ background: "#C97E59" }}
                    onMouseEnter={(e) => { if (!rtwSubmitting) e.currentTarget.style.background = "#9E5D38"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "#C97E59"; }}
                  >
                    {rtwSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    {rtwSubmitting ? "Submitting…" : "Report Return to Work"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground pb-4">
          If you have questions about your case, please contact your HR department directly.
          <br />Your case portal link is private — please do not share it.
        </p>
      </div>
    </EmployeeLayout>
  );
}
