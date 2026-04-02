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

export const LEAVE_REASON_LABELS: Record<string, string> = {
  own_health: "Employee's Own Care",
  care_family: "Care for a Family Member",
  pregnancy_disability: "Pregnancy Disability",
  bonding: "Bonding with a New Child",
  military: "Military",
  personal: "Personal",
};

export function ReasonBadge({ reason, className }: { reason: string; className?: string }) {
  const label = LEAVE_REASON_LABELS[reason] ?? reason.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  return (
    <span className={cn("px-2.5 py-1 text-xs font-medium rounded-md bg-slate-100 text-slate-700 border border-slate-200 flex items-center w-fit", className)}>
      {label}
    </span>
  );
}
