import React, { useState, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { apiFetch } from "@/lib/auth";
import { useAuth } from "@/lib/auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, ShieldCheck, User, Mail, FileText, Stethoscope,
  CheckCircle, XCircle, Calendar, Clock, Loader2, AlertTriangle,
  Send, Plus, ChevronDown, Pencil
} from "lucide-react";
import { AdaAgentPanel } from "@/components/ada/AdaAgentPanel";
import { AdaInteractiveLog, type LogEntry } from "@/components/ada/AdaInteractiveLog";
import { CaseMessaging } from "@/components/cases/CaseMessaging";
import type { CaseMessage } from "@/components/cases/CaseMessaging";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────
interface AdaCaseData {
  id: string;
  organizationId: string;
  caseNumber: string;
  employeeNumber?: string | null;
  employeeFirstName?: string | null;
  employeeLastName?: string | null;
  employeeEmail?: string | null;
  disabilityDescription?: string | null;
  functionalLimitations?: string | null;
  accommodationRequested?: string | null;
  isTemporary?: boolean | null;
  estimatedDuration?: string | null;
  hasPhysicianSupport?: boolean | null;
  additionalNotes?: string | null;
  status: string;
  displayStatus?: string | null;
  decision?: string | null;
  decisionDate?: string | null;
  decisionNotes?: string | null;
  hardshipJustification?: string | null;
  assignedToUserId?: string | null;
  physicianCertSentAt?: string | null;
  physicianCertReceivedAt?: string | null;
  accessToken?: string | null;
  submittedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ApprovedAccommodation {
  id: string;
  caseId: string;
  description: string;
  category?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  isOngoing: boolean;
  calendarLabel?: string | null;
  isActive: boolean;
  createdAt: string;
}

interface AdaCaseDetailResponse {
  case: AdaCaseData;
  log: LogEntry[];
  accommodations: ApprovedAccommodation[];
}

// ── Status config ──────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  pending_review:     { bg: "#FFF7ED", text: "#92400E", border: "#FDE68A" },
  in_process:         { bg: "#EFF6FF", text: "#1E40AF", border: "#BFDBFE" },
  awaiting_physician: { bg: "#F5F3FF", text: "#5B21B6", border: "#DDD6FE" },
  approved:           { bg: "#F0FDF4", text: "#166534", border: "#BBF7D0" },
  denied:             { bg: "#FEF2F2", text: "#991B1B", border: "#FECACA" },
  closed:             { bg: "#F9FAFB", text: "#374151", border: "#E5E7EB" },
};

