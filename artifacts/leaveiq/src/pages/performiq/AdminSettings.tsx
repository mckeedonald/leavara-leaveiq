import React, { useEffect, useRef, useState } from "react";
import {
  FileText, BookOpen, Users, Plus, Edit3, Save, X, Trash2, CheckCircle2, Loader2, ChevronDown, ChevronUp, Upload, FileUp, AlertTriangle,
} from "lucide-react";
import { PiqLayout } from "@/components/performiq/PiqLayout";
import { piqApiFetch } from "@/lib/piqAuth";
import { EmployeeDataUpload } from "@/components/EmployeeDataUpload";

const C = {
  perf: "#2E7B7B",
  card: "#FFFFFF",
  border: "#C4D9D9",
  textDark: "#1A3333",
  textMuted: "#6B9090",
  agentBg: "#F0EEE9",
};

type Tab = "document_types" | "policies" | "users" | "employee_data";

interface DocType {
  id: string; baseType: string; displayLabel: string;
  requiresSupervisorReview: boolean; supervisorReviewRequired: boolean;
  requiresHrApproval: boolean; isActive: boolean;
}
interface Policy { id: string; title: string; category: string; content: string; policyNumber: string | null; effectiveDate: string | null; isActive: boolean; pdfStorageKey: string | null; }
interface PiqUser { id: string; fullName: string; email: string; role: string; isActive: boolean; }

const BASE_TYPE_OPTIONS = [
  { value: "coaching", label: "Coaching Session" },
  { value: "written_warning", label: "Written Warning" },
  { value: "final_warning", label: "Final Warning" },
];

