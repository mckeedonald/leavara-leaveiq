import React, { useState, useCallback } from "react";
import { useAuth, apiFetch } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { DisclaimerModal } from "@/components/common/DisclaimerModal";
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  HelpCircle,
  RefreshCw,
  Send,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertTriangle,
  Mail,
  ShieldCheck,
} from "lucide-react";

interface AiNoticeDraft {
  noticeType: string;
  title: string;
  content: string;
}

interface AiRecommendation {
  action: "APPROVE" | "DENY" | "REQUEST_MORE_INFO";
  reasoning: string;
  confidenceScore: number;
  keyFactors: string[];
}

interface AiResult {
  recommendation: AiRecommendation;
  notices: AiNoticeDraft[];
}

interface EditedNotice {
  noticeType: string;
  title: string;
  content: string;
  reviewed: boolean;
}

const ACTION_CONFIG = {
  APPROVE: {
    label: "Approve Leave",
    icon: CheckCircle2,
    badgeClass: "bg-[#F5E8DF] text-[#9E5D38] border-[#C97E5966]",
    iconClass: "text-[#C97E59]",
  },
  DENY: {
    label: "Deny Leave",
    icon: XCircle,
    badgeClass: "bg-red-100 text-red-800 border-red-200",
    iconClass: "text-red-600",
  },
  REQUEST_MORE_INFO: {
    label: "Request More Info",
    icon: HelpCircle,
    badgeClass: "bg-amber-100 text-amber-800 border-amber-200",
    iconClass: "text-amber-600",
  },
};

interface Props {
  caseId: string;
  employeeEmail?: string | null;
  caseState: string;
  /** Called after notices are successfully sent — parent should transition the case state */
  onNoticesSent?: () => void;
  /** When true, auto-trigger AI generation on mount */
  autoGenerate?: boolean;
}

type DisclaimerAction = "generate" | "regenerate";