const STATUS_LABELS: Record<string, string> = {
  pending_review:     "Pending Review",
  in_process:         "In Process",
  awaiting_physician: "Awaiting Physician Cert",
  approved:           "Approved",
  denied:             "Denied",
  closed:             "Closed",
};

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_COLORS[status] ?? { bg: "#F9FAFB", text: "#374151", border: "#E5E7EB" };
  return (
    <span
      className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border"
      style={{ background: c.bg, color: c.text, borderColor: c.border }}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

// ── Send physician cert modal ──────────────────────────────────────────────────
function PhysicianCertModal({
  caseId,
  employeeEmail,
  onClose,
  onSent,
}: { caseId: string; employeeEmail?: string | null; onClose: () => void; onSent: () => void }) {
  const [loading, setLoading] = useState(false);
  const [letter, setLetter] = useState<string | null>(null);
  const [email, setEmail] = useState(employeeEmail ?? "");
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ letter: string }>(`/api/ada/cases/${caseId}/physician-cert`);
      setLetter(res.letter);
    } catch {
      setError("Failed to generate letter. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const send = async () => {
    if (!email.trim() || !letter) return;
    setLoading(true);
    try {
      await apiFetch(`/api/ada/cases/${caseId}/physician-cert`, {
        method: "POST",
        body: JSON.stringify({ recipientEmail: email }),
      });
      onSent();
      onClose();
    } catch {
      setError("Failed to send. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "#DDD6FE" }}>
          <div className="flex items-center gap-2">
            <Stethoscope className="w-5 h-5" style={{ color: "#7C3AED" }} />
            <h3 className="font-semibold" style={{ color: "#4C1D95" }}>Physician Certification Request</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
          {!letter ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
              <Stethoscope className="w-12 h-12" style={{ color: "#DDD6FE" }} />
              <p className="text-sm text-muted-foreground max-w-sm">
                Generate an ADA-compliant physician certification request. This letter requests only functional limitations
                — not a diagnosis — in accordance with EEOC guidance.
              </p>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                onClick={generate}
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-white font-medium disabled:opacity-60"
                style={{ background: "#7C3AED" }}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                Generate Letter
              </button>
            </div>
          ) : (
            <>
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: "#5B21B6" }}>
                  Send to (email)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="employee@company.com"
                  className="w-full text-sm border rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-violet-200"
                  style={{ borderColor: "#DDD6FE" }}
                />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: "#5B21B6" }}>Letter Preview</label>
                <textarea
                  value={letter}
                  onChange={(e) => setLetter(e.target.value)}
                  rows={16}
                  className="w-full text-sm border rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-violet-200 resize-none font-mono"
                  style={{ borderColor: "#DDD6FE" }}
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </>
          )}
        </div>

        {letter && (
          <div className="flex justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: "#EDE9FE" }}>
            <button onClick={onClose} className="text-sm px-4 py-2 rounded-xl border hover:bg-gray-50"
              style={{ borderColor: "#D1D5DB", color: "#374151" }}>
              Cancel
            </button>
            <button
              onClick={send}
              disabled={!email.trim() || loading}
              className="flex items-center gap-2 text-sm px-5 py-2 rounded-xl text-white font-medium disabled:opacity-50"
              style={{ background: "#7C3AED" }}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send Physician Cert
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Schedule follow-up modal ───────────────────────────────────────────────────
function ScheduleFollowUpModal({
  caseId,
  caseNumber,
  employeeEmail,
  suggestedDate,
  onClose,
  onScheduled,
}: {
  caseId: string;
  caseNumber: string;
  employeeEmail?: string | null;
  suggestedDate?: string;
  onClose: () => void;
  onScheduled: () => void;
}) {
  const [date, setDate] = useState(suggestedDate ?? "");
  const [time, setTime] = useState("10:00");
  const [title, setTitle] = useState(`ADA Interactive Process — ${caseNumber}`);
  const [notes, setNotes] = useState("");
  const [extraEmails, setExtraEmails] = useState(employeeEmail ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const schedule = async () => {
    if (!date || !time) return;
    setLoading(true);
    setError(null);
    try {
      const scheduledAt = new Date(`${date}T${time}:00`).toISOString();
      const attendeeEmails = extraEmails
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean);
      await apiFetch(`/api/ada/cases/${caseId}/calendar-invite`, {
        method: "POST",
        body: JSON.stringify({ title, scheduledAt, attendeeEmails, description: notes }),
      });
      onScheduled();
      onClose();
    } catch {
      setError("Failed to schedule. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "#DDD6FE" }}>
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5" style={{ color: "#7C3AED" }} />
            <h3 className="font-semibold" style={{ color: "#4C1D95" }}>Schedule Follow-Up Meeting</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>

        <div className="p-6 flex flex-col gap-4">
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: "#5B21B6" }}>Meeting Title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              className="w-full text-sm border rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-violet-200"
              style={{ borderColor: "#DDD6FE" }} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium block mb-1.5" style={{ color: "#5B21B6" }}>Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="w-full text-sm border rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-violet-200"
                style={{ borderColor: "#DDD6FE" }} />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1.5" style={{ color: "#5B21B6" }}>Time</label>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
                className="w-full text-sm border rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-violet-200"
                style={{ borderColor: "#DDD6FE" }} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: "#5B21B6" }}>
              Attendee Emails <span className="font-normal text-muted-foreground">(comma-separated)</span>
            </label>
            <input type="text" value={extraEmails} onChange={(e) => setExtraEmails(e.target.value)}
              placeholder="employee@company.com, manager@company.com"
              className="w-full text-sm border rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-violet-200"
              style={{ borderColor: "#DDD6FE" }} />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: "#5B21B6" }}>Meeting Notes / Agenda (optional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
              placeholder="Topics to cover in this meeting…"
              className="w-full text-sm border rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-violet-200 resize-none"
              style={{ borderColor: "#DDD6FE" }} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <p className="text-xs text-muted-foreground">
            A calendar invite (.ics) will be emailed to all attendees.
          </p>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: "#EDE9FE" }}>
          <button onClick={onClose} className="text-sm px-4 py-2 rounded-xl border hover:bg-gray-50"
            style={{ borderColor: "#D1D5DB", color: "#374151" }}>Cancel</button>
          <button
            onClick={schedule}
            disabled={!date || !time || loading}
            className="flex items-center gap-2 text-sm px-5 py-2 rounded-xl text-white font-medium disabled:opacity-50"
            style={{ background: "#7C3AED" }}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
            Send Invite
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Update status panel ────────────────────────────────────────────────────────
function UpdateStatusDropdown({
  caseId,
  currentStatus,
  onUpdated,
}: { caseId: string; currentStatus: string; onUpdated: () => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const statuses = [
    { value: "in_process", label: "In Process" },
    { value: "awaiting_physician", label: "Awaiting Physician Cert" },
    { value: "approved", label: "Approved" },
    { value: "denied", label: "Denied" },
    { value: "closed", label: "Closed" },
  ].filter((s) => s.value !== currentStatus);

  const update = async (status: string) => {
    setLoading(true);
    try {
      await apiFetch(`/api/ada/cases/${caseId}`, {
        method: "PATCH",
        body: JSON.stringify({
          status,
          displayStatus: STATUS_LABELS[status] ?? status,
        }),
      });
      onUpdated();
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={loading}
        className="flex items-center gap-2 text-sm px-3 py-2 rounded-xl border font-medium transition-colors hover:bg-gray-50 disabled:opacity-50"
        style={{ borderColor: "#DDD6FE", color: "#5B21B6" }}
      >
        <Pencil className="w-3.5 h-3.5" /> Update Status
        <ChevronDown className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 bg-white rounded-xl border shadow-lg min-w-[180px] py-1" style={{ borderColor: "#DDD6FE" }}>
          {statuses.map((s) => (
            <button
              key={s.value}
              onClick={() => update(s.value)}
              className="w-full text-left px-4 py-2 text-sm hover:bg-violet-50 transition-colors"
              style={{ color: "#374151" }}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main AdaCase page ─────────────────────────────────────────────────────────
export default function AdaCase() {
  const [location] = useLocation();
  const caseId = location.split("/").filter(Boolean).pop() ?? "";
  const { user } = useAuth();
  const qc = useQueryClient();

  const [showPhysicianModal, setShowPhysicianModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [suggestedFollowUpDate, setSuggestedFollowUpDate] = useState<string | undefined>();

  const queryKey = ["ada-case", caseId];

  const { data, isLoading, error } = useQuery<AdaCaseDetailResponse>({
    queryKey,
    queryFn: () => apiFetch<AdaCaseDetailResponse>(`/api/ada/cases/${caseId}`),
    enabled: !!caseId,
  });

  const refresh = useCallback(() => qc.invalidateQueries({ queryKey }), [qc, queryKey]);

  const handleActionSuggested = (action: string) => {
    if (action === "send_physician_cert") {
      setShowPhysicianModal(true);
    }
  };

  // CaseMessaging integration
  const fetchMessages = useCallback(async (): Promise<CaseMessage[]> => {
    const res = await apiFetch<CaseMessage[]>(`/api/cases/${caseId}/messages?product=leaveiq`);
    return res;
  }, [caseId]);

  const sendMessage = useCallback(async (content: string): Promise<CaseMessage> => {
    return apiFetch<CaseMessage>(`/api/cases/${caseId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content, product: "leaveiq", senderType: "hr" }),
    });
  }, [caseId]);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#7C3AED" }} />
        </div>
      </AppLayout>
    );
  }

  if (error || !data) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-32 gap-4 text-center">
          <AlertTriangle className="w-10 h-10 text-red-500" />
          <p className="font-semibold text-lg">Case not found</p>
          <Link href="/leaveiq/ada-cases">
            <button className="text-sm px-4 py-2 rounded-xl border hover:bg-gray-50">← Back to ADA Cases</button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  const { case: adaCase, log, accommodations } = data;
  const employeeName = [adaCase.employeeFirstName, adaCase.employeeLastName].filter(Boolean).join(" ")
    || `Employee #${adaCase.employeeNumber}`;

  return (
    <AppLayout>
      {showPhysicianModal && (
        <PhysicianCertModal
          caseId={caseId}
          employeeEmail={adaCase.employeeEmail}
          onClose={() => setShowPhysicianModal(false)}
          onSent={refresh}
        />
      )}
      {showScheduleModal && (
        <ScheduleFollowUpModal
          caseId={caseId}
          caseNumber={adaCase.caseNumber}
          employeeEmail={adaCase.employeeEmail}
          suggestedDate={suggestedFollowUpDate}
          onClose={() => setShowScheduleModal(false)}
          onScheduled={refresh}
        />
      )}

      <div className="mb-6 animate-in opacity-0 stagger-1">
        <Link href="/leaveiq/ada-cases">
          <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
            <ArrowLeft className="w-4 h-4" /> Back to ADA Cases
          </button>
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-sm"
              style={{ background: "linear-gradient(135deg, #7C3AED, #A855F7)" }}>
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-display font-bold text-foreground font-mono">
                  {adaCase.caseNumber}
                </h1>
                <StatusBadge status={adaCase.status} />
              </div>
              <p className="text-muted-foreground text-sm mt-0.5">{employeeName}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowPhysicianModal(true)}
              className="flex items-center gap-2 text-sm px-3 py-2 rounded-xl border font-medium transition-colors hover:bg-violet-50"
              style={{ borderColor: "#DDD6FE", color: "#5B21B6" }}
            >
              <Stethoscope className="w-3.5 h-3.5" />
              {adaCase.physicianCertSentAt ? "Resend Physician Cert" : "Send Physician Cert"}
            </button>
            <button
              onClick={() => setShowScheduleModal(true)}
              className="flex items-center gap-2 text-sm px-3 py-2 rounded-xl border font-medium transition-colors hover:bg-violet-50"
              style={{ borderColor: "#DDD6FE", color: "#5B21B6" }}
            >
              <Calendar className="w-3.5 h-3.5" />
              Schedule Follow-Up
              {suggestedFollowUpDate && (
                <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full" style={{ background: "#DDD6FE", color: "#5B21B6" }}>
                  {new Date(suggestedFollowUpDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              )}
            </button>
            <UpdateStatusDropdown caseId={caseId} currentStatus={adaCase.status} onUpdated={refresh} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 animate-in opacity-0 stagger-2">
        {/* Left / main column */}
        <div className="xl:col-span-2 flex flex-col gap-6">
          {/* Case info card */}
          <div className="bg-card border rounded-2xl p-6 shadow-sm" style={{ borderColor: "#DDD6FE" }}>
            <h3 className="font-semibold text-sm mb-4" style={{ color: "#4C1D95" }}>Case Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
              <InfoRow icon={<User className="w-4 h-4" />} label="Employee" value={employeeName} />
              {adaCase.employeeNumber && (
                <InfoRow icon={<User className="w-4 h-4" />} label="Employee #" value={adaCase.employeeNumber} />
              )}
              {adaCase.employeeEmail && (
                <InfoRow icon={<Mail className="w-4 h-4" />} label="Email" value={adaCase.employeeEmail} />
              )}
              <InfoRow
                icon={<Clock className="w-4 h-4" />}
                label="Submitted"
                value={new Date(adaCase.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              />
              {adaCase.isTemporary !== null && (
                <InfoRow icon={<Clock className="w-4 h-4" />} label="Temporary"
                  value={adaCase.isTemporary ? `Yes${adaCase.estimatedDuration ? ` (${adaCase.estimatedDuration})` : ""}` : "No — ongoing"} />
              )}
              <InfoRow
                icon={<Stethoscope className="w-4 h-4" />}
                label="Physician Cert"
                value={
                  adaCase.physicianCertReceivedAt
                    ? `Received ${new Date(adaCase.physicianCertReceivedAt).toLocaleDateString()}`
                    : adaCase.physicianCertSentAt
                    ? `Sent ${new Date(adaCase.physicianCertSentAt).toLocaleDateString()}`
                    : "Not yet sent"
                }
              />
            </div>

            {adaCase.functionalLimitations && (
              <div className="mt-5 pt-5 border-t" style={{ borderColor: "#EDE9FE" }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#7C3AED" }}>Functional Limitations</p>
                <p className="text-sm leading-relaxed text-foreground">{adaCase.functionalLimitations}</p>
              </div>
            )}

            {adaCase.accommodationRequested && (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#7C3AED" }}>Accommodation Requested</p>
                <p className="text-sm leading-relaxed text-foreground">{adaCase.accommodationRequested}</p>
              </div>
            )}

            {adaCase.additionalNotes && (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#7C3AED" }}>Additional Notes</p>
                <p className="text-sm leading-relaxed text-muted-foreground">{adaCase.additionalNotes}</p>
              </div>
            )}

            {adaCase.decision && (
              <div className="mt-4 p-4 rounded-xl border" style={{
                background: adaCase.decision === "approved" ? "#F0FDF4" : "#FEF2F2",
                borderColor: adaCase.decision === "approved" ? "#BBF7D0" : "#FECACA",
              }}>
                <div className="flex items-center gap-2 mb-2">
                  {adaCase.decision === "approved"
                    ? <CheckCircle className="w-4 h-4 text-green-600" />
                    : <XCircle className="w-4 h-4 text-red-600" />
                  }
                  <p className="font-semibold text-sm capitalize" style={{ color: adaCase.decision === "approved" ? "#166534" : "#991B1B" }}>
                    Decision: {adaCase.decision}
                  </p>
                </div>
                {adaCase.decisionNotes && <p className="text-sm" style={{ color: adaCase.decision === "approved" ? "#166534" : "#991B1B" }}>{adaCase.decisionNotes}</p>}
                {adaCase.hardshipJustification && (
                  <p className="text-sm mt-1 opacity-80" style={{ color: "#991B1B" }}>
                    Undue hardship basis: {adaCase.hardshipJustification}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Approved Accommodations */}
          {accommodations.length > 0 && (
            <div className="bg-card border rounded-2xl p-6 shadow-sm" style={{ borderColor: "#BBF7D0" }}>
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <h3 className="font-semibold text-sm text-green-800">Approved Accommodations</h3>
              </div>
              <div className="flex flex-col gap-3">
                {accommodations.map((acc) => (
                  <div key={acc.id} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: "#F0FDF4", border: "1px solid #BBF7D0" }}>
                    <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-green-900">{acc.description}</p>
                      {acc.category && (
                        <p className="text-xs text-green-700 mt-0.5">{acc.category}</p>
                      )}
                      <p className="text-xs text-green-600 mt-1">
                        {acc.isOngoing
                          ? `Ongoing — started ${acc.startDate ? new Date(acc.startDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Unknown"}`
                          : acc.startDate
                          ? `${new Date(acc.startDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} → ${acc.endDate ? new Date(acc.endDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "TBD"}`
                          : "Dates TBD"
                        }
                      </p>
                      {acc.calendarLabel && (
                        <p className="text-xs text-green-600 mt-0.5 italic">Calendar: {acc.calendarLabel}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Interactive process log */}
          <AdaInteractiveLog entries={log} caseId={caseId} onRefresh={refresh} />

          {/* Case messaging */}
          <div className="bg-card border rounded-2xl overflow-hidden shadow-sm" style={{ borderColor: "#DDD6FE" }}>
            <div className="px-5 py-4 border-b flex items-center gap-2" style={{ background: "#F5F3FF", borderColor: "#DDD6FE" }}>
              <Mail className="w-4 h-4" style={{ color: "#7C3AED" }} />
              <span className="font-semibold text-sm" style={{ color: "#4C1D95" }}>Employee Messaging</span>
            </div>
            <div className="p-4">
              <CaseMessaging
                fetchMessages={fetchMessages}
                sendMessage={sendMessage}
                viewerType="hr"
                accentColor="#7C3AED"
                borderColor="#DDD6FE"
                cardBg="#FAFAFE"
              />
            </div>
          </div>
        </div>

        {/* Right sidebar — Ada agent */}
        <div className="flex flex-col gap-6">
          <AdaAgentPanel
            caseId={caseId}
            onActionSuggested={handleActionSuggested}
            onFollowUpSuggested={(date) => {
              setSuggestedFollowUpDate(date);
            }}
          />

          {/* Quick actions */}
          <div className="bg-card border rounded-2xl p-5 shadow-sm" style={{ borderColor: "#DDD6FE" }}>
            <p className="font-semibold text-sm mb-4" style={{ color: "#4C1D95" }}>Quick Actions</p>
            <div className="flex flex-col gap-2">
              <QuickAction
                icon={<Stethoscope className="w-4 h-4" />}
                label={adaCase.physicianCertSentAt ? "Resend Physician Cert" : "Send Physician Cert"}
                sublabel={adaCase.physicianCertSentAt
                  ? `Sent ${new Date(adaCase.physicianCertSentAt).toLocaleDateString()}`
                  : "ADA-compliant certification form"
                }
                onClick={() => setShowPhysicianModal(true)}
              />
              <QuickAction
                icon={<Calendar className="w-4 h-4" />}
                label="Schedule Follow-Up"
                sublabel={suggestedFollowUpDate
                  ? `Ada suggests ${new Date(suggestedFollowUpDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                  : "Send calendar invite (.ics)"}
                onClick={() => setShowScheduleModal(true)}
              />
              <QuickAction
                icon={<CheckCircle className="w-4 h-4" />}
                label="Draft Approval Letter"
                sublabel="Generate approval letter via Ada"
                onClick={() => {
                  /* Ada can draft this via agent panel */
                }}
                accent="#166534"
                accentBg="#F0FDF4"
              />
              <QuickAction
                icon={<XCircle className="w-4 h-4" />}
                label="Draft Denial Letter"
                sublabel="Includes undue hardship + ADA leave notice"
                onClick={() => {
                  /* Ada can draft this via agent panel */
                }}
                accent="#991B1B"
                accentBg="#FEF2F2"
              />
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground shrink-0 mt-0.5">{icon}</span>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

function QuickAction({
  icon,
  label,
  sublabel,
  onClick,
  accent = "#5B21B6",
  accentBg = "#F5F3FF",
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  onClick: () => void;
  accent?: string;
  accentBg?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 p-3 rounded-xl border text-left w-full transition-colors hover:opacity-90"
      style={{ borderColor: "#DDD6FE", background: accentBg }}
    >
      <span style={{ color: accent }}>{icon}</span>
      <div>
        <p className="text-sm font-medium" style={{ color: accent }}>{label}</p>
        {sublabel && <p className="text-xs text-muted-foreground">{sublabel}</p>}
      </div>
    </button>
  );
}
