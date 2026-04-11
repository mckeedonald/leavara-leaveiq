import React, { useState, useRef, useCallback } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useGetCase, useTransitionCase, getGetCaseQueryKey, LeaveState, TransitionRequestEvent } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { StatusBadge, ReasonBadge, LEAVE_REASON_LABELS } from "@/components/ui/StatusBadge";
import { formatDate, formatDateTime, cn } from "@/lib/utils";
import {
  ArrowLeft, Calendar, User, Clock, ShieldAlert,
  CheckCircle, XCircle, AlertTriangle, FileText, Activity, Mail, Trash2, RefreshCw, Sparkles
} from "lucide-react";
import { AnalyzeCaseModal } from "@/components/cases/AnalyzeCaseModal";
import { TransitionCaseModal } from "@/components/cases/TransitionCaseModal";
import { RecordDecisionModal } from "@/components/cases/RecordDecisionModal";
import { AiAssistantPanel } from "@/components/cases/AiAssistantPanel";
import { CaseDocumentsPanel } from "@/components/cases/CaseDocumentsPanel";
import { useAuth, apiFetch } from "@/lib/auth";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

// ── Main CaseDetail ──────────────────────────────────────────────────────────
export default function CaseDetail() {
  const [, params] = useRoute("/cases/:caseId");
  const caseId = params?.caseId || "";
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const { data: caseData, isLoading, error, refetch } = useGetCase(caseId);

  const [activeModal, setActiveModal] = useState<"ANALYZE" | "TRANSITION" | "DECISION" | null>(null);
  const [transitionEvent, setTransitionEvent] = useState<"ROUTE_HR_REVIEW" | "DRAFT_NOTICE" | "CANCEL" | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [autoGenerateAi, setAutoGenerateAi] = useState(false);

  const aiPanelRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const transitionCase = useTransitionCase();

  const scrollToAiPanel = useCallback(() => {
    aiPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleDraftNoticeClick = useCallback(() => {
    setAutoGenerateAi(true);
    setTimeout(scrollToAiPanel, 100);
  }, [scrollToAiPanel]);

  const handleNoticesSent = useCallback(() => {
    // After HR sends notices from ELIGIBILITY_ANALYSIS, transition case to NOTICE_DRAFTED
    if (caseData?.state === LeaveState.ELIGIBILITY_ANALYSIS) {
      transitionCase.mutate(
        { caseId, data: { event: TransitionRequestEvent.DRAFT_NOTICE, actor: user?.email ?? "HR" } },
        {
          onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetCaseQueryKey(caseId) }),
          onError: (err) => console.error("Failed to transition case after sending notices:", err),
        },
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseData?.state, caseId, user?.email]);

  if (isLoading) return (
    <AppLayout>
      <div className="h-64 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    </AppLayout>
  );

  if (error || !caseData) return (
    <AppLayout>
      <div className="bg-destructive/10 text-destructive p-6 rounded-xl border border-destructive/20 text-center">
        <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
        <h3 className="font-bold text-lg">Failed to load case</h3>
        <p>The case could not be found or an error occurred.</p>
        <Link href="/" className="mt-4 inline-block text-primary hover:underline">Return to Dashboard</Link>
      </div>
    </AppLayout>
  );

  const analysis = caseData.analysisResult;
  const decisions = caseData.hrDecisions || [];
  const audit = caseData.auditLog || [];

  const showAiPanel = [
    LeaveState.HR_REVIEW_QUEUE,
    LeaveState.ELIGIBILITY_ANALYSIS,
    LeaveState.NOTICE_DRAFTED,
  ].includes(caseData.state as LeaveState);

  return (
    <AppLayout>
      <div className="animate-in opacity-0">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link href="/cases" className="hover:text-primary transition-colors flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Cases
          </Link>
          <span>/</span>
          <span className="font-medium text-foreground">{caseData.caseNumber}</span>
        </div>

        {/* Page Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-3xl font-display font-bold text-foreground">{caseData.caseNumber}</h2>
              <StatusBadge state={caseData.state} className="text-sm px-3 py-1" />
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5"><User className="w-4 h-4" /> EMP-{caseData.employeeNumber}</div>
              {(caseData as { employeeEmail?: string | null }).employeeEmail && (
                <div className="flex items-center gap-1.5">
                  <Mail className="w-4 h-4" />
                  {(caseData as { employeeEmail?: string | null }).employeeEmail}
                </div>
              )}
              <div className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> Opened {formatDate(caseData.createdAt)}</div>
              <ReasonBadge reason={caseData.leaveReasonCategory} />
              {caseData.intermittent && <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded text-xs font-semibold">Intermittent</span>}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3">
            {caseData.state === LeaveState.INTAKE && (
              <button
                onClick={() => setActiveModal("ANALYZE")}
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-2.5 rounded-xl font-medium shadow-md transition-all flex items-center gap-2"
              >
                <Activity className="w-4 h-4" /> Run Eligibility Analysis
              </button>
            )}
            {(caseData.state === LeaveState.ELIGIBILITY_ANALYSIS || caseData.state === LeaveState.HR_REVIEW_QUEUE) && (
              <button
                onClick={() => setActiveModal("ANALYZE")}
                className="border px-5 py-2.5 rounded-xl font-medium transition-all flex items-center gap-2 text-sm"
                style={{ borderColor: "#C97E59", color: "#9E5D38", background: "#FDF6F0" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#F5E8DF"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "#FDF6F0"; }}
              >
                <RefreshCw className="w-4 h-4" /> Override Analysis
              </button>
            )}
            {caseData.state === LeaveState.ELIGIBILITY_ANALYSIS && (
              <>
                <button
                  onClick={() => { setTransitionEvent("ROUTE_HR_REVIEW"); setActiveModal("TRANSITION"); }}
                  className="bg-amber-500 hover:bg-amber-600 text-white px-5 py-2.5 rounded-xl font-medium shadow-md transition-all"
                >
                  Route to HR Review
                </button>
                <button
                  onClick={handleDraftNoticeClick}
                  className="flex items-center gap-2 text-white px-5 py-2.5 rounded-xl font-medium shadow-md transition-all"
                  style={{ background: "#A47864" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#9E5D38")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#A47864")}
                >
                  <Sparkles className="w-4 h-4" /> Draft Notices with AI
                </button>
              </>
            )}
            {caseData.state === LeaveState.HR_REVIEW_QUEUE && (
              <button
                onClick={() => setActiveModal("DECISION")}
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-2.5 rounded-xl font-medium shadow-md transition-all flex items-center gap-2"
              >
                <ShieldAlert className="w-4 h-4" /> Record HR Decision
              </button>
            )}
            {caseData.state === LeaveState.NOTICE_DRAFTED && (
              <button
                onClick={() => { setTransitionEvent("CANCEL"); setActiveModal("TRANSITION"); }}
                className="bg-secondary text-secondary-foreground hover:bg-secondary/80 px-5 py-2.5 rounded-xl font-medium transition-all"
              >
                Cancel Case
              </button>
            )}
            {user?.role === "admin" && (
              <button
                onClick={() => setShowDeleteModal(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all text-sm border border-red-200 text-red-600 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" /> Delete Case
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-8">

            {/* Request Details */}
            <div className="bg-card border shadow-sm rounded-2xl p-6">
              <h3 className="font-display font-bold text-lg border-b pb-3 mb-4">Request Details</h3>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">Requested Start</p>
                  <p className="font-medium">{formatDate(caseData.requestedStart)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">Requested End</p>
                  <p className="font-medium">{caseData.requestedEnd ? formatDate(caseData.requestedEnd) : "Not specified (Ongoing)"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">Leave Reason</p>
                  <p className="font-medium">{LEAVE_REASON_LABELS[caseData.leaveReasonCategory] ?? caseData.leaveReasonCategory}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">Schedule</p>
                  <p className="font-medium">{caseData.intermittent ? "Intermittent" : "Continuous"}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">Employee Email</p>
                  {caseData.employeeEmail ? (
                    <p className="font-medium flex items-center gap-1.5">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      {caseData.employeeEmail}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Not provided</p>
                  )}
                </div>
              </div>
            </div>

            {/* Eligibility Analysis */}
            {analysis && (
              <div className="bg-card border shadow-sm rounded-2xl overflow-hidden">
                <div className="bg-slate-50 border-b p-6 flex items-center justify-between">
                  <h3 className="font-display font-bold text-lg flex items-center gap-2">
                    <Activity className="w-5 h-5 text-[#C97E59]" />
                    Eligibility Analysis
                  </h3>
                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    Analyzed {formatDateTime(analysis.analyzedAt)}
                  </div>
                </div>
                <div className="p-6">
                  {analysis.requiresHrReview && (
                    <div className="mb-6 bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-xl flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-sm">Requires HR Review</p>
                        <p className="text-sm mt-1">{analysis.reviewReason || "Case parameters require human evaluation."}</p>
                      </div>
                    </div>
                  )}
                  <p className="text-foreground leading-relaxed mb-6 font-medium bg-muted/30 p-4 rounded-lg border">
                    {analysis.summary}
                  </p>
                  <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-4">Program Eligibility</h4>
                  <div className="grid gap-3">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {analysis.eligiblePrograms.map((p: any) => (
                      <div
                        key={p.program}
                        className={cn(
                          "flex items-center justify-between p-4 rounded-xl border transition-colors",
                          p.eligible ? "border-[#C97E5966] bg-[#FDF6F0]/50" : "border-slate-200 bg-slate-50/50",
                        )}
                      >
                        <div className="flex items-center gap-3">
                          {p.eligible ? <CheckCircle className="w-5 h-5 text-[#C97E59]" /> : <XCircle className="w-5 h-5 text-slate-400" />}
                          <div>
                            <p className="font-bold text-foreground">{p.program}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{p.reason}</p>
                          </div>
                        </div>
                        {p.eligible && p.entitlementWeeks && (
                          <span className="text-xs font-bold uppercase px-2 py-1 rounded-md" style={{ color: "#9E5D38", background: "#F5E8DF" }}>
                            {p.entitlementWeeks} Weeks
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 pt-6 border-t flex flex-wrap gap-6 text-sm">
                    <div>
                      <span className="text-muted-foreground block text-xs">Confidence Score</span>
                      <span className="font-bold text-lg">{(analysis.confidenceScore * 100).toFixed(0)}%</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-xs">Avg Hours/Week</span>
                      <span className="font-bold text-lg">{analysis.avgHoursPerWeek?.toFixed(1) || "N/A"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-xs">Lookback Period</span>
                      <span className="font-bold text-lg">{analysis.lookbackMonths} mos</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {/* AI Assistant Panel */}
            <div ref={aiPanelRef}>
              <AiAssistantPanel
                caseId={caseId}
                employeeEmail={caseData.employeeEmail}
                caseState={caseData.state}
                onNoticesSent={handleNoticesSent}
                autoGenerate={autoGenerateAi}
              />
            </div>

            {/* Case Documents */}
            <CaseDocumentsPanel caseId={caseId} />
          </div>

          {/* Right column */}
          <div className="space-y-8">
            {/* HR Decisions */}
            <div className="bg-card border shadow-sm rounded-2xl p-6">
              <h3 className="font-display font-bold text-lg border-b pb-3 mb-4 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-[#C97E59]" />
                HR Decisions
              </h3>
              {decisions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No decisions recorded yet.</p>
              ) : (
                <div className="space-y-4">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {decisions.map((d: any) => (
                    <div key={d.id} className="relative pl-6 pb-4 border-l-2 border-slate-200 last:border-0 last:pb-0">
                      <div className="absolute w-3 h-3 rounded-full -left-[7px] top-1 ring-4 ring-white" style={{ background: "#C97E59" }} />
                      <div className="bg-slate-50 border rounded-lg p-3">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-bold text-sm">{d.decisionType.replace(/_/g, " ")}</span>
                          <span className="text-[10px] text-muted-foreground">{formatDate(d.decidedAt)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">By: <span className="font-medium text-foreground">{d.decidedBy}</span></p>
                        {d.decisionNotes && (
                          <div className="text-sm bg-white p-2 rounded border text-slate-700 italic">"{d.decisionNotes}"</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Activity Log */}
            <div className="bg-card border shadow-sm rounded-2xl p-6">
              <h3 className="font-display font-bold text-lg border-b pb-3 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-slate-500" />
                Activity Log
              </h3>
              <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                {audit.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No activity logs.</p>
                ) : (
                  audit.map((a: any) => (
                    <div key={a.id} className="text-sm border-b pb-3 last:border-0 last:pb-0">
                      <p className="font-medium">{a.action.replace(/_/g, " ")}</p>
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>{a.actor}</span>
                        <span>{formatDateTime(a.createdAt)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AnalyzeCaseModal isOpen={activeModal === "ANALYZE"} onClose={() => setActiveModal(null)} caseId={caseId} />
      {transitionEvent && (
        <TransitionCaseModal
          isOpen={activeModal === "TRANSITION"}
          onClose={() => { setActiveModal(null); setTransitionEvent(null); }}
          caseId={caseId}
          event={transitionEvent}
        />
      )}
      <RecordDecisionModal isOpen={activeModal === "DECISION"} onClose={() => setActiveModal(null)} caseId={caseId} />
      <DeleteCaseModal
        isOpen={showDeleteModal}
        caseNumber={caseData.caseNumber}
        caseId={caseId}
        onClose={() => setShowDeleteModal(false)}
        onDeleted={() => navigate("/cases")}
      />
    </AppLayout>
  );
}

// ── DeleteCaseModal ───────────────────────────────────────────────────────────
interface DeleteCaseModalProps {
  isOpen: boolean;
  caseNumber: string;
  caseId: string;
  onClose: () => void;
  onDeleted: () => void;
}

function DeleteCaseModal({ isOpen, caseNumber, caseId, onClose, onDeleted }: DeleteCaseModalProps) {
  const [reason, setReason] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleDelete() {
    const trimmed = reason.trim();
    if (trimmed.length < 10) {
      setError("Please provide a reason of at least 10 characters.");
      return;
    }
    setIsDeleting(true);
    setError(null);
    try {
      await apiFetch(`/api/cases/${caseId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: trimmed }),
      });
      onDeleted();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to delete case.");
      setIsDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <Trash2 className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h3 className="font-display font-bold text-lg text-foreground">Delete Case</h3>
            <p className="text-sm text-muted-foreground">{caseNumber}</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          This case will be marked as deleted. It will no longer appear in the active case list but will remain in the database for auditing purposes.
        </p>
        <div className="mb-4">
          <label className="block text-sm font-semibold mb-1.5" style={{ color: "#3D2010" }}>
            Reason for deletion <span className="text-red-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Provide a clear reason for deleting this case (min. 10 characters)…"
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 resize-none"
          />
          <p className="text-xs text-slate-400 mt-1">{reason.trim().length} / 10 min characters</p>
        </div>
        {error && (
          <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 rounded-xl text-sm font-medium border border-slate-200 hover:bg-slate-50 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting || reason.trim().length < 10}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-red-600 hover:bg-red-700 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isDeleting ? (
              <><span className="animate-spin inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> Deleting…</>
            ) : (
              <><Trash2 className="w-4 h-4" /> Confirm Delete</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
