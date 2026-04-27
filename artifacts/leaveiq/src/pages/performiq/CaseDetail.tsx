import React, { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import {
  ChevronRight,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Edit3,
  Send,
  Users,
  MessageSquare,
  Save,
  X,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { PiqLayout } from "@/components/performiq/PiqLayout";
import { piqApiFetch, usePiqRole } from "@/lib/piqAuth";
import { format } from "date-fns";
import type { PiqDocumentContent } from "@workspace/db";

const C = {
  perf: "#2E7B7B",
  card: "#FFFFFF",
  border: "#C4D9D9",
  textDark: "#1A3333",
  textMuted: "#6B9090",
  agentBg: "#F0EEE9",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft:             { label: "Draft",              color: "#6B9090", bg: "#EDF1F8" },
  supervisor_review: { label: "Supervisor Review",  color: "#B45309", bg: "#FEF3C7" },
  manager_revision:  { label: "Needs Revision",     color: "#B91C1C", bg: "#FEE2E2" },
  hr_approval:       { label: "HR Approval",        color: "#7C3AED", bg: "#EDE9FE" },
  delivery:          { label: "Ready to Deliver",   color: "#065F46", bg: "#D1FAE5" },
  closed:            { label: "Closed",             color: "#374151", bg: "#F3F4F6" },
  cancelled:         { label: "Cancelled",          color: "#6B7280", bg: "#F3F4F6" },
};

const STEP_LABELS: Record<string, string> = {
  draft: "Draft",
  supervisor_review: "Supervisor Review",
  hr_approval: "HR Approval",
  manager_revision: "Manager Revision",
  delivery: "Delivery",
};

const DOCUMENT_SECTIONS: [keyof PiqDocumentContent, string][] = [
  ["documentTypePurpose", "Document Purpose"],
  ["incidentDescription", "Incident Description"],
  ["policyViolations", "Policy Violations"],
  ["impactConsequences", "Impact & Consequences"],
  ["priorDisciplineHistory", "Prior Discipline History"],
  ["expectationsGoingForward", "Expectations Going Forward"],
  ["failureConsequences", "Consequences of Non-Compliance"],
  ["additionalNotes", "Additional Notes"],
];

interface WorkflowStep { id: string; stepType: string; stepOrder: number; status: string; assignedTo: string | null; feedback: string | null; }
interface HistoryEntry { id: string; action: string; performedByRole: string; actorName: string | null; notes: string | null; createdAt: string; }

export default function PiqCaseDetail() {
  const { caseId } = useParams<{ caseId: string }>();
  const [, navigate] = useLocation();
  const { isHr, isSupervisor, isManager, isHrAdmin } = usePiqRole();

  const [caseData, setCaseData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [docContent, setDocContent] = useState<PiqDocumentContent | null>(null);
  const [editedContent, setEditedContent] = useState<PiqDocumentContent | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  async function loadCase() {
    try {
      const data = await piqApiFetch<any>(`/api/performiq/cases/${caseId}`);
      setCaseData(data);
      if (data.currentDocument?.content) {
        setDocContent(data.currentDocument.content);
        setEditedContent(data.currentDocument.content);
      }
    } catch {
      // handle error
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadCase(); }, [caseId]);

  async function saveDocument() {
    if (!editedContent) return;
    setSaving(true);
    try {
      await piqApiFetch(`/api/performiq/cases/${caseId}/document`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editedContent }),
      });
      setDocContent(editedContent);
      setEditing(false);
      await loadCase();
    } catch {
      // handle
    } finally {
      setSaving(false);
    }
  }

  async function doWorkflowAction(action: string) {
    setActionLoading(action);
    try {
      await piqApiFetch(`/api/performiq/cases/${caseId}/workflow/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback: feedback || undefined }),
      });
      setFeedback("");
      setShowFeedback(false);
      setPendingAction(null);
      await loadCase();
    } catch {
      // handle
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <PiqLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: C.perf }} />
        </div>
      </PiqLayout>
    );
  }

  if (!caseData) {
    return (
      <PiqLayout>
        <div className="text-center py-20" style={{ color: C.textMuted }}>Case not found</div>
      </PiqLayout>
    );
  }

  const { case: c, employee, docType, workflowSteps, history } = caseData;
  const sc = STATUS_CONFIG[c.status] ?? { label: c.status, color: "#6B9090", bg: "#EDF1F8" };

  const canEdit = (isManager && ["draft", "manager_revision"].includes(c.status)) || isHr || isSupervisor;
  const canSubmit = isManager && ["draft", "manager_revision"].includes(c.status);
  const canSupervisorApprove = isSupervisor && c.status === "supervisor_review";
  const canHrApprove = isHr && c.status === "hr_approval";
  const canDeliver = (isManager || isHr) && c.status === "delivery";

  return (
    <PiqLayout>
      <div className="max-w-5xl mx-auto">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm mb-6" style={{ color: C.textMuted }}>
          <button onClick={() => navigate("/performiq/cases")} className="hover:opacity-70 flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Cases
          </button>
          <ChevronRight className="w-4 h-4" />
          <span style={{ color: C.textDark }}>{c.caseNumber}</span>
        </div>

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold" style={{ color: C.textDark }}>{employee?.fullName}</h1>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: sc.bg, color: sc.color }}>
                {sc.label}
              </span>
            </div>
            <p className="text-sm" style={{ color: C.textMuted }}>
              {employee?.jobTitle} · {employee?.department} ·{" "}
              <span className="font-mono">{c.caseNumber}</span> ·{" "}
              {docType?.displayLabel}
            </p>
          </div>
        </div>

        {/* Workflow progress */}
        <div className="rounded-2xl border p-5 mb-6" style={{ background: C.card, borderColor: C.border }}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: C.textMuted }}>Workflow Progress</h2>
          <div className="flex items-center gap-2 flex-wrap">
            {(workflowSteps as WorkflowStep[]).map((step, i) => {
              const isCompleted = step.status === "completed";
              const isActive = step.status === "in_progress";
              const isReturned = step.status === "returned";
              return (
                <React.Fragment key={step.id}>
                  <div
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
                    style={
                      isCompleted
                        ? { background: "#D1FAE5", color: "#065F46" }
                        : isActive
                        ? { background: C.perf + "20", color: C.perf }
                        : isReturned
                        ? { background: "#FEE2E2", color: "#B91C1C" }
                        : { background: "#F3F4F6", color: "#9CA3AF" }
                    }
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : isActive ? (
                      <Clock className="w-3.5 h-3.5" />
                    ) : isReturned ? (
                      <AlertTriangle className="w-3.5 h-3.5" />
                    ) : (
                      <span className="w-3.5 h-3.5 rounded-full border border-current opacity-40" />
                    )}
                    {STEP_LABELS[step.stepType] ?? step.stepType}
                    {step.feedback && isReturned && (
                      <span className="ml-1 text-[10px]">· feedback</span>
                    )}
                  </div>
                  {i < workflowSteps.length - 1 && <ChevronRight className="w-3 h-3 shrink-0" style={{ color: C.textMuted }} />}
                </React.Fragment>
              );
            })}
          </div>

          {/* Feedback from last returned step */}
          {(workflowSteps as WorkflowStep[]).find((s) => s.status === "returned" && s.feedback) && (
            <div className="mt-4 rounded-xl p-3 text-sm" style={{ background: "#FEF3C7", color: "#92400E" }}>
              <strong>Feedback:</strong>{" "}
              {(workflowSteps as WorkflowStep[]).find((s) => s.status === "returned")?.feedback}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Document editor */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold" style={{ color: C.textDark }}>Document</h2>
              {canEdit && !editing && c.status !== "closed" && (
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors hover:bg-blue-50"
                  style={{ borderColor: C.border, color: C.perf }}
                >
                  <Edit3 className="w-3.5 h-3.5" /> Edit Document
                </button>
              )}
              {editing && (
                <div className="flex gap-2">
                  <button
                    onClick={() => { setEditing(false); setEditedContent(docContent); }}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border"
                    style={{ borderColor: C.border, color: C.textMuted }}
                  >
                    <X className="w-3 h-3" /> Cancel
                  </button>
                  <button
                    onClick={saveDocument}
                    disabled={saving}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-white"
                    style={{ background: C.perf }}
                  >
                    {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
                  </button>
                </div>
              )}
            </div>

            <div className="rounded-2xl border overflow-hidden" style={{ background: C.card, borderColor: C.border }}>
              {/* Employee info header */}
              {docContent?.employeeInfo && (
                <div className="px-6 py-4 grid grid-cols-2 gap-3 text-sm" style={{ background: C.agentBg, borderBottom: `1px solid ${C.border}` }}>
                  {[
                    ["Employee", docContent.employeeInfo.fullName],
                    ["Job Title", docContent.employeeInfo.jobTitle],
                    ["Department", docContent.employeeInfo.department],
                    ["Hire Date", docContent.employeeInfo.hireDate],
                    ["Manager", docContent.employeeInfo.managerName],
                    ["Document Type", docType?.displayLabel],
                  ].map(([label, val]) => (
                    <div key={label}>
                      <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: C.textMuted }}>{label}</p>
                      <p style={{ color: C.textDark }}>{val || "—"}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Document sections */}
              <div className="p-6 space-y-5">
                {!docContent ? (
                  <p className="text-sm text-center py-8" style={{ color: C.textMuted }}>
                    No document yet. Start by creating the case through the AI agent.
                  </p>
                ) : (
                  DOCUMENT_SECTIONS.map(([field, label]) => (
                    <div key={field}>
                      <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: C.textMuted }}>
                        {label}
                      </p>
                      {editing ? (
                        <textarea
                          value={(editedContent?.[field] as string) ?? ""}
                          onChange={(e) =>
                            setEditedContent((prev) => prev ? { ...prev, [field]: e.target.value } : prev)
                          }
                          rows={4}
                          className="w-full px-4 py-3 rounded-xl text-sm outline-none border resize-y"
                          style={{ background: C.agentBg, borderColor: C.border, color: C.textDark }}
                        />
                      ) : (
                        <div className="rounded-xl px-4 py-3 text-sm leading-relaxed" style={{ background: C.agentBg, color: C.textDark }}>
                          {(docContent[field] as string) || <span style={{ color: C.textMuted }}>Not provided</span>}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Actions + History sidebar */}
          <div className="space-y-5">
            {/* Action panel */}
            {c.status !== "closed" && c.status !== "cancelled" && (
              <div className="rounded-2xl border p-5" style={{ background: C.card, borderColor: C.border }}>
                <h3 className="font-semibold text-sm mb-4" style={{ color: C.textDark }}>Actions</h3>

                {showFeedback && (
                  <div className="mb-4">
                    <textarea
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      placeholder="Add feedback or notes (optional)…"
                      rows={3}
                      className="w-full px-3 py-2 text-sm rounded-xl border outline-none resize-none"
                      style={{ background: C.agentBg, borderColor: C.border, color: C.textDark }}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  {canSubmit && (
                    <button
                      onClick={() => doWorkflowAction("submit_for_review")}
                      disabled={!!actionLoading}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60 hover:opacity-90"
                      style={{ background: C.perf }}
                    >
                      {actionLoading === "submit_for_review" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      Submit for Review
                    </button>
                  )}

                  {canSupervisorApprove && (
                    <>
                      <button
                        onClick={() => doWorkflowAction("supervisor_approve")}
                        disabled={!!actionLoading}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60 hover:opacity-90"
                        style={{ background: "#065F46" }}
                      >
                        {actionLoading === "supervisor_approve" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          setShowFeedback(true);
                          setPendingAction("supervisor_return");
                        }}
                        disabled={!!actionLoading}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border disabled:opacity-60 hover:bg-red-50"
                        style={{ borderColor: "#FCA5A5", color: "#B91C1C" }}
                      >
                        <AlertTriangle className="w-4 h-4" /> Return to Manager
                      </button>
                      {showFeedback && pendingAction === "supervisor_return" && (
                        <button
                          onClick={() => doWorkflowAction("supervisor_return")}
                          disabled={!!actionLoading}
                          className="w-full py-2 rounded-xl text-sm font-semibold text-white"
                          style={{ background: "#B91C1C" }}
                        >
                          Confirm Return
                        </button>
                      )}
                    </>
                  )}

                  {canHrApprove && (
                    <>
                      <button
                        onClick={() => doWorkflowAction("hr_approve")}
                        disabled={!!actionLoading}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60 hover:opacity-90"
                        style={{ background: "#065F46" }}
                      >
                        {actionLoading === "hr_approve" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        Approve
                      </button>
                      <button
                        onClick={() => { setShowFeedback(true); setPendingAction("hr_return"); }}
                        disabled={!!actionLoading}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border disabled:opacity-60 hover:bg-red-50"
                        style={{ borderColor: "#FCA5A5", color: "#B91C1C" }}
                      >
                        <AlertTriangle className="w-4 h-4" /> Return to Manager
                      </button>
                      {showFeedback && pendingAction === "hr_return" && (
                        <button
                          onClick={() => doWorkflowAction("hr_return")}
                          disabled={!!actionLoading}
                          className="w-full py-2 rounded-xl text-sm font-semibold text-white"
                          style={{ background: "#B91C1C" }}
                        >
                          Confirm Return
                        </button>
                      )}
                    </>
                  )}

                  {canDeliver && (
                    <button
                      onClick={() => doWorkflowAction("deliver")}
                      disabled={!!actionLoading}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60 hover:opacity-90"
                      style={{ background: "#065F46" }}
                    >
                      {actionLoading === "deliver" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      Mark as Delivered
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* History */}
            <div className="rounded-2xl border overflow-hidden" style={{ background: C.card, borderColor: C.border }}>
              <div className="px-5 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
                <h3 className="font-semibold text-sm flex items-center gap-2" style={{ color: C.textDark }}>
                  <MessageSquare className="w-4 h-4" /> History
                </h3>
              </div>
              <div className="divide-y max-h-80 overflow-y-auto" style={{ borderColor: C.border }}>
                {(history as HistoryEntry[]).map((h) => (
                  <div key={h.id} className="px-5 py-3">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-semibold capitalize" style={{ color: C.textDark }}>
                        {h.action.replace(/_/g, " ")}
                      </span>
                      <span className="text-[10px]" style={{ color: C.textMuted }}>
                        {format(new Date(h.createdAt), "MMM d, h:mm a")}
                      </span>
                    </div>
                    <p className="text-xs" style={{ color: C.textMuted }}>
                      {h.actorName ?? "System"} · {h.performedByRole}
                    </p>
                    {h.notes && (
                      <p className="text-xs mt-1 italic" style={{ color: C.textMuted }}>{h.notes}</p>
                    )}
                  </div>
                ))}
                {history.length === 0 && (
                  <div className="px-5 py-6 text-center text-xs" style={{ color: C.textMuted }}>No history yet</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </PiqLayout>
  );
}
