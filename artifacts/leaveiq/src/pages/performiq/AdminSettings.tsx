import React, { useEffect, useState } from "react";
import {
  FileText, BookOpen, Users, Plus, Edit3, Save, X, Trash2, CheckCircle2, Loader2, ChevronDown, ChevronUp,
} from "lucide-react";
import { PiqLayout } from "@/components/performiq/PiqLayout";
import { piqApiFetch } from "@/lib/piqAuth";

const C = {
  perf: "#4F6FA5",
  card: "#FFFFFF",
  border: "#D4DCF0",
  textDark: "#1A2D4A",
  textMuted: "#6B7FA8",
  agentBg: "#F4F6FB",
};

type Tab = "document_types" | "policies" | "users";

interface DocType {
  id: string; baseType: string; displayLabel: string;
  requiresSupervisorReview: boolean; supervisorReviewRequired: boolean;
  requiresHrApproval: boolean; isActive: boolean;
}
interface Policy { id: string; title: string; category: string; content: string; policyNumber: string | null; effectiveDate: string | null; isActive: boolean; }
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

  // New doc type form
  const [newDT, setNewDT] = useState({ baseType: "coaching", displayLabel: "", requiresSupervisorReview: false, supervisorReviewRequired: false, requiresHrApproval: false });
  const [savingDT, setSavingDT] = useState(false);
  const [showDTForm, setShowDTForm] = useState(false);

  // New policy form
  const [newPolicy, setNewPolicy] = useState({ title: "", category: "", content: "", policyNumber: "", effectiveDate: "" });
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [showPolicyForm, setShowPolicyForm] = useState(false);
  const [expandedPolicy, setExpandedPolicy] = useState<string | null>(null);

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
    if (!newPolicy.title || !newPolicy.category || !newPolicy.content) return;
    setSavingPolicy(true);
    try {
      const created = await piqApiFetch<Policy>("/api/performiq/admin/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPolicy),
      });
      setPolicies((prev) => [...prev, created]);
      setNewPolicy({ title: "", category: "", content: "", policyNumber: "", effectiveDate: "" });
      setShowPolicyForm(false);
    } catch {}
    setSavingPolicy(false);
  }

  async function deletePolicy(policyId: string) {
    await piqApiFetch(`/api/performiq/admin/policies/${policyId}`, { method: "DELETE" });
    setPolicies((prev) => prev.filter((p) => p.id !== policyId));
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
                        <label className="block text-xs font-medium mb-1" style={{ color: C.textMuted }}>Title *</label>
                        <input type="text" value={newPolicy.title} onChange={(e) => setNewPolicy((p) => ({ ...p, title: e.target.value }))}
                          className="w-full px-3 py-2 rounded-xl text-sm border outline-none"
                          style={{ background: C.agentBg, borderColor: C.border, color: C.textDark }} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: C.textMuted }}>Category *</label>
                        <input type="text" value={newPolicy.category} placeholder="e.g. attendance, conduct"
                          onChange={(e) => setNewPolicy((p) => ({ ...p, category: e.target.value }))}
                          className="w-full px-3 py-2 rounded-xl text-sm border outline-none"
                          style={{ background: C.agentBg, borderColor: C.border, color: C.textDark }} />
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
                      <label className="block text-xs font-medium mb-1" style={{ color: C.textMuted }}>Policy Content *</label>
                      <textarea value={newPolicy.content} onChange={(e) => setNewPolicy((p) => ({ ...p, content: e.target.value }))}
                        rows={6} placeholder="Paste the full policy text here. The AI agent will reference this when documenting violations."
                        className="w-full px-3 py-2 rounded-xl text-sm border outline-none resize-y"
                        style={{ background: C.agentBg, borderColor: C.border, color: C.textDark }} />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setShowPolicyForm(false)} className="px-4 py-2 rounded-xl text-sm border" style={{ borderColor: C.border, color: C.textMuted }}>Cancel</button>
                      <button onClick={createPolicy} disabled={savingPolicy || !newPolicy.title || !newPolicy.category || !newPolicy.content}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
                        style={{ background: C.perf }}>
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
                        onClick={() => setExpandedPolicy((prev) => (prev === p.id ? null : p.id))}
                      >
                        <div>
                          <p className="font-medium text-sm" style={{ color: C.textDark }}>{p.title}</p>
                          <p className="text-xs mt-0.5 capitalize" style={{ color: C.textMuted }}>
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
                          {expandedPolicy === p.id ? <ChevronUp className="w-4 h-4" style={{ color: C.textMuted }} /> : <ChevronDown className="w-4 h-4" style={{ color: C.textMuted }} />}
                        </div>
                      </button>
                      {expandedPolicy === p.id && (
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

            {/* Users */}
            {tab === "users" && (
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
            )}
          </>
        )}
      </div>
    </PiqLayout>
  );
}
