import { anthropic } from "./anthropic";
import { logger } from "./logger";
import type { AnalysisResult } from "./eligibility";
import { retrieveRelevantChunks } from "./rag";
import { db, orgLocationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export type AiAction = "APPROVE" | "DENY" | "REQUEST_MORE_INFO";

export interface AiRecommendation {
  action: AiAction;
  reasoning: string;
  confidenceScore: number;
  keyFactors: string[];
}

export interface AiNoticeDraft {
  noticeType: string;
  title: string;
  content: string;
}

export interface AiRecommendationResult {
  recommendation: AiRecommendation;
  notices: AiNoticeDraft[];
}

interface CaseContext {
  caseNumber: string;
  employeeNumber: string;
  employeeEmail?: string | null;
  leaveReasonCategory: string;
  requestedStart: string;
  requestedEnd?: string | null;
  intermittent: boolean;
  analysisResult: AnalysisResult;
  organizationId?: string | null;
}

const REASON_LABELS: Record<string, string> = {
  own_health: "Employee's own serious health condition",
  care_family: "Care for a seriously ill family member",
  pregnancy_disability: "Pregnancy disability",
  bonding: "Bonding with a new child",
  military: "Military family leave",
  personal: "Company personal leave (unpaid, up to 30 days)",
};

// Always draft these two notices — the Designation Notice carries the approval/denial decision
const REQUIRED_NOTICE_TYPES = ["ELIGIBILITY_NOTICE", "DESIGNATION_NOTICE"];

const NOTICE_TITLES: Record<string, string> = {
  ELIGIBILITY_NOTICE: "Notice of Eligibility & Rights",
  DESIGNATION_NOTICE: "Leave Designation Notice",
};

// States with additional leave law requirements beyond federal FMLA
const STATE_NOTICE_REQUIREMENTS: Record<string, string> = {
  CA: `
CALIFORNIA-SPECIFIC NOTICE REQUIREMENTS (apply in addition to federal FMLA):

CFRA (California Family Rights Act, Gov. Code § 12945.2):
- Covers employers with 5+ employees (lower threshold than FMLA's 50)
- 12 weeks job-protected leave per calendar year
- Pregnancy disability is NOT a CFRA qualifying reason (covered by PDL separately)
- After PDL, employee is entitled to 12 weeks CFRA bonding leave (these stack, they do not run concurrently for pregnancy)
- Available for: own serious health condition, care for family member (spouse, child, parent, grandparent, grandchild, sibling, domestic partner), bonding, qualifying military exigency

PDL (Pregnancy Disability Leave, Gov. Code § 12945):
- Up to 4 months (17⅓ weeks) for disability related to pregnancy/childbirth
- No minimum tenure or hours-worked requirement
- Runs concurrently with federal FMLA (FMLA portion capped at 12 weeks); CFRA bonding runs separately after
- Notify employee of right to California State Disability Insurance (SDI) via EDD for wage replacement during PDL

California Paid Family Leave (PFL, UI Code § 3300):
- Up to 8 weeks of partial wage replacement (~60–70% of wages) via EDD
- Available during CFRA bonding, family care leave
- Employer may require up to 2 weeks of accrued vacation before PFL for bonding
- Notify employee of PFL availability in the designation notice

CALIFORNIA NOTICE TIMING:
- Notice of Eligibility: within 5 business days of knowing leave may be needed
- Designation Notice: within 5 business days of having sufficient information to designate

CALIFORNIA NOTICE CONTENT — ELIGIBILITY NOTICE must include:
1. FMLA/CFRA eligibility status (separately for each)
2. If ineligible: specific reason(s) under each law
3. Whether PDL applies (if pregnancy-related)
4. Qualifying reason for leave
5. Maximum leave entitlement under each applicable law
6. Right to concurrent California Paid Family Leave (PFL)
7. Whether certification is required
8. Whether employer requires substitution of accrued paid leave

CALIFORNIA NOTICE CONTENT — DESIGNATION NOTICE must include:
1. Whether leave is designated as FMLA, CFRA, PDL, or any combination
2. Amount of leave being designated under each law
3. Whether the leave is approved, conditionally approved (pending certification), or denied
4. If denied: specific reason under each law
5. Fitness-for-duty requirement (if any) upon return
6. For intermittent leave: approved frequency and duration
7. Notification of PFL/SDI benefit availability through EDD
`,
  WA: `
WASHINGTON STATE REQUIREMENTS (in addition to federal FMLA):
- Washington PFML (Paid Family and Medical Leave): notify employees of up to 12 weeks (18 for pregnancy + bonding) of paid leave through WA ESD
- Employee premium deductions fund the program; employer contributes if 50+ employees
- Notify employee to apply at https://paidleave.wa.gov
`,
  OR: `
OREGON REQUIREMENTS (in addition to federal FMLA):
- Oregon Paid Leave (Measure 112): up to 12 weeks paid leave (14 for pregnancy + bonding) through Frances Online
- Covers own serious health condition, family care, bonding, safe leave
- Notify employee to apply through Frances Online (oregon.gov/employ/PFMLI)
`,
  NY: `
NEW YORK REQUIREMENTS (in addition to federal FMLA):
- NY Paid Family Leave (PFL): up to 12 weeks of job-protected, partially paid leave
- Funded by employee payroll deductions
- Covers bonding, family care, qualifying military exigency
- Notify employee to submit PFL claim to employer's disability/PFL carrier
`,
  CO: `
COLORADO REQUIREMENTS (in addition to federal FMLA):
- FAMLI (Family and Medical Leave Insurance): up to 12 weeks paid leave (16 for pregnancy complications + bonding)
- Employee and employer (50+ employees) contribute premiums
- Notify employee to apply at famli.colorado.gov
`,
};

async function getOrgStates(organizationId: string | null): Promise<string[]> {
  if (!organizationId) return [];
  try {
    const locations = await db
      .select({ state: orgLocationsTable.state })
      .from(orgLocationsTable)
      .where(eq(orgLocationsTable.organizationId, organizationId));
    // Return unique uppercase state codes
    return [...new Set(locations.map((l) => l.state.toUpperCase()))];
  } catch (err) {
    logger.warn({ err, organizationId }, "Could not fetch org locations for AI notice — proceeding with federal only");
    return [];
  }
}

function buildStateGuidance(states: string[]): string {
  const applicable = states.filter((s) => STATE_NOTICE_REQUIREMENTS[s]);
  if (applicable.length === 0) return "";
  return applicable.map((s) => STATE_NOTICE_REQUIREMENTS[s]).join("\n\n");
}

function buildSystemPrompt(hasRagContext: boolean, hasStateRequirements: boolean): string {
  return `You are an expert HR leave administration specialist and employment law paralegal with deep expertise in federal FMLA and state leave laws.

Your role is to assist HR professionals with legally compliant leave administration. You draft two required notices for every leave case:

1. NOTICE OF ELIGIBILITY & RIGHTS — equivalent to FMLA Form WH-381. Must be provided to the employee within 5 business days of learning leave may be needed.

2. LEAVE DESIGNATION NOTICE — equivalent to FMLA Form WH-382. Must be provided within 5 business days of having sufficient information to designate leave. This notice conveys the final decision (approved, conditionally approved pending certification, or denied).

The Designation Notice replaces any separate approval or denial letter — it is the official document communicating the leave decision.

When drafting notices:
1. ${hasRagContext ? "Ground your language in the REGULATORY CONTEXT provided — cite specific provisions" : "Apply current knowledge of FMLA, CFRA, PDL, and applicable state leave laws"}
2. ${hasStateRequirements ? "Include all applicable state-specific disclosures per the STATE REQUIREMENTS section" : "Apply federal FMLA requirements"}
3. Be specific about entitlement amounts, timelines, certification deadlines, and benefit rights
4. Use professional, clear language suitable for direct delivery to the employee
5. Include all legally required elements — a missing element can create employer liability
6. Use [EMPLOYER NAME], [DATE], [HR REPRESENTATIVE NAME], [HR PHONE/EMAIL] as placeholders where employer-specific info is needed

Respond ONLY with a valid JSON object. Do not include markdown, code blocks, or any text outside the JSON.`;
}

function buildEligibilityNoticeRequirements(ctx: CaseContext, states: string[]): string {
  const hasCA = states.includes("CA");
  return `
NOTICE OF ELIGIBILITY & RIGHTS — REQUIRED ELEMENTS:

Federal FMLA (29 CFR § 825.300(b)) — must include ALL of the following:
1. Whether the employee is eligible for FMLA leave (Yes/No)
   - If NOT eligible: state the specific reason(s):
     a. Has not been employed for 12 months
     b. Has not worked 1,250 hours in the past 12 months
     c. Worksite has fewer than 50 employees within 75 miles
2. The qualifying reason(s) for the leave request
3. The amount of FMLA leave entitlement remaining in the 12-month period
4. Whether medical certification or other documentation is required (and deadline — typically 15 calendar days)
5. Whether the employer will require the employee to substitute accrued paid leave, and which types (vacation, sick, PTO)
6. Whether the employer requires the employee to report periodically on their leave status
7. Key employee notification (if applicable — top 10% of salaried employees)
8. The employee's right to have group health benefits maintained during FMLA leave on the same terms as if they had continued working
9. The employee's right to be restored to the same or an equivalent position upon return from FMLA leave
10. The employee's potential liability for health insurance premiums paid during leave if they fail to return

${hasCA ? `
California CFRA/PDL additions (must appear in the same notice or as an addendum):
1. CFRA eligibility status (5+ employees, 12 months employment, 1,250 hours) — separately from FMLA eligibility
2. If the leave reason is pregnancy: notify of PDL entitlement (up to 4 months, no tenure/hours requirement)
3. That PDL and CFRA do NOT run concurrently — PDL first, then CFRA bonding (for pregnancy/childbirth)
4. Right to California Paid Family Leave (PFL) through EDD for wage replacement during bonding/care leave
5. Right to California SDI (State Disability Insurance) through EDD during own health/pregnancy leave
6. That CFRA leave is unpaid but PFL/SDI may provide partial wage replacement
` : ""}`;
}

function buildDesignationNoticeRequirements(ctx: CaseContext, states: string[]): string {
  const hasCA = states.includes("CA");
  return `
LEAVE DESIGNATION NOTICE — REQUIRED ELEMENTS:

Federal FMLA (29 CFR § 825.300(d)) — must include ALL of the following based on action:

FOR ALL DECISIONS:
1. Whether the leave IS designated as FMLA-qualifying
2. If designated: the amount of time being approved (specific dates or expected duration)
3. Whether the leave is paid, unpaid, or a combination
4. If certification is still outstanding: provide 15-day deadline and consequences of non-submission
5. Whether a fitness-for-duty certification will be required before the employee returns to work

IF APPROVED:
6. Confirmation that leave is approved as FMLA-qualifying (and CFRA-qualifying if CA)
7. The specific entitlement being approved (weeks, intermittent frequency/duration)
8. Any conditions on the leave (check-ins, reduced schedule parameters, etc.)
9. Confirmation of health benefit continuation during leave

IF CONDITIONALLY APPROVED (REQUEST_MORE_INFO):
6. That leave designation is pending receipt of complete medical certification
7. The 15-calendar-day deadline to submit certification
8. Specific information still required
9. Consequences of failure to provide (leave may not be FMLA-protected)

IF DENIED:
6. The specific legal reason for denial under FMLA (and CFRA/PDL separately if CA)
7. Any applicable appeal or reconsideration rights

${hasCA ? `
California Designation Notice additions:
1. Designation under CFRA (if different from FMLA designation — e.g., pregnancy leaves)
2. Designation under PDL (if pregnancy/childbirth related)
3. Whether PFL benefits through EDD are available during the designated leave period and how to apply
4. For PDL: whether SDI benefits through EDD are available and how to apply
5. That the employee should contact EDD at edd.ca.gov or 1-800-480-3287 for PFL/SDI claims
` : ""}`;
}

function buildUserPrompt(ctx: CaseContext, ragChunks: string[], states: string[]): string {
  const { analysisResult } = ctx;
  const stateGuidance = buildStateGuidance(states);
  const hasStateRequirements = stateGuidance.length > 0;

  const eligiblePrograms = analysisResult.eligiblePrograms
    .map(
      (p) =>
        `- ${p.program}: ${p.eligible ? "ELIGIBLE" : "NOT ELIGIBLE"} — ${p.reason}${p.entitlementWeeks ? ` (${p.entitlementWeeks} weeks)` : ""}`,
    )
    .join("\n");

  const ragSection = ragChunks.length > 0
    ? `\nRELEVANT REGULATORY & POLICY CONTEXT:\n${ragChunks.map((c, i) => `[${i + 1}] ${c}`).join("\n\n")}\n`
    : "";

  const stateSection = hasStateRequirements
    ? `\nSTATE REQUIREMENTS FOR THIS ORGANIZATION (${states.join(", ")}):\n${stateGuidance}\n`
    : "";

  const eligibilityReqs = buildEligibilityNoticeRequirements(ctx, states);
  const designationReqs = buildDesignationNoticeRequirements(ctx, states);

  return `Analyze the following leave case and draft the two required notices.
${ragSection}${stateSection}
CASE INFORMATION:
- Case Number: ${ctx.caseNumber}
- Employee Number: ${ctx.employeeNumber}
- Leave Reason: ${REASON_LABELS[ctx.leaveReasonCategory] ?? ctx.leaveReasonCategory}
- Requested Start: ${ctx.requestedStart}
- Requested End: ${ctx.requestedEnd ?? "Not specified (open-ended)"}
- Intermittent: ${ctx.intermittent ? "Yes" : "No"}
- Organization States: ${states.length > 0 ? states.join(", ") : "Unknown (apply federal FMLA only)"}

ELIGIBILITY ANALYSIS RESULTS:
- Overall Summary: ${analysisResult.summary}
- Requires HR Review: ${analysisResult.requiresHrReview ? "Yes" : "No"}
${analysisResult.reviewReason ? `- Review Reason: ${analysisResult.reviewReason}` : ""}
- Confidence Score: ${(analysisResult.confidenceScore * 100).toFixed(0)}%
- Avg Hours/Week: ${analysisResult.avgHoursPerWeek ?? "Unknown"}
- Lookback Period: ${analysisResult.lookbackMonths} months

PROGRAM ELIGIBILITY:
${eligiblePrograms}

REQUIRED NOTICE CONTENT SPECIFICATIONS:
${eligibilityReqs}
${designationReqs}

INSTRUCTIONS:
Based on all the above, determine the recommended action and draft both required notices. The Designation Notice IS the approval/denial communication — no separate approval or denial letter is needed.

Provide a JSON response with this exact structure:
{
  "recommendation": {
    "action": "APPROVE" | "DENY" | "REQUEST_MORE_INFO",
    "reasoning": "2-4 sentence plain-language explanation referencing specific eligibility findings and legal provisions.",
    "confidenceScore": 0.0-1.0,
    "keyFactors": ["3-5 specific factors that drove this recommendation"]
  },
  "notices": [
    {
      "noticeType": "ELIGIBILITY_NOTICE",
      "title": "Notice of Eligibility & Rights",
      "content": "Full notice text covering ALL required elements listed above for the Eligibility Notice. 300-600 words. Include all applicable federal and state required elements. Use [EMPLOYER NAME], [DATE], [HR REPRESENTATIVE NAME], [HR PHONE/EMAIL] placeholders."
    },
    {
      "noticeType": "DESIGNATION_NOTICE",
      "title": "Leave Designation Notice",
      "content": "Full notice text covering ALL required elements listed above for the Designation Notice, reflecting the recommended action (APPROVE/DENY/REQUEST_MORE_INFO). 300-600 words. This notice conveys the leave decision — no separate approval or denial letter is issued. Use [EMPLOYER NAME], [DATE], [HR REPRESENTATIVE NAME], [HR PHONE/EMAIL] placeholders."
    }
  ]
}

Current date: ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;
}

export async function generateAiRecommendation(
  ctx: CaseContext,
): Promise<AiRecommendationResult> {
  // Fetch the org's states so we can tailor notices to applicable state laws
  const orgStates = await getOrgStates(ctx.organizationId ?? null);

  const ragQuery = `${REASON_LABELS[ctx.leaveReasonCategory] ?? ctx.leaveReasonCategory} leave eligibility ${ctx.analysisResult.summary} ${orgStates.join(" ")}`;
  let ragChunks: string[] = [];
  try {
    ragChunks = await retrieveRelevantChunks(ragQuery, ctx.organizationId ?? null);
    logger.info({ caseNumber: ctx.caseNumber, chunkCount: ragChunks.length, orgStates }, "RAG chunks retrieved");
  } catch (err) {
    logger.warn({ err, caseNumber: ctx.caseNumber }, "RAG retrieval failed — proceeding without context");
  }

  const systemPrompt = buildSystemPrompt(ragChunks.length > 0, buildStateGuidance(orgStates).length > 0);
  const userPrompt = buildUserPrompt(ctx, ragChunks, orgStates);

  logger.info({ caseNumber: ctx.caseNumber, ragEnabled: ragChunks.length > 0, orgStates }, "Generating AI recommendation");

  const stream = anthropic.messages.stream({
    model: "claude-opus-4-6",
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const message = await stream.finalMessage();

  const textBlock = message.content.find((b) => b.type === "text");
  const content = textBlock?.type === "text" ? textBlock.text : null;
  if (!content) {
    throw new Error("No content returned from AI");
  }

  const parsed = JSON.parse(content) as AiRecommendationResult;

  if (!parsed.recommendation || !Array.isArray(parsed.notices)) {
    throw new Error("Invalid AI response structure");
  }

  // Always enforce exactly ELIGIBILITY_NOTICE + DESIGNATION_NOTICE
  const finalNotices: AiNoticeDraft[] = [];
  for (const noticeType of REQUIRED_NOTICE_TYPES) {
    const aiDraft = parsed.notices.find((n) => n.noticeType === noticeType);
    if (aiDraft) {
      finalNotices.push(aiDraft);
    } else {
      finalNotices.push({
        noticeType,
        title: NOTICE_TITLES[noticeType] ?? noticeType,
        content: `[Notice draft for ${noticeType} could not be generated. Please draft manually.]`,
      });
    }
  }

  logger.info(
    {
      caseNumber: ctx.caseNumber,
      action: parsed.recommendation.action,
      noticeCount: finalNotices.length,
      orgStates,
    },
    "AI recommendation generated",
  );

  return {
    recommendation: parsed.recommendation,
    notices: finalNotices,
  };
}
