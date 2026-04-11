import React, { useState } from "react";
import { FileText, Download, RefreshCw, Upload, Loader2, AlertTriangle, File } from "lucide-react";
import { apiFetch } from "@/lib/auth";
import { formatDateTime } from "@/lib/utils";

interface CaseDocument {
  id: string;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  uploadedBy: "employee" | "hr";
  createdAt: string;
}

interface Props {
  caseId: string;
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CaseDocumentsPanel({ caseId }: Props) {
  const [documents, setDocuments] = useState<CaseDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  async function loadDocuments() {
    setIsLoading(true);
    setError("");
    try {
      const data = await apiFetch<{ documents: CaseDocument[] }>(`/api/cases/${caseId}/documents`);
      setDocuments(data.documents);
      setLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load documents");
    } finally {
      setIsLoading(false);
    }
  }

  React.useEffect(() => {
    loadDocuments();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  async function handleDownload(docId: string, fileName: string) {
    try {
      const data = await apiFetch<{ url: string; fileName: string }>(
        `/api/cases/${caseId}/documents/${docId}/download`,
      );
      const a = document.createElement("a");
      a.href = data.url;
      a.download = fileName;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Download failed");
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    setIsUploading(true);
    try {
      const token = localStorage.getItem("leaveiq_token");
      const res = await fetch(`/api/cases/${caseId}/documents`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Upload failed");
      }
      await loadDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b bg-slate-50/50">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          <h3 className="font-display font-bold text-base">Case Documents</h3>
          {loaded && (
            <span className="ml-1 text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
              {documents.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label className="cursor-pointer">
            <input
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
              onChange={handleUpload}
              disabled={isUploading}
            />
            <span className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
              {isUploading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              Upload
            </span>
          </label>
          <button
            onClick={loadDocuments}
            disabled={isLoading}
            className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors text-muted-foreground"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="p-6">
        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 mb-4">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {isLoading && !loaded && (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Loading documents…
          </div>
        )}

        {loaded && documents.length === 0 && (
          <div className="text-center py-10 text-muted-foreground">
            <File className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No documents uploaded yet.</p>
            <p className="text-xs mt-1">Upload PDFs, images, or Word documents.</p>
          </div>
        )}

        {documents.length > 0 && (
          <div className="divide-y divide-border">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {doc.uploadedBy === "employee" ? "Employee" : "HR"} · {formatDateTime(doc.createdAt)}
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
        )}
      </div>
    </div>
  );
}
