import { differenceInMonths, differenceInDays, parseISO, subMonths } from "date-fns";

export interface EligibilityInput {
  leaveStartDate: Date;
  requestedStart: string;
  requestedEnd?: string | null;
  leaveReasonCategory: string;
  avgHoursPerWeek: number;
  employeeHireDate: string;
  employeeCount: number;
  intermittent: boolean;
  /** Number of personal leave cases this employee has in the rolling 12 months (excluding current case) */
  priorPersonalLeavesThisYear?: number;
}

export interface ProgramEligibility {
  program: "CFRA" | "FMLA" | "PDL" | "PERSONAL";
  eligible: boolean;
  entitlementWeeks?: number | null;
  reason: string;
}

export interface AnalysisResult {
  eligiblePrograms: ProgramEligibility[];
  summary: string;
  requiresHrReview: boolean;
  reviewReason?: string | null;
  confidenceScore: number;
  analyzedAt: string;
  avgHoursPerWeek: number;
  lookbackMonths: number;
}

const CONFIDENCE_THRESHOLD = 0.85;

export function analyzeEligibility(input: EligibilityInput): AnalysisResult {
  const leaveStart =
    typeof input.leaveStartDate === "string"
      ? parseISO(input.leaveStartDate as string)
      : input.leaveStartDate;

  // Use today as the reference date for the lookback window (not the requested start date)
  const referenceDate = new Date();

  const hireDate = parseISO(input.employeeHireDate);
  const lookbackMonths = 12;

  const monthsEmployed = differenceInMonths(referenceDate, hireDate);
  const hoursInPast12Months = input.avgHoursPerWeek * 52;

  const programs: ProgramEligibility[] = [];
  let requiresHrReview = false;
  let reviewReason: string | null = null;
  let confidence = 1.0;

  const isPersonalLeaveReason = input.leaveReasonCategory === "personal";
  const isPDLReason = input.leaveReasonCategory === "pregnancy_disability";

  const isCFRAEligibleReason = [
    "own_health",
    "care_family",
    "bonding",
    "military",
  ].includes(input.leaveReasonCategory);

  const isFMLAEligibleReason = [
    "own_health",
    "care_family",
    "bonding",
    "pregnancy_disability",
    "military",
  ].includes(input.leaveReasonCategory);

  // ── CFRA ──────────────────────────────────────────────────────────────────
  const cfraEmployerThreshold = 5;
  const cfraMonthsRequired = 12;
  const cfraHoursRequired = 1250;

  if (!isCFRAEligibleReason) {
    programs.push({
      program: "CFRA",
      eligible: false,
      reason: `Leave reason '${input.leaveReasonCategory}' is not covered by CFRA.`,
    });
  } else if (input.employeeCount < cfraEmployerThreshold) {
    programs.push({
      program: "CFRA",
      eligible: false,
      reason: `Employer has fewer than ${cfraEmployerThreshold} employees — CFRA does not apply.`,
    });
  } else if (monthsEmployed < cfraMonthsRequired) {
    programs.push({
      program: "CFRA",
      eligible: false,
      reason: `Employee has ${monthsEmployed} months of tenure; CFRA requires at least 12 months.`,
    });
  } else if (hoursInPast12Months < cfraHoursRequired) {
    const hoursNeeded = cfraHoursRequired - hoursInPast12Months;
    if (hoursNeeded <= 100) {
      confidence = Math.min(confidence, 0.78);
      requiresHrReview = true;
      reviewReason = `Hours worked (${Math.round(hoursInPast12Months)}) are close to but below the 1,250-hour CFRA threshold. Manual timecard review recommended.`;
    }
    programs.push({
      program: "CFRA",
      eligible: false,
      reason: `Employee worked approximately ${Math.round(hoursInPast12Months)} hours in the past 12 months; CFRA requires at least 1,250 hours.`,
    });
  } else {
    programs.push({
      program: "CFRA",
      eligible: true,
      entitlementWeeks: 12,
      reason: `Employee meets all CFRA eligibility requirements (tenure: ${monthsEmployed} months, hours: ~${Math.round(hoursInPast12Months)}).`,
    });
  }

  // ── FMLA ──────────────────────────────────────────────────────────────────
  const fmlaEmployerThreshold = 50;
  const fmlaMonthsRequired = 12;
  const fmlaHoursRequired = 1250;

  if (!isFMLAEligibleReason) {
    programs.push({
      program: "FMLA",
      eligible: false,
      reason: `Leave reason '${input.leaveReasonCategory}' is not covered by FMLA.`,
    });
  } else if (input.employeeCount < fmlaEmployerThreshold) {
    programs.push({
      program: "FMLA",
      eligible: false,
      reason: `Employer has fewer than ${fmlaEmployerThreshold} employees — FMLA does not apply.`,
    });
  } else if (monthsEmployed < fmlaMonthsRequired) {
    programs.push({
      program: "FMLA",
      eligible: false,
      reason: `Employee has ${monthsEmployed} months of tenure; FMLA requires at least 12 months.`,
    });
  } else if (hoursInPast12Months < fmlaHoursRequired) {
    programs.push({
      program: "FMLA",
      eligible: false,
      reason: `Employee worked approximately ${Math.round(hoursInPast12Months)} hours in the past 12 months; FMLA requires at least 1,250 hours.`,
    });
  } else {
    programs.push({
      program: "FMLA",
      eligible: true,
      entitlementWeeks: 12,
      reason: `Employee meets all FMLA eligibility requirements (tenure: ${monthsEmployed} months, hours: ~${Math.round(hoursInPast12Months)}).`,
    });
  }

  // ── PDL ───────────────────────────────────────────────────────────────────
  if (!isPDLReason) {
    programs.push({
      program: "PDL",
      eligible: false,
      reason: `PDL applies only to pregnancy disability leave.`,
    });
  } else if (input.employeeCount < 5) {
    programs.push({
      program: "PDL",
      eligible: false,
      reason: `Employer has fewer than 5 employees — PDL does not apply.`,
    });
  } else {
    programs.push({
      program: "PDL",
      eligible: true,
      entitlementWeeks: 17.33,
      reason: `Employee is eligible for PDL (pregnancy disability). Up to 17⅓ weeks of job-protected leave available.`,
    });
  }

  // ── Company Personal Leave ─────────────────────────────────────────────────
  // Rules: up to 30 calendar days, unpaid, limited to 1 per rolling 12-month period.
  const priorPersonal = input.priorPersonalLeavesThisYear ?? 0;

  if (isPersonalLeaveReason) {
    if (priorPersonal >= 1) {
      programs.push({
        program: "PERSONAL",
        eligible: false,
        reason: `Employee has already used Company Personal Leave within the past 12 months. Only 1 personal leave per rolling 12-month period is permitted.`,
      });
      requiresHrReview = true;
      reviewReason =
        reviewReason ??
        `Employee has a prior Company Personal Leave in the rolling 12-month window. HR must confirm eligibility before proceeding.`;
      confidence = Math.min(confidence, 0.9);
    } else {
      programs.push({
        program: "PERSONAL",
        eligible: true,
        entitlementWeeks: 30 / 7,
        reason: `Employee is eligible for Company Personal Leave. Up to 30 calendar days of unpaid leave available (1 per rolling 12-month period).`,
      });
    }
  } else {
    // Show personal leave as not applicable for non-personal reasons
    programs.push({
      program: "PERSONAL",
      eligible: false,
      reason: `Company Personal Leave was not requested. If needed, employees may request up to 30 days unpaid (once per 12-month period).`,
    });
  }

  // ── Determine overall HR review need ──────────────────────────────────────
  if (!requiresHrReview) {
    const noEligiblePrograms = programs.every((p) => !p.eligible);
    if (noEligiblePrograms) {
      requiresHrReview = true;
      reviewReason =
        "No statutory or company leave program eligibility found. HR review required before any action.";
      confidence = Math.min(confidence, 0.9);
    }
  }

  // ── Build narrative summary ────────────────────────────────────────────────
  const eligibleList = programs
    .filter((p) => p.eligible)
    .map((p) => p.program)
    .join(", ");

  const personalNote =
    isPersonalLeaveReason && priorPersonal === 0
      ? " Note: Company Personal Leave is unpaid."
      : "";

  const referenceDateStr = `${String(referenceDate.getMonth() + 1).padStart(2, "0")}/${String(referenceDate.getDate()).padStart(2, "0")}/${referenceDate.getFullYear()}`;

  const summary = eligibleList
    ? `Based on a rolling 12-month lookback from ${referenceDateStr}, the employee appears eligible for: ${eligibleList}.${personalNote} ${requiresHrReview ? "HR review is required before a final determination." : "HR review of this case is recommended before issuing any notice."}`
    : `Based on a rolling 12-month lookback from ${referenceDateStr}, the employee does not appear to meet eligibility thresholds for the requested leave type. HR review is required before any action.`;

  return {
    eligiblePrograms: programs,
    summary,
    requiresHrReview,
    reviewReason,
    confidenceScore: confidence,
    analyzedAt: new Date().toISOString(),
    avgHoursPerWeek: input.avgHoursPerWeek,
    lookbackMonths,
  };
}

export function getEventTransition(event: string): string | null {
  const eventMap: Record<string, string> = {
    ANALYZE: "ELIGIBILITY_ANALYSIS",
    ROUTE_HR_REVIEW: "HR_REVIEW_QUEUE",
    DRAFT_NOTICE: "NOTICE_DRAFTED",
    HR_DECISION_RECORDED: "NOTICE_DRAFTED",
    REQUEST_MORE_INFO: "INTAKE",
    CANCEL: "CANCELLED",
    CLOSE: "CLOSED",
  };
  return eventMap[event] ?? null;
}