export default function PiqAdminSettings() {
  const [tab, setTab] = useState<Tab>("document_types");
  const [docTypes, setDocTypes] = useState<DocType[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [users, setUsers] = useState<PiqUser[]>([]);
  const [loading, setLoading] = useState(true);

  // New user form
  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [newUser, setNewUser] = useState({ fullName: "", email: "", role: "manager" });
  const [savingUser, setSavingUser] = useState(false);
  const [addUserError, setAddUserError] = useState<string | null>(null);
  const [createdUserTempPassword, setCreatedUserTempPassword] = useState<{ name: string; email: string; tempPassword: string } | null>(null);

  // New doc type form
  const [newDT, setNewDT] = useState({ baseType: "coaching", displayLabel: "", requiresSupervisorReview: false, supervisorReviewRequired: false, requiresHrApproval: false });
  const [savingDT, setSavingDT] = useState(false);
  const [showDTForm, setShowDTForm] = useState(false);

  // New policy form
  const [newPolicy, setNewPolicy] = useState({ title: "", category: "", content: "", policyNumber: "", effectiveDate: "" });
  const [policyPdfStorageKey, setPolicyPdfStorageKey] = useState<string | null>(null);
  const [policyPdfBase64, setPolicyPdfBase64] = useState<string | null>(null);
  const [policyPdfFileName, setPolicyPdfFileName] = useState<string | null>(null);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [showPolicyForm, setShowPolicyForm] = useState(false);
  const [expandedPolicy, setExpandedPolicy] = useState<string | null>(null);
  const [policyFileDragging, setPolicyFileDragging] = useState(false);
  const [policyFileLoading, setPolicyFileLoading] = useState(false);
  const [policyFileMessage, setPolicyFileMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [policySaveError, setPolicySaveError] = useState<string | null>(null);
  const [policyValidation, setPolicyValidation] = useState<{ title?: boolean; category?: boolean }>({});
  const policyFileInputRef = useRef<HTMLInputElement>(null);
  const policyTitleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [dt, pol, usr] = await Promise.all([
        piqApiFetch<DocType[]>("/api/performiq/admin/document-types"),
        piqApiFetch<Policy[]>("/api/performiq/admin/policies"),
        piqApiFetch<PiqUser[]>("/api/performiq/auth/users"),
      ]);
      setDocTypes(dt);
      setPolicies(pol);
      setUsers(usr);
    } catch {}
    setLoading(false);
  }

  async function createDocType() {
    if (!newDT.displayLabel) return;
    setSavingDT(true);
    try {
      const created = await piqApiFetch<DocType>("/api/performiq/admin/document-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newDT),
      });
      setDocTypes((prev) => [...prev, created]);
      setNewDT({ baseType: "coaching", displayLabel: "", requiresSupervisorReview: false, supervisorReviewRequired: false, requiresHrApproval: false });
      setShowDTForm(false);
    } catch {}
    setSavingDT(false);
  }

  async function createPolicy() {
    const missingTitle = !newPolicy.title.trim();
    const missingCategory = !newPolicy.category.trim();
    const missingContent = !policyPdfStorageKey && !policyPdfBase64 && !newPolicy.content.trim();
    if (missingTitle || missingCategory || missingContent) {
      setPolicyValidation({ title: missingTitle, category: missingCategory });
      setPolicySaveError(
        missingContent
          ? "Policy content is required. Upload a PDF or paste the policy text below."
          : `Please fill in the required field${missingTitle && missingCategory ? "s" : ""}: ${[missingTitle && "Title", missingCategory && "Category"].filter(Boolean).join(" and ")}.`
      );
      if (missingTitle) policyTitleRef.current?.focus();
      return;
    }
    setPolicyValidation({});
    setSavingPolicy(true);
    setPolicySaveError(null);
    try {
      const body: Record<string, any> = {
        title: newPolicy.title,
        category: newPolicy.category,
        policyNumber: newPolicy.policyNumber,
        effectiveDate: newPolicy.effectiveDate,
      };
      if (policyPdfStorageKey) {
        body.pdfStorageKey = policyPdfStorageKey;
        body.content = "";
      } else if (policyPdfBase64) {
        body.pdfBase64 = policyPdfBase64;
        body.content = "";
      } else {
        // Strip control characters from pasted text
        body.content = newPolicy.content
          .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, " ")
          .replace(/\s{3,}/g, "\n\n")
          .trim();
      }

      const created = await piqApiFetch<Policy>("/api/performiq/admin/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setPolicies((prev) => [...prev, created]);
      setNewPolicy({ title: "", category: "", content: "", policyNumber: "", effectiveDate: "" });
      setPolicyPdfStorageKey(null);
      setPolicyPdfBase64(null);
      setPolicyPdfFileName(null);
      setPolicyFileMessage(null);
      setPolicySaveError(null);
      setPolicyValidation({});
      setShowPolicyForm(false);
    } catch (err: any) {
      setPolicySaveError(err?.message ?? "Failed to save policy. Please try again.");
    } finally {
      setSavingPolicy(false);
    }
  }

  async function deletePolicy(policyId: string) {
    await piqApiFetch(`/api/performiq/admin/policies/${policyId}`, { method: "DELETE" });
    setPolicies((prev) => prev.filter((p) => p.id !== policyId));
  }

  async function handlePolicyFile(file: File) {
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    if (ext !== ".pdf") {
      setPolicyFileMessage({ type: "error", text: "Only PDF files are supported for upload. For other formats, paste the text below." });
      return;
    }
    setPolicyFileLoading(true);
    setPolicyFileMessage(null);
    setPolicyPdfStorageKey(null);
    setPolicyPdfFileName(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const token = localStorage.getItem("leavara_token") ?? localStorage.getItem("performiq_token") ?? "";
      const res = await fetch("/api/performiq/admin/policies/upload-pdf", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? "Upload failed");
      }
      const data = await res.json() as { storageKey?: string; base64Pdf?: string; fileName: string };
      if (data.storageKey) {
        setPolicyPdfStorageKey(data.storageKey);
        setPolicyPdfBase64(null);
      } else if (data.base64Pdf) {
        setPolicyPdfBase64(data.base64Pdf);
        setPolicyPdfStorageKey(null);
      }
      setPolicyPdfFileName(file.name);
      setPolicyFileMessage({ type: "success", text: `"${file.name}" uploaded successfully. Fill in the title and category, then save.` });
    } catch (err: any) {
      setPolicyFileMessage({ type: "error", text: err?.message ?? "Upload failed. Please try again." });
    } finally {
      setPolicyFileLoading(false);
    }
  }

  async function createUser() {
    if (!newUser.fullName.trim() || !newUser.email.trim()) {
      setAddUserError("Full name and email are required.");
      return;
    }
    setSavingUser(true);
    setAddUserError(null);
    try {
      const result = await piqApiFetch<{ id: string; fullName: string; email: string; role: string; isActive: boolean; createdAt: string; tempPassword: string }>(
        "/api/performiq/auth/users",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newUser),
        }
      );
      setUsers((prev) => [...prev, { id: result.id, fullName: result.fullName, email: result.email, role: result.role, isActive: result.isActive }]);
      setCreatedUserTempPassword({ name: result.fullName, email: result.email, tempPassword: result.tempPassword });
      setNewUser({ fullName: "", email: "", role: "manager" });
      setShowAddUserForm(false);
    } catch (err: any) {
      setAddUserError(err?.message ?? "Failed to create user.");
    } finally {
      setSavingUser(false);
    }
  }

  async function toggleUserActive(userId: string, isActive: boolean) {
    await piqApiFetch(`/api/performiq/auth/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive }),
    });
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, isActive } : u)));
  }

  const tabs: { id: Tab; label: string; icon: typeof FileText }[] = [
    { id: "document_types", label: "Document Types", icon: FileText },
    { id: "policies", label: "Policy Library", icon: BookOpen },
    { id: "users", label: "Team Members", icon: Users },
    { id: "employee_data", label: "Employee Data", icon: Upload },
  ];

  const roleLabels: Record<string, string> = {
    manager: "Manager", supervisor: "Supervisor", hr_user: "HR Specialist", hr_admin: "HR Admin", system_admin: "System Admin",
  };

  return (
    <PiqLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: C.textDark }}>Admin Settings</h1>
          <p className="text-sm mt-0.5" style={{ color: C.textMuted }}>Configure PerformIQ for your organization</p>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 mb-6 p-1 rounded-xl" style={{ background: C.agentBg, border: `1px solid ${C.border}` }}>
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium flex-1 justify-center transition-all"
              style={
                tab === id
                  ? { background: C.card, color: C.perf, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }
                  : { color: C.textMuted }
              }
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12 text-sm" style={{ color: C.textMuted }}>Loading…</div>
        ) : (
          <>
            {/* Document Types */}
            {tab === "document_types" && (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <button
                    onClick={() => setShowDTForm((v) => !v)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
                    style={{ background: C.perf }}
                  >
                    <Plus className="w-4 h-4" /> Add Document Type
                  </button>
                </div>

                {showDTForm && (
                  <div className="rounded-2xl border p-5" style={{ background: C.card, borderColor: C.border }}>
                    <h3 className="font-semibold mb-4" style={{ color: C.textDark }}>New Document Type</h3>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: C.textMuted }}>Base Type</label>
                        <select
                          value={newDT.baseType}
                          onChange={(e) => setNewDT((p) => ({ ...p, baseType: e.target.value }))}
                          className="w-full px-3 py-2 rounded-xl text-sm border outline-none"
                          style={{ background: C.agentBg, borderColor: C.border, color: C.textDark }}
                        >
                          {BASE_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: C.textMuted }}>Display Label</label>
                        <input
                          type="text"
                          value={newDT.displayLabel}
                          onChange={(e) => setNewDT((p) => ({ ...p, displayLabel: e.target.value }))}
                          placeholder="e.g. Coaching Conversation"
                          className="w-full px-3 py-2 rounded-xl text-sm border outline-none"
                          style={{ background: C.agentBg, borderColor: C.border, color: C.textDark }}
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-4 mb-4 text-sm">
                      {[
                        { key: "requiresSupervisorReview", label: "Supervisor review" },
                        { key: "supervisorReviewRequired", label: "Supervisor review required" },
                        { key: "requiresHrApproval", label: "HR approval required" },
                      ].map(({ key, label }) => (
                        <label key={key} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={(newDT as any)[key]}
                            onChange={(e) => setNewDT((p) => ({ ...p, [key]: e.target.checked }))}
                            className="rounded"
                          />
                          <span style={{ color: C.textDark }}>{label}</span>
                        </label>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowDTForm(false)}
                        className="px-4 py-2 rounded-xl text-sm border"
                        style={{ borderColor: C.border, color: C.textMuted }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={createDocType}
                        disabled={savingDT || !newDT.displayLabel}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
                        style={{ background: C.perf }}
                      >
                        {savingDT ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save
                      </button>
                    </div>
                  </div>
                )}

                <div className="rounded-2xl border overflow-hidden" style={{ background: C.card, borderColor: C.border }}>
                  {docTypes.length === 0 ? (
                    <div className="p-10 text-center text-sm" style={{ color: C.textMuted }}>No document types configured yet.</div>
                  ) : (
                    <div className="divide-y" style={{ borderColor: C.border }}>
                      {docTypes.map((dt) => (
                        <div key={dt.id} className="px-6 py-4 flex items-center gap-4">
                          <div className="flex-1">
                            <p className="font-medium text-sm" style={{ color: C.textDark }}>{dt.displayLabel}</p>
                            <p className="text-xs mt-0.5 capitalize" style={{ color: C.textMuted }}>
                              {dt.baseType.replace(/_/g, " ")} ·{" "}
                              {[
                                dt.requiresSupervisorReview && "Supervisor review",
                                dt.requiresHrApproval && "HR approval",
                              ].filter(Boolean).join(", ") || "No approval required"}
                            </p>
                          </div>
                          <span
                            className="text-xs font-medium px-2 py-0.5 rounded-full"
                            style={dt.isActive ? { background: "#D1FAE5", color: "#065F46" } : { background: "#F3F4F6", color: "#6B7280" }}
                          >
                            {dt.isActive ? "Active" : "Inactive"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Policies */}
            {tab === "policies" && (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <button
                    onClick={() => setShowPolicyForm((v) => !v)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
                    style={{ background: C.perf }}
                  >
                    <Plus className="w-4 h-4" /> Add Policy
                  </button>
                </div>

                {showPolicyForm && (
                  <div className="rounded-2xl border p-5" style={{ background: C.card, borderColor: C.border }}>
                    <h3 className="font-semibold mb-4" style={{ color: C.textDark }}>New Policy</h3>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: policyValidation.title ? "#B91C1C" : C.textMuted }}>
                          Title * {policyValidation.title && <span className="font-normal">(required)</span>}
                        </label>
                        <input
                          ref={policyTitleRef}
                          type="text"
                          value={newPolicy.title}
                          onChange={(e) => { setNewPolicy((p) => ({ ...p, title: e.target.value })); setPolicyValidation((v) => ({ ...v, title: false })); setPolicySaveError(null); }}
                          className="w-full px-3 py-2 rounded-xl text-sm border outline-none"
                          style={{ background: C.agentBg, borderColor: policyValidation.title ? "#FCA5A5" : C.border, color: C.textDark, boxShadow: policyValidation.title ? "0 0 0 2px #FEE2E2" : undefined }} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: policyValidation.category ? "#B91C1C" : C.textMuted }}>
                          Category * {policyValidation.category && <span className="font-normal">(required)</span>}
                        </label>
                        <input
                          type="text"
                          value={newPolicy.category}
                          placeholder="e.g. attendance, conduct"
                          onChange={(e) => { setNewPolicy((p) => ({ ...p, category: e.target.value })); setPolicyValidation((v) => ({ ...v, category: false })); setPolicySaveError(null); }}
                          className="w-full px-3 py-2 rounded-xl text-sm border outline-none"
                          style={{ background: C.agentBg, borderColor: policyValidation.category ? "#FCA5A5" : C.border, color: C.textDark, boxShadow: policyValidation.category ? "0 0 0 2px #FEE2E2" : undefined }} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: C.textMuted }}>Policy Number</label>
                        <input type="text" value={newPolicy.policyNumber} onChange={(e) => setNewPolicy((p) => ({ ...p, policyNumber: e.target.value }))}
                          className="w-full px-3 py-2 rounded-xl text-sm border outline-none"
                          style={{ background: C.agentBg, borderColor: C.border, color: C.textDark }} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: C.textMuted }}>Effective Date</label>
                        <input type="date" value={newPolicy.effectiveDate} onChange={(e) => setNewPolicy((p) => ({ ...p, effectiveDate: e.target.value }))}
                          className="w-full px-3 py-2 rounded-xl text-sm border outline-none"
                          style={{ background: C.agentBg, borderColor: C.border, color: C.textDark }} />
                      </div>
                    </div>
                    <div className="mb-4">
                      <label className="block text-xs font-medium mb-2" style={{ color: C.textMuted }}>Policy Content *</label>

                      {/* PDF already uploaded — show confirmation badge */}
                      {policyPdfStorageKey ? (
                        <div className="flex items-center gap-3 rounded-xl px-4 py-3 mb-3 border" style={{ background: "#F0FDF4", borderColor: "#86EFAC" }}>
                          <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: "#16A34A" }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium" style={{ color: "#14532D" }}>PDF ready: {policyPdfFileName}</p>
                            <p className="text-xs" style={{ color: "#166534" }}>The agent will read this PDF directly — no text extraction needed.</p>
                          </div>
                          <button
                            onClick={() => { setPolicyPdfStorageKey(null); setPolicyPdfBase64(null); setPolicyPdfFileName(null); setPolicyFileMessage(null); }}
                            className="p-1 rounded-lg hover:bg-green-200 transition-colors shrink-0"
                          >
                            <X className="w-3.5 h-3.5" style={{ color: "#166534" }} />
                          </button>
                        </div>
                      ) : (
                        <>
                          {/* Drag-and-drop PDF upload zone */}
                          <div
                            className="relative border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center gap-2 cursor-pointer mb-3 transition-colors"
                            style={{
                              borderColor: policyFileDragging ? C.perf : C.border,
                              background: policyFileDragging ? "#EBF5F5" : C.agentBg,
                            }}
                            onDragOver={(e) => { e.preventDefault(); setPolicyFileDragging(true); }}
                            onDragLeave={() => setPolicyFileDragging(false)}
                            onDrop={(e) => {
                              e.preventDefault();
                              setPolicyFileDragging(false);
                              const file = e.dataTransfer.files[0];
                              if (file) handlePolicyFile(file);
                            }}
                            onClick={() => policyFileInputRef.current?.click()}
                          >
                            <input
                              ref={policyFileInputRef}
                              type="file"
                              accept=".pdf"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handlePolicyFile(file);
                                e.target.value = "";
                              }}
                            />
                            {policyFileLoading ? (
                              <Loader2 className="w-6 h-6 animate-spin" style={{ color: C.perf }} />
                            ) : (
                              <FileUp className="w-6 h-6" style={{ color: C.textMuted }} />
                            )}
                            <p className="text-xs font-medium" style={{ color: C.textDark }}>
                              {policyFileLoading ? "Uploading PDF…" : "Drop a PDF here, or click to browse"}
                            </p>
                            <p className="text-xs" style={{ color: C.textMuted }}>PDF · The agent reads the document directly</p>
                          </div>

                          {/* File message banner */}
                          {policyFileMessage && (
                            <div
                              className="flex items-start gap-2 text-xs rounded-xl px-3 py-2 mb-3 border"
                              style={
                                policyFileMessage.type === "error"
                                  ? { background: "#FEF2F2", borderColor: "#FCA5A5", color: "#991B1B" }
                                  : { background: "#EFF6FF", borderColor: "#93C5FD", color: "#1E40AF" }
                              }
                            >
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                              {policyFileMessage.text}
                            </div>
                          )}

                          <div className="flex items-center gap-3 mb-2">
                            <div className="flex-1 border-t" style={{ borderColor: C.border }} />
                            <span className="text-xs" style={{ color: C.textMuted }}>or paste text</span>
                            <div className="flex-1 border-t" style={{ borderColor: C.border }} />
                          </div>

                          <textarea value={newPolicy.content} onChange={(e) => setNewPolicy((p) => ({ ...p, content: e.target.value }))}
                            rows={6} placeholder="Paste the full policy text here. The AI agent will reference this when documenting violations."
                            className="w-full px-3 py-2 rounded-xl text-sm border outline-none resize-y"
                            style={{ background: C.agentBg, borderColor: C.border, color: C.textDark }} />
                        </>
                      )}
                    </div>
                    {policySaveError && (
                      <div className="flex items-center gap-2 text-xs rounded-xl px-3 py-2 mb-3 border" style={{ background: "#FEF2F2", borderColor: "#FCA5A5", color: "#991B1B" }}>
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        {policySaveError}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setShowPolicyForm(false); setPolicyFileMessage(null); setPolicySaveError(null); setPolicyValidation({}); setPolicyPdfStorageKey(null); setPolicyPdfBase64(null); setPolicyPdfFileName(null); }}
                        className="px-4 py-2 rounded-xl text-sm border"
                        style={{ borderColor: C.border, color: C.textMuted }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={createPolicy}
                        disabled={savingPolicy}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
                        style={{ background: C.perf, opacity: savingPolicy ? 0.6 : 1 }}
                      >
                        {savingPolicy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Policy
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  {policies.filter((p) => p.isActive).map((p) => (
                    <div key={p.id} className="rounded-2xl border overflow-hidden" style={{ background: C.card, borderColor: C.border }}>
                      <button
                        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-blue-50 transition-colors"
                        onClick={() => !p.pdfStorageKey && setExpandedPolicy((prev) => (prev === p.id ? null : p.id))}
                      >
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="font-medium text-sm" style={{ color: C.textDark }}>{p.title}</p>
                            {p.pdfStorageKey && (
                              <span className="text-xs font-semibold px-1.5 py-0.5 rounded-md" style={{ background: "#EEF2FF", color: "#4F46E5" }}>PDF</span>
                            )}
                          </div>
                          <p className="text-xs capitalize" style={{ color: C.textMuted }}>
                            {p.category}{p.policyNumber ? ` · #${p.policyNumber}` : ""}{p.effectiveDate ? ` · Effective ${p.effectiveDate}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); deletePolicy(p.id); }}
                            className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                            title="Archive policy"
                          >
                            <Trash2 className="w-3.5 h-3.5" style={{ color: "#9CA3AF" }} />
                          </button>
                          {!p.pdfStorageKey && (
                            expandedPolicy === p.id ? <ChevronUp className="w-4 h-4" style={{ color: C.textMuted }} /> : <ChevronDown className="w-4 h-4" style={{ color: C.textMuted }} />
                          )}
                        </div>
                      </button>
                      {!p.pdfStorageKey && expandedPolicy === p.id && (
                        <div className="px-5 pb-5">
                          <div className="rounded-xl p-4 text-sm leading-relaxed whitespace-pre-wrap" style={{ background: C.agentBg, color: C.textDark }}>
                            {p.content}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {policies.filter((p) => p.isActive).length === 0 && (
                    <div className="rounded-2xl border p-10 text-center text-sm" style={{ background: C.card, borderColor: C.border, color: C.textMuted }}>
                      No policies configured. Add policies so the AI agent can reference them when documenting violations.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Users / Team Settings */}
            {tab === "users" && (
              <div className="space-y-4">
                {/* Temp password reveal after creation */}
                {createdUserTempPassword && (
                  <div className="rounded-2xl border p-5" style={{ background: "#F0FDF4", borderColor: "#86EFAC" }}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-sm mb-1" style={{ color: "#065F46" }}>
                          ✓ User created — share these credentials with {createdUserTempPassword.name}
                        </p>
                        <p className="text-xs mb-2" style={{ color: "#166534" }}>Email: <strong>{createdUserTempPassword.email}</strong></p>
                        <div className="flex items-center gap-3">
                          <span className="text-xs" style={{ color: "#166534" }}>Temporary password:</span>
                          <code className="text-sm font-mono font-bold px-2 py-0.5 rounded-lg" style={{ background: "#DCFCE7", color: "#14532D" }}>
                            {createdUserTempPassword.tempPassword}
                          </code>
                        </div>
                        <p className="text-xs mt-2" style={{ color: "#4ADE80" }}>This password is shown once. The user should change it after first login.</p>
                      </div>
                      <button onClick={() => setCreatedUserTempPassword(null)} className="p-1 rounded-lg hover:bg-green-200 transition-colors">
                        <X className="w-4 h-4" style={{ color: "#166534" }} />
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    onClick={() => { setShowAddUserForm((v) => !v); setAddUserError(null); }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
                    style={{ background: C.perf }}
                  >
                    <Plus className="w-4 h-4" /> Add User
                  </button>
                </div>

                {showAddUserForm && (
                  <div className="rounded-2xl border p-5" style={{ background: C.card, borderColor: C.border }}>
                    <h3 className="font-semibold mb-4" style={{ color: C.textDark }}>Add Team Member</h3>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: C.textMuted }}>Full Name *</label>
                        <input
                          type="text"
                          value={newUser.fullName}
                          onChange={(e) => setNewUser((p) => ({ ...p, fullName: e.target.value }))}
                          placeholder="Jane Smith"
                          className="w-full px-3 py-2 rounded-xl text-sm border outline-none"
                          style={{ background: C.agentBg, borderColor: C.border, color: C.textDark }}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: C.textMuted }}>Email *</label>
                        <input
                          type="email"
                          value={newUser.email}
                          onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))}
                          placeholder="jane@company.com"
                          className="w-full px-3 py-2 rounded-xl text-sm border outline-none"
                          style={{ background: C.agentBg, borderColor: C.border, color: C.textDark }}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: C.textMuted }}>Role *</label>
                        <select
                          value={newUser.role}
                          onChange={(e) => setNewUser((p) => ({ ...p, role: e.target.value }))}
                          className="w-full px-3 py-2 rounded-xl text-sm border outline-none"
                          style={{ background: C.agentBg, borderColor: C.border, color: C.textDark }}
                        >
                          <option value="manager">Manager</option>
                          <option value="supervisor">Supervisor</option>
                          <option value="hr_user">HR Specialist</option>
                          <option value="hr_admin">HR Admin</option>
                        </select>
                      </div>
                    </div>
                    {addUserError && (
                      <div className="flex items-center gap-2 text-xs rounded-xl px-3 py-2 mb-3 border" style={{ background: "#FEF2F2", borderColor: "#FCA5A5", color: "#991B1B" }}>
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        {addUserError}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setShowAddUserForm(false); setAddUserError(null); setNewUser({ fullName: "", email: "", role: "manager" }); }}
                        className="px-4 py-2 rounded-xl text-sm border"
                        style={{ borderColor: C.border, color: C.textMuted }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={createUser}
                        disabled={savingUser}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
                        style={{ background: C.perf, opacity: savingUser ? 0.6 : 1 }}
                      >
                        {savingUser ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        Create User
                      </button>
                    </div>
                  </div>
                )}

                <div className="rounded-2xl border overflow-hidden" style={{ background: C.card, borderColor: C.border }}>
                  <div className="divide-y" style={{ borderColor: C.border }}>
                    {users.map((u) => (
                      <div key={u.id} className="flex items-center gap-4 px-6 py-4">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0" style={{ background: C.perf }}>
                          {u.fullName.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm" style={{ color: C.textDark }}>{u.fullName}</p>
                          <p className="text-xs" style={{ color: C.textMuted }}>{u.email} · {roleLabels[u.role] ?? u.role}</p>
                          {!u.isActive && (
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: "#F3F4F6", color: "#6B7280" }}>Inactive</span>
                          )}
                        </div>
                        <button
                          onClick={() => toggleUserActive(u.id, !u.isActive)}
                          className="text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors"
                          style={u.isActive
                            ? { borderColor: "#FCA5A5", color: "#B91C1C", background: "#FFF" }
                            : { borderColor: "#6EE7B7", color: "#065F46", background: "#FFF" }
                          }
                        >
                          {u.isActive ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    ))}
                    {users.length === 0 && (
                      <div className="p-10 text-center text-sm" style={{ color: C.textMuted }}>No team members yet.</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Employee Data */}
            {tab === "employee_data" && (
              <div className="rounded-2xl border p-6" style={{ background: C.card, borderColor: C.border }}>
                <EmployeeDataUpload accentColor={C.perf} heading="Employee Data Upload" />
              </div>
            )}
          </>
        )}
      </div>
    </PiqLayout>
  );
}
