import React from "react";
import { cn } from "@/lib/utils";
import { LeaveState } from "@workspace/api-client-react";

interface StatusBadgeProps {
  state: LeaveState;
  className?: string;
}

export function StatusBadge({ state, className }: StatusBadgeProps) {
  const styles: Record<LeaveState, string> = {
    [LeaveState.INTAKE]: "bg-stone-100 text-stone-600 border-stone-200",
    [LeaveState.ELIGIBILITY_ANALYSIS]: "bg-amber-100 text-amber-800 border-amber-200",
    [LeaveState.HR_REVIEW_QUEUE]: "bg-amber-100 text-amber-800 border-amber-200",
    [LeaveState.NOTICE_DRAFTED]: "bg-orange-100 text-orange-700 border-orange-200",
    [LeaveState.CLOSED]: "bg-stone-100 text-stone-500 border-stone-200",
    [LeaveState.CANCELLED]: "bg-red-100 text-red-800 border-red-200",
  };

  const labels: Record<LeaveState, string> = {
    [LeaveState.INTAKE]: "Intake",
    [LeaveState.ELIGIBILITY_ANALYSIS]: "In Analysis",
    [LeaveState.HR_REVIEW_QUEUE]: "Pending HR Review",
    [LeaveState.NOTICE_DRAFTED]: "Notice Drafted",
    [LeaveState.CLOSED]: "Closed",
    [LeaveState.CANCELLED]: "Cancelled",
  };

  return (
    <span className={cn("px-2.5 py-1 text-xs font-semibold rounded-full border shadow-sm flex items-center whitespace-nowrap w-fit", styles[state], className)}>
      {labels[state] || state}
    </span>
  );
}

const DISPLAY_STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  "Case Received":                        { bg: "#F3F4F6", text: "#374151", border: "#D1D5DB" },
  "In Review":                            { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE" },
  "Reviewed - Eligible":                  { bg: "#F0FDF4", text: "#15803D", border: "#BBF7D0" },
  "Reviewed - Ineligible":                { bg: "#FFF7ED", text: "#C2410C", border: "#FED7AA" },
  "Pending Additional Review":            { bg: "#FFFBEB", text: "#B45309", border: "#FDE68A" },
  "Notices Drafted - Documentation Pending": { bg: "#F5F3FF", text: "#7C3AED", border: "#DDD6FE" },
  "Approved":                             { bg: "#F0FDF4", text: "#166534", border: "#86EFAC" },
  "Denied":                               { bg: "#FEF2F2", text: "#991B1B", border: "#FECACA" },
  "Documentation Received":               { bg: "#ECFDF5", text: "#065F46", border: "#6EE7B7" },
  "Closed":                               { bg: "#F9FAFB", text: "#4B5563", border: "#E5E7EB" },
  "Cancelled":                            { bg: "#FEF2F2", text: "#991B1B", border: "#FECACA" },
};

const STATE_FALLBACK_LABELS: Partial<Record<LeaveState, string>> = {
  [LeaveState.INTAKE]: "Case Received",
  [LeaveState.ELIGIBILITY_ANALYSIS]: "In Review",
  [LeaveState.HR_REVIEW_QUEUE]: "Pending Additional Review",
  [LeaveState.NOTICE_DRAFTED]: "Notices Drafted - Documentation Pending",
  [LeaveState.CLOSED]: "Closed",
  [LeaveState.CANCELLED]: "Cancelled",
};

export function DisplayStatusBadge({
  displayStatus,
  state,
  className,
}: {
  displayStatus?: string | null;
  state?: LeaveState;
  className?: string;
}) {
  const label = displayStatus || (state ? STATE_FALLBACK_LABELS[state] : null);
  if (!label) return null;
  const style = DISPLAY_STATUS_STYLES[label] ?? { bg: "#F3F4F6", text: "#374151", border: "#D1D5DB" };
  return (
    <span
      className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap", className)}
      style={{ background: style.bg, color: style.text, borderColor: style.border }}
    >
      {label}
    </span>
  );
}

export const LEAVE_REASON_LABELS: Record<string, string> = {
  own_health: "Employee's Own Care",
  care_family: "Care for a Family Member",
  pregnancy_disability: "Pregnancy Disability",
  bonding: "Bonding with a New Child",
  military: "Military",
  personal: "Personal",
  bereavement: "Bereavement",
  jury_duty: "Jury Duty",
  other: "Other",
};

export function ReasonBadge({ reason, className }: { reason: string; className?: string }) {
  const label = LEAVE_REASON_LABELS[reason] ?? reason.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  return (
    <span className={cn("px-2.5 py-1 text-xs font-medium rounded-md bg-slate-100 text-slate-700 border border-slate-200 flex items-center w-fit", className)}>
      {label}
    </span>
  );
}