export function AiAssistantPanel({ caseId, employeeEmail, caseState, onNoticesSent, autoGenerate }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiResult | null>(null);
  const [editedNotices, setEditedNotices] = useState<EditedNotice[]>([]);
  const [expandedNotices, setExpandedNotices] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [regeneratingNotice, setRegeneratingNotice] = useState<string | null>(null);
  const [overrideEmail, setOverrideEmail] = useState(employeeEmail ?? "");

  const [disclaimerOpen, setDisclaimerOpen] = useState(false);
  const [disclaimerAction, setDisclaimerAction] = useState<DisclaimerAction | null>(null);
  const [pendingRegenerateType, setPendingRegenerateType] = useState<string | null>(null);

  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<Array<{ role: "user" | "ava"; text: string }>>([]);
  const [chatLoading, setChatLoading] = useState(false);

  // Auto-generate on mount when parent requests it
  React.useEffect(() => {
    if (autoGenerate && !result && !loading) {
      setDisclaimerAction("generate");
      setDisclaimerOpen(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGenerate]);

  function requestGenerate() {
    setDisclaimerAction("generate");
    setDisclaimerOpen(true);
  }

  function requestRegenerate(noticeType: string) {
    setPendingRegenerateType(noticeType);
    setDisclaimerAction("regenerate");
    setDisclaimerOpen(true);
  }

  function handleDisclaimerConfirm() {
    setDisclaimerOpen(false);
    if (disclaimerAction === "generate") {
      void fetchRecommendation();
    } else if (disclaimerAction === "regenerate" && pendingRegenerateType) {
      void regenerateNotice(pendingRegenerateType);
    }
    setDisclaimerAction(null);
    setPendingRegenerateType(null);
  }

  function handleDisclaimerCancel() {
    setDisclaimerOpen(false);
    setDisclaimerAction(null);
    setPendingRegenerateType(null);
  }

  // Show AI panel for ELIGIBILITY_ANALYSIS, HR_REVIEW_QUEUE, and NOTICE_DRAFTED
  // (NOTICE_DRAFTED: designation notice can be sent after documentation is returned)
  const isEligibility = caseState === "ELIGIBILITY_ANALYSIS";
  const isHrReview = caseState === "HR_REVIEW_QUEUE";
  const isNoticeDrafted = caseState === "NOTICE_DRAFTED";
  const showAiPanel = isEligibility || isHrReview || isNoticeDrafted;

  const fetchRecommendation = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSendSuccess(false);
    setSendError(null);
    try {
      const data = await apiFetch<AiResult>(`/api/cases/${caseId}/ai-recommendation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestedBy: user?.email ?? "HR" }),
      });
      setResult(data);
      setEditedNotices(
        data.notices.map((n) => ({
          noticeType: n.noticeType,
          title: n.title,
          content: n.content,
          reviewed: false,
        })),
      );
      setExpandedNotices(new Set(data.notices.map((n) => n.noticeType)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [caseId, user?.email]);

  const regenerateNotice = useCallback(
    async (noticeType: string) => {
      if (!result) return;
      setRegeneratingNotice(noticeType);
      try {
        const data = await apiFetch<AiResult>(`/api/cases/${caseId}/ai-recommendation`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestedBy: user?.email ?? "HR" }),
        });
        const freshNotice = data.notices.find((n) => n.noticeType === noticeType);
        if (freshNotice) {
          setEditedNotices((prev) =>
            prev.map((n) =>
              n.noticeType === noticeType
                ? { ...n, content: freshNotice.content, reviewed: false }
                : n,
            ),
          );
        }
      } catch {
        /* silent */
      } finally {
        setRegeneratingNotice(null);
      }
    },
    [caseId, result, user?.email],
  );

  const sendFeedback = useCallback(async () => {
    const msg = chatInput.trim();
    if (!msg || chatLoading) return;
    setChatInput("");
    setChatHistory(prev => [...prev, { role: "user", text: msg }]);
    setChatLoading(true);
    try {
      const data = await apiFetch<AiResult>(`/api/cases/${caseId}/ai-recommendation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestedBy: user?.email ?? "HR", feedback: msg }),
      });
      setResult(data);
      setEditedNotices(
        data.notices.map((n) => ({
          noticeType: n.noticeType,
          title: n.title,
          content: n.content,
          reviewed: false,
        })),
      );
      setExpandedNotices(new Set(data.notices.map((n) => n.noticeType)));
      setChatHistory(prev => [...prev, { role: "ava", text: "I've updated the notices based on your feedback. Please review the changes above." }]);
    } catch (err) {
      setChatHistory(prev => [...prev, { role: "ava", text: `Sorry, I couldn't process that: ${err instanceof Error ? err.message : "Unknown error"}` }]);
    } finally {
      setChatLoading(false);
    }
  }, [chatInput, chatLoading, caseId, user?.email]);

  const handleNoticeEdit = (noticeType: string, content: string) => {
    setEditedNotices((prev) =>
      prev.map((n) => (n.noticeType === noticeType ? { ...n, content, reviewed: true } : n)),
    );
  };

  const markReviewed = (noticeType: string) => {
    setEditedNotices((prev) =>
      prev.map((n) => (n.noticeType === noticeType ? { ...n, reviewed: true } : n)),
    );
  };

  const toggleNotice = (noticeType: string) => {
    setExpandedNotices((prev) => {
      const next = new Set(prev);
      if (next.has(noticeType)) next.delete(noticeType);
      else next.add(noticeType);
      return next;
    });
  };

  const canSend = editedNotices.some((n) => n.reviewed) && overrideEmail.trim().length > 0;

  const sendNotices = async () => {
    const toSend = editedNotices.filter((n) => n.reviewed);
    if (!toSend.length || !overrideEmail.trim()) return;
    setSending(true);
    setSendError(null);
    try {
      await apiFetch(`/api/cases/${caseId}/send-notices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notices: toSend.map((n) => ({ noticeType: n.noticeType, content: n.content })),
          approvedBy: user?.email ?? "HR",
          employeeEmail: overrideEmail.trim(),
        }),
      });
      setSendSuccess(true);
      // Notify parent so it can transition case state (e.g. ELIGIBILITY_ANALYSIS → NOTICE_DRAFTED)
      onNoticesSent?.();
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  };

  if (!showAiPanel) return null;

  return (
    <>
      {disclaimerOpen && (
        <DisclaimerModal onConfirm={handleDisclaimerConfirm} onCancel={handleDisclaimerCancel} />
      )}
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="p-5" style={{ background: "linear-gradient(135deg, #E8872A 0%, #C95F20 100%)" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-white" />
            <h3 className="font-display font-bold text-white text-lg">Ava</h3>
          </div>
          {!result && !loading && (
            <button
              onClick={requestGenerate}
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white text-sm font-medium px-4 py-2 rounded-xl transition-all"
            >
              <Sparkles className="w-4 h-4" />
              Generate Recommendation
            </button>
          )}
          {result && (
            <button
              onClick={requestGenerate}
              disabled={loading}
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white text-sm font-medium px-4 py-2 rounded-xl transition-all disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Refresh
            </button>
          )}
        </div>
        <p className="text-sm mt-1.5" style={{ color: "#FDDBB4" }}>
          {isEligibility
            ? "Generate AI-drafted notices for this case — review, edit, and send directly from here"
            : "AI-powered case analysis, recommended actions, and legally-required notice drafts"}
        </p>
      </div>

      <div className="p-5">
        {loading && (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
            <p className="text-sm text-amber-800 font-medium">
              Analyzing case and drafting notices…
            </p>
            <p className="text-xs text-amber-600">This may take 15–30 seconds</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-800 text-sm">Failed to generate recommendation</p>
              <p className="text-red-700 text-sm mt-1">{error}</p>
              <button
                onClick={fetchRecommendation}
                className="mt-2 text-sm text-red-700 underline hover:text-red-900"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {!loading && !result && !error && (
          <div className="text-center py-8">
            <Sparkles className="w-10 h-10 text-amber-300 mx-auto mb-3" />
            <p className="text-sm text-slate-600 font-medium mb-1">
              No recommendation generated yet
            </p>
            <p className="text-xs text-slate-500">
              Click "Generate Recommendation" to have the AI analyze this case and draft required notices.
            </p>
          </div>
        )}

        {result && !loading && (
          <div className="space-y-6">
            <RecommendationCard recommendation={result.recommendation} />

            <div>
              <h4 className="font-semibold text-sm uppercase tracking-wider text-slate-500 mb-3">
                Notice Drafts
              </h4>
              <div className="space-y-3">
                {editedNotices.map((notice) => (
                  <NoticeEditor
                    key={notice.noticeType}
                    notice={notice}
                    isExpanded={expandedNotices.has(notice.noticeType)}
                    isRegenerating={regeneratingNotice === notice.noticeType}
                    onToggle={() => toggleNotice(notice.noticeType)}
                    onEdit={(content) => handleNoticeEdit(notice.noticeType, content)}
                    onReviewed={() => markReviewed(notice.noticeType)}
                    onRegenerate={() => requestRegenerate(notice.noticeType)}
                  />
                ))}
              </div>
            </div>

            <div className="border-t pt-5 space-y-4">
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-1.5">
                  Employee Email Address
                </label>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="email"
                    value={overrideEmail}
                    onChange={(e) => setOverrideEmail(e.target.value)}
                    placeholder="employee@company.com"
                    className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400"
                  />
                </div>
                {!employeeEmail && (
                  <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    No email was captured at intake. Please enter the employee's email manually.
                  </p>
                )}
              </div>

              {sendSuccess ? (
                <div className="border rounded-xl p-4 flex items-start gap-3" style={{ background: "#FDF6F0", borderColor: "#C97E5966" }}>
                  <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "#9E5D38" }} />
                  <div>
                    <p className="font-medium text-sm" style={{ color: "#3D2010" }}>Notices sent successfully</p>
                    <p className="text-sm mt-1" style={{ color: "#A47864" }}>
                      {editedNotices.filter((n) => n.reviewed).length} notice(s) were delivered to{" "}
                      <strong>{overrideEmail}</strong> and recorded in the audit log.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {sendError && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      {sendError}
                    </div>
                  )}
                  <div
                    className="flex items-start gap-2 px-3 py-2.5 rounded-xl text-xs"
                    style={{ background: "#FDF4EE", border: "1px solid #E8C4A8", color: "#7A4A2A" }}
                  >
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "#C97E59" }} />
                    <span>
                      <strong>Decision Support Only —</strong> LeaveIQ provides recommendations to assist HR.
                      A human decision is always required before sending.
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-500">
                      {editedNotices.filter((n) => n.reviewed).length} of {editedNotices.length}{" "}
                      notices reviewed &amp; ready to send
                    </p>
                    <button
                      onClick={sendNotices}
                      disabled={!canSend || sending}
                      className={cn(
                        "flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all",
                        canSend && !sending
                          ? "text-white shadow-md"
                          : "bg-slate-200 text-slate-400 cursor-not-allowed",
                      )}
                      style={canSend && !sending ? { background: "linear-gradient(135deg, #E8872A 0%, #C95F20 100%)" } : undefined}
                    >
                      {sending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Sending…
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" /> Send to Employee
                        </>
                      )}
                    </button>
                  </div>
                  {!canSend && !sending && (
                    <p className="text-xs text-slate-400">
                      Review at least one notice and provide an email address to enable sending.
                    </p>
                  )}
                </>
              )}
            </div>

            {result && (
              <div className="mt-6 border-t pt-5">
                <div
                  className="rounded-2xl overflow-hidden"
                  style={{ background: "linear-gradient(135deg, #E8872A 0%, #C95F20 100%)" }}
                >
                  <div className="px-4 py-3 flex items-center gap-2 border-b border-white/10">
                    <Sparkles className="w-4 h-4 text-white" />
                    <span className="text-sm font-semibold text-white">Give Ava feedback</span>
                  </div>
                  {chatHistory.length > 0 && (
                    <div className="px-4 py-3 space-y-2 max-h-48 overflow-y-auto">
                      {chatHistory.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                          <div
                            className="rounded-xl px-3 py-2 text-sm max-w-[85%]"
                            style={msg.role === "user"
                              ? { background: "rgba(255,255,255,0.25)", color: "#fff" }
                              : { background: "rgba(0,0,0,0.25)", color: "#FDDBB4" }
                            }
                          >
                            {msg.role === "ava" && <span className="font-semibold text-xs block mb-0.5" style={{ color: "#fde68a" }}>Ava</span>}
                            {msg.text}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="px-4 pb-4 pt-3 flex gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendFeedback(); } }}
                      placeholder="e.g. Make the eligibility notice more formal…"
                      disabled={chatLoading}
                      className="flex-1 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-white/40 disabled:opacity-50 select-text"
                      style={{ background: "rgba(0,0,0,0.2)", color: "#fff", border: "1px solid rgba(255,255,255,0.3)", caretColor: "#fff" }}
                    />
                    <button
                      onClick={() => void sendFeedback()}
                      disabled={chatLoading || !chatInput.trim()}
                      className="px-4 py-2 rounded-xl text-sm font-semibold bg-white/20 hover:bg-white/30 text-white disabled:opacity-40 transition-all flex items-center gap-1.5"
                    >
                      {chatLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Sparkles className="w-3.5 h-3.5" /> Send</>}
                    </button>
                  </div>
                  <p className="text-xs px-4 pb-3" style={{ color: "rgba(255,255,255,0.65)" }}>
                    Ava will regenerate all notices based on your feedback.
                  </p>
                </div>{/* end gradient container */}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
    </>
  );
}

function RecommendationCard({ recommendation }: { recommendation: AiRecommendation }) {
  const config = ACTION_CONFIG[recommendation.action];
  const ActionIcon = config.icon;
  const confidence = Math.round(recommendation.confidenceScore * 100);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <ActionIcon className={cn("w-6 h-6", config.iconClass)} />
          <span
            className={cn(
              "text-sm font-bold px-3 py-1 rounded-full border",
              config.badgeClass,
            )}
          >
            {config.label}
          </span>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">AI Confidence</p>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  confidence >= 85
                    ? "bg-[#C97E59]"
                    : confidence >= 65
                    ? "bg-amber-400"
                    : "bg-red-400",
                )}
                style={{ width: `${confidence}%` }}
              />
            </div>
            <span className="text-sm font-bold text-slate-700">{confidence}%</span>
          </div>
        </div>
      </div>

      <p className="text-sm text-slate-700 leading-relaxed mb-4">{recommendation.reasoning}</p>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
          Key Factors
        </p>
        <ul className="space-y-1.5">
          {recommendation.keyFactors.map((factor, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
              <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                {i + 1}
              </span>
              {factor}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

interface NoticeEditorProps {
  notice: EditedNotice;
  isExpanded: boolean;
  isRegenerating: boolean;
  onToggle: () => void;
  onEdit: (content: string) => void;
  onReviewed: () => void;
  onRegenerate: () => void;
}

function NoticeEditor({
  notice,
  isExpanded,
  isRegenerating,
  onToggle,
  onEdit,
  onReviewed,
  onRegenerate,
}: NoticeEditorProps) {
  return (
    <div
      className="border rounded-xl overflow-hidden transition-all"
      style={notice.reviewed ? { borderColor: "#C97E5966", background: "rgba(253,246,240,0.5)" } : { borderColor: "#e2e8f0", background: "#fff" }}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => e.key === "Enter" && onToggle()}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50/50 transition-colors cursor-pointer select-none"
      >
        <div className="flex items-center gap-2.5">
          {notice.reviewed ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: "#C97E59" }} />
          ) : (
            <div className="w-4 h-4 rounded-full border-2 border-slate-300 shrink-0" />
          )}
          <span className="text-sm font-semibold text-slate-800">{notice.title}</span>
          {notice.reviewed && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "#F5E8DF", color: "#9E5D38" }}>
              Reviewed
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRegenerate();
            }}
            disabled={isRegenerating}
            title="Regenerate this notice"
            className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors disabled:opacity-40"
          >
            {isRegenerating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
          </button>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-slate-100">
          <p className="text-xs text-slate-500 py-2.5">
            Edit the notice below before sending. Changes are saved automatically.
          </p>
          <textarea
            value={notice.content}
            onChange={(e) => onEdit(e.target.value)}
            rows={12}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 font-mono resize-y leading-relaxed"
            style={{ color: "#3D2010" }}
          />
          {!notice.reviewed && (
            <div className="flex justify-end mt-2">
              <button
                onClick={onReviewed}
                className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-all text-white"
                style={{ background: "#C97E59" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#9E5D38")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#C97E59")}
              >
                <CheckCircle2 className="w-4 h-4" />
                Mark as Reviewed
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
