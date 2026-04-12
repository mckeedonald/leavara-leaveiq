import { anthropic } from "./anthropic";
import { logger } from "./logger";
import type { AnalysisResult } from "./eligibility";
import { retrieveRelevantChunks } from "./rag";
import { db, orgLocationsTable, organizationsTable } from "@workspace/db";
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
  employeeFirstName?: string | null;
  employeeLastName?: string | null;
  employeeEmail?: string | null;
  leaveReasonCategory: string;
  requestedStart: string;
  requestedEnd?: string | null;
  intermittent: boolean;
  analysisResult: AnalysisResult;
  organizationId?: string | null;
  // Auto-fill fields — populated from DB before calling generateAiRecommendation
  senderName?: string | null;
  senderTitle?: string | null;
  senderEmail?: string | null;
}

const REASON_LABELS: Record<string, string> = {
  own_health: "Employee's own serious health condition",
  care_family: "Care for a seriously ill family member",
  pregnancy_disability: "Pregnancy disability",
  bonding: "Bonding with a new child",
  military: "Military family leave",
  personal: "Company personal leave (unpaid, up to 30 days)",
};

// Always draft these three notices — the Designation Notice carries the approval/denial decision
const REQUIRED_NOTICE_TYPES = ["ELIGIBILITY_NOTICE", "DESIGNATION_NOTICE", "MEDICAL_CERTIFICATION"];

const NOTICE_TITLES: Record<string, string> = {
  ELIGIBILITY_NOTICE: "Notice of Eligibility & Rights",
  DESIGNATION_NOTICE: "Leave Designation Notice",
  MEDICAL_CERTIFICATION: "Medical Certification Form",
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

interface OrgInfo {
  name: string;
  states: string[];
}

async function getOrgInfo(organizationId: string | null): Promise<OrgInfo> {
  if (!organizationId) return { name: "", states: [] };
  try {
    const [org] = await db
      .select({ name: organizationsTable.name })
      .from(organizationsTable)
      .where(eq(organizationsTable.id, organizationId))
      .limit(1);

    const locations = await db
      .select({ state: orgLocationsTable.state })
      .from(orgLocationsTable)
      .where(eq(orgLocationsTable.organizationId, organizationId));

    return {
      name: org?.name ?? "",
      states: [...new Set(locations.map((l) => l.state.toUpperCase()))],
    };
  } catch (err) {
    logger.warn({ err, organizationId }, "Could not fetch org info for AI notice — proceeding with federal only");
    return { name: "", states: [] };
  }
}

function buildStateGuidance(states: string[]): string {
  const applicable = states.filter((s) => STATE_NOTICE_REQUIREMENTS[s]);
  if (applicable.length === 0) return "";
  return applicable.map((s) => STATE_NOTICE_REQUIREMENTS[s]).join("\n\n");
}

function buildSystemPrompt(hasRagContext: boolean, hasStateRequirements: boolean): string {
  return `You are an expert HR leave administration specialist and employment law paralegal with deep expertise in federal FMLA and state leave laws.

Your role is to assist HR professionals with legally compliant leave administration. You draft three required documents for every leave case:

1. NOTICE OF ELIGIBILITY & RIGHTS — equivalent to FMLA Form WH-381. Must be provided to the employee within 5 business days of learning leave may be needed.

2. LEAVE DESIGNATION NOTICE — equivalent to FMLA Form WH-382. Must be provided within 5 business days of having sufficient information to designate leave. This notice conveys the final decision (approved, conditionally approved pending certification, or denied).

3. MEDICAL CERTIFICATION FORM — a complete, fillable form the employee takes to their healthcare provider (or completes themselves for bonding/military/personal leave). This is attached to the Eligibility Notice so the employee can begin the certification process immediately.

The Designation Notice replaces any separate approval or denial letter — it is the official document communicating the leave decision.

When drafting notices:
1. ${hasRagContext ? "Ground your language in the REGULATORY CONTEXT provided — cite specific provisions" : "Apply current knowledge of FMLA, CFRA, PDL, and applicable state leave laws"}
2. ${hasStateRequirements ? "Include all applicable state-specific disclosures per the STATE REQUIREMENTS section" : "Apply federal FMLA requirements"}
3. Be specific about entitlement amounts, timelines, certification deadlines, and benefit rights
4. Use professional, clear language suitable for direct delivery to the employee
5. Include all legally required elements — a missing element can create employer liability
6. Use the actual employer name, employee name, HR representative name/title/email, and date provided in the CASE INFORMATION section — do NOT use generic placeholders like [EMPLOYER NAME] or [HR REPRESENTATIVE NAME]

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

function buildMedicalCertRequirements(ctx: CaseContext, states: string[]): string {
  const hasCA = states.includes("CA");
  const hasWA = states.includes("WA");
  const hasOR = states.includes("OR");
  const hasNY = states.includes("NY");
  const hasCO = states.includes("CO");

  const reason = ctx.leaveReasonCategory;

  let formType = "";
  let formInstructions = "";

  if (reason === "own_health") {
    formType = "FMLA WH-380-E — Certification of Health Care Provider for Employee's Serious Health Condition";
    formInstructions = `This form is completed by the employee's treating healthcare provider. It certifies the employee's serious health condition under 29 CFR § 825.306.

Required sections:
1. PATIENT / EMPLOYEE INFORMATION
   - Employee Name: ___________________________________________
   - Date of Birth: ____________________________________________
   - Patient's Date of Admission (if hospitalized): _______________

2. HEALTHCARE PROVIDER INFORMATION
   - Provider Name: ___________________________________________
   - License Number: __________________________________________
   - Medical Specialty / Type of Practice: _______________________
   - Practice / Clinic Name: _____________________________________
   - Address: _________________________________________________
   - City, State, ZIP: __________________________________________
   - Phone: __________________________________________________
   - Fax: ____________________________________________________

3. DESCRIPTION OF MEDICAL CONDITION
   a. Approximate date condition commenced: ____________________
   b. Probable duration of condition: ___________________________
   c. Briefly describe the medical facts, including symptoms, diagnosis, and any regimen of continuing treatment (do not provide information that is not directly relevant to the employee's need for leave):
      ________________________________________________________
      ________________________________________________________
      ________________________________________________________

4. INCAPACITY AND TREATMENT
   a. Was / will the patient be incapacitated for a single continuous period due to the medical condition?
      [ ] Yes   [ ] No
      If Yes — Beginning date: ______________  End date: _________
   b. Will the patient need to attend follow-up treatment appointments or work part-time due to the condition?
      [ ] Yes   [ ] No
      If Yes, please describe the schedule of treatment or part-time schedule: ________________________
   c. Will the condition cause episodic flare-ups periodically preventing the employee from performing job functions?
      [ ] Yes   [ ] No
      If Yes — Estimated frequency of flare-ups: [ ] 1–2 per week  [ ] 3–4 per week  [ ] 1–3 per month  [ ] Other: _______
      Estimated duration of each flare-up: [ ] Hours  [ ] 1–2 days  [ ] 3–5 days  [ ] Other: __________

5. MEDICAL NECESSITY STATEMENT
   Is the employee's leave medically necessary?   [ ] Yes   [ ] No
   Brief statement of medical necessity: _______________________
   ________________________________________________________

6. PROGNOSIS / EXPECTED DURATION
   Expected return to full duty: _______________________________
   Any permanent limitations or restrictions: [ ] None  [ ] Yes — describe: _________________________

7. HEALTHCARE PROVIDER CERTIFICATION
   I certify that the above information is true and correct to the best of my knowledge. I understand that this form is subject to audit by the U.S. Department of Labor.

   Provider Signature: ________________________  Date: _________
   Printed Name: _____________________________________________`;
  } else if (reason === "care_family") {
    formType = "FMLA WH-380-F — Certification of Health Care Provider for Family Member's Serious Health Condition";
    formInstructions = `This form is completed by the treating healthcare provider of the employee's seriously ill family member. It certifies the family member's serious health condition under 29 CFR § 825.306.

Required sections:
1. PATIENT (FAMILY MEMBER) INFORMATION
   - Patient Name: ____________________________________________
   - Date of Birth: ____________________________________________
   - Relationship to Employee: [ ] Spouse  [ ] Child  [ ] Parent  [ ] Next of Kin  [ ] Other: __________
   - Employee Name: ___________________________________________

2. HEALTHCARE PROVIDER INFORMATION
   - Provider Name: ___________________________________________
   - License Number: __________________________________________
   - Medical Specialty / Type of Practice: _______________________
   - Practice / Clinic Name: _____________________________________
   - Address: _________________________________________________
   - City, State, ZIP: __________________________________________
   - Phone: __________________________________________________
   - Fax: ____________________________________________________

3. DESCRIPTION OF FAMILY MEMBER'S MEDICAL CONDITION
   a. Approximate date condition commenced: ____________________
   b. Probable duration of condition: ___________________________
   c. Briefly describe the medical facts, including symptoms, diagnosis, and any regimen of continuing treatment:
      ________________________________________________________
      ________________________________________________________

4. CARE REQUIREMENT
   a. Will the family member need care for a single continuous period?   [ ] Yes   [ ] No
      Beginning date: ________________  Estimated end date: _____
   b. Will the family member require intermittent care or a reduced schedule?   [ ] Yes   [ ] No
      Estimated frequency: _____________________________________
      Estimated duration per episode: ____________________________
   c. Describe the type of care the employee is needed to provide (e.g., physical care, psychological comfort, transportation, arranging third-party care): ____________________________________
      ________________________________________________________

5. MEDICAL NECESSITY STATEMENT
   Is the employee's presence medically necessary?   [ ] Yes   [ ] No
   Statement of necessity: ____________________________________
   ________________________________________________________

6. PROGNOSIS / EXPECTED DURATION
   Expected duration of care need: _____________________________

7. HEALTHCARE PROVIDER CERTIFICATION
   Provider Signature: ________________________  Date: _________
   Printed Name: _____________________________________________`;
  } else if (reason === "pregnancy_disability") {
    formType = hasCA
      ? "FMLA WH-380-E combined with California PDL Medical Certification"
      : "FMLA WH-380-E — Certification for Pregnancy-Related Serious Health Condition";
    formInstructions = `This form is completed by the employee's obstetric care provider or treating physician. It certifies the employee's pregnancy-related serious health condition.

Required sections:
1. PATIENT / EMPLOYEE INFORMATION
   - Employee Name: ___________________________________________
   - Date of Birth: ____________________________________________
   - Expected Due Date: ________________________________________

2. HEALTHCARE PROVIDER INFORMATION
   - Provider Name: ___________________________________________
   - License Number: __________________________________________
   - Specialty (OB/GYN, Maternal-Fetal Medicine, etc.): ____________
   - Practice / Clinic Name: _____________________________________
   - Address: _________________________________________________
   - City, State, ZIP: __________________________________________
   - Phone: __________________________________________________

3. DESCRIPTION OF PREGNANCY-RELATED CONDITION
   a. Diagnosis or condition (e.g., hyperemesis gravidarum, gestational hypertension, pregnancy-induced disability):
      ________________________________________________________
   b. Date condition commenced or is expected to commence: _______
   c. Expected delivery date: ____________________________________
   d. Expected duration of disability (before and after delivery):
      Pre-delivery: ____________________________________________
      Post-delivery (recovery): __________________________________

4. INCAPACITY
   a. Is the employee currently incapacitated?   [ ] Yes   [ ] No
   b. Is the employee able to perform any work?   [ ] Yes   [ ] No
   c. If partially able, describe limitations: ______________________

5. MEDICAL NECESSITY STATEMENT
   Is leave medically necessary?   [ ] Yes   [ ] No
   Describe medical necessity: _________________________________

6. PROGNOSIS
   Expected date of full recovery: _______________________________
   Anticipated restrictions upon return: [ ] None  [ ] Light duty  [ ] Modified schedule  [ ] Other: _______

${hasCA ? `7. CALIFORNIA PDL / SDI SECTION (California Employees Only)
   Is this leave qualifying for California Pregnancy Disability Leave (PDL)?   [ ] Yes   [ ] No
   Estimated PDL duration: _____________________________________
   Is the patient expected to be eligible for California SDI benefits?   [ ] Yes   [ ] No
   EDD Claim Number (if known): ________________________________
   Note: Employees may contact EDD at edd.ca.gov or 1-800-480-3287 to file an SDI claim.

8. HEALTHCARE PROVIDER CERTIFICATION` : "7. HEALTHCARE PROVIDER CERTIFICATION"}
   Provider Signature: ________________________  Date: _________
   Printed Name: _____________________________________________`;
  } else if (reason === "bonding") {
    formType = "Bonding Leave — Birth / Adoption / Foster Placement Confirmation";
    formInstructions = `This form does not require a medical provider. It is completed by the employee and supported by official documentation confirming the qualifying event.

Required sections:
1. EMPLOYEE INFORMATION
   - Employee Name: ___________________________________________
   - Employee Number: _________________________________________
   - Department: ______________________________________________

2. QUALIFYING EVENT
   Please check the applicable event:
   [ ] Birth of a child
   [ ] Adoption of a child
   [ ] Foster care placement of a child

   Child's Name (if known): ____________________________________
   Date of Birth / Placement: ___________________________________

3. SUPPORTING DOCUMENTATION (attach one of the following)
   [ ] Birth certificate or hospital birth record
   [ ] Adoption decree or court order
   [ ] Foster placement agreement from authorized agency
   [ ] Letter from licensed adoption or foster agency
   [ ] Other official documentation: ____________________________

4. REQUESTED LEAVE DATES
   Bonding Leave Start Date: ___________________________________
   Bonding Leave End Date: ____________________________________
   [ ] Continuous leave   [ ] Intermittent leave

5. EMPLOYEE CERTIFICATION
   I certify that the information above is accurate and that I will provide the required supporting documentation. I understand that falsification of this form may result in disciplinary action.

   Employee Signature: ______________________  Date: ___________`;
  } else if (reason === "military") {
    formType = "FMLA WH-384 — Certification of Qualifying Exigency for Military Family Leave";
    formInstructions = `This form is completed by the employee to document the qualifying military exigency under 29 CFR § 825.309.

Required sections:
1. EMPLOYEE INFORMATION
   - Employee Name: ___________________________________________
   - Employee Number: _________________________________________

2. MILITARY MEMBER INFORMATION
   - Name of Military Member: __________________________________
   - Relationship to Employee: [ ] Spouse  [ ] Child  [ ] Parent  [ ] Next of Kin
   - Branch of Military Service: _________________________________
   - Military Unit: _____________________________________________
   - Deployment Location (country/region, if known): _______________

3. QUALIFYING EXIGENCY — check all that apply:
   [ ] Short-notice deployment (deployment notice of 7 days or less)
   [ ] Military events and related activities
   [ ] Childcare and school activities
   [ ] Financial and legal arrangements
   [ ] Counseling
   [ ] Rest and recuperation (up to 15 days of leave per instance)
   [ ] Post-deployment activities
   [ ] Parental care (if military member is the sole caregiver for a parent)
   [ ] Additional activities (explain): ___________________________

4. DESCRIPTION OF EXIGENCY
   Describe the circumstances and why leave is needed: ___________
   ________________________________________________________
   ________________________________________________________

5. DATES AND DURATION
   Leave Start Date: __________________________________________
   Leave End Date: ____________________________________________
   [ ] Continuous   [ ] Intermittent / Reduced schedule

6. DOCUMENTATION
   Attach a copy of the covered military member's active duty orders or other official military documentation.
   [ ] Active duty orders attached   [ ] Other documentation attached: _________

7. EMPLOYEE CERTIFICATION
   Employee Signature: ______________________  Date: ___________`;
  } else {
    // personal or any other reason — no medical cert required; generate acknowledgment form
    formType = "Leave Request Acknowledgment Form (Company Personal Leave)";
    formInstructions = `This is an acknowledgment form for a personal leave of absence request under the Company's personal leave policy (unpaid, up to 30 days). No medical certification is required.

Required sections:
1. EMPLOYEE INFORMATION
   - Employee Name: ___________________________________________
   - Employee Number: _________________________________________
   - Department: ______________________________________________
   - Supervisor: _______________________________________________

2. LEAVE REQUEST DETAILS
   - Requested Start Date: _____________________________________
   - Requested End Date: ______________________________________
   - [ ] Continuous leave   [ ] Intermittent leave
   - Reason for Leave (general description): _____________________
     ________________________________________________________

3. COMPANY PERSONAL LEAVE POLICY ACKNOWLEDGMENT
   By signing below, I acknowledge that I have read and understand the following:
   [ ] Personal leave under this policy is unpaid and limited to a maximum of 30 calendar days.
   [ ] My position may be held for the duration of an approved leave, but the Company reserves the right to fill the role if business needs require it.
   [ ] I am responsible for any portion of health insurance premiums normally deducted from my paycheck during the leave period.
   [ ] This leave is not protected under the federal FMLA or any state paid leave program and does not count against FMLA entitlement.
   [ ] I agree to provide at least 30 days' advance notice where foreseeable, or notice as soon as practicable.

4. RETURN-TO-WORK
   Anticipated return date: ____________________________________
   [ ] I agree to notify HR at least 2 business days before my return.

5. EMPLOYEE SIGNATURE
   Employee Signature: ______________________  Date: ___________

6. HR APPROVAL (to be completed by HR)
   Approved: [ ] Yes  [ ] No
   If denied, reason: _________________________________________
   HR Representative: _______________________  Date: ___________`;
  }

  const stateSections: string[] = [];
  if (hasCA) {
    stateSections.push(`CALIFORNIA SDI / PFL CLAIM NOTICE SECTION:
   - During pregnancy disability or own health leave, you may be eligible for California State Disability Insurance (SDI) wage replacement benefits through EDD.
   - During bonding or family care leave, you may be eligible for California Paid Family Leave (PFL) benefits (up to 8 weeks, ~60–70% of wages).
   - To file a claim, visit edd.ca.gov or call 1-800-480-3287.
   - EDD Claim Number (if filed): _______________________________
   - Include a note in the form directing the employee to notify HR of their EDD claim status.`);
  }
  if (hasWA) {
    stateSections.push(`WASHINGTON PFML NOTICE:
   - You may be eligible for Washington Paid Family and Medical Leave benefits through WA ESD (up to 12 weeks, or 18 weeks for pregnancy + bonding).
   - Apply at paidleave.wa.gov. You must apply before or during your leave.`);
  }
  if (hasOR) {
    stateSections.push(`OREGON PAID LEAVE NOTICE:
   - You may be eligible for Oregon Paid Leave benefits (up to 12 weeks, or 14 weeks for pregnancy + bonding) through Frances Online.
   - Apply at oregon.gov/employ/PFMLI or through Frances Online.`);
  }
  if (hasNY) {
    stateSections.push(`NEW YORK PFL NOTICE:
   - You may be eligible for New York Paid Family Leave (up to 12 weeks of partially paid, job-protected leave) for bonding, family care, or qualifying military exigency.
   - Submit your PFL claim to the employer's disability/PFL insurance carrier.`);
  }
  if (hasCO) {
    stateSections.push(`COLORADO FAMLI NOTICE:
   - You may be eligible for Colorado FAMLI (Family and Medical Leave Insurance) benefits (up to 12 weeks, or 16 weeks for pregnancy complications + bonding).
   - Apply at famli.colorado.gov.`);
  }

  const stateBlock = stateSections.length > 0
    ? `\nSTATE-SPECIFIC SECTIONS TO INCLUDE IN THE FORM:\n${stateSections.join("\n\n")}`
    : "";

  return `MEDICAL CERTIFICATION FORM SPECIFICATIONS:

Form Type: ${formType}

${formInstructions}${stateBlock}`;
}

function buildUserPrompt(ctx: CaseContext, ragChunks: string[], states: string[], orgName: string): string {
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
  const medCertReqs = buildMedicalCertRequirements(ctx, states);

  // Build the auto-fill values block
  const employeeName = [ctx.employeeFirstName, ctx.employeeLastName].filter(Boolean).join(" ") || `Employee #${ctx.employeeNumber}`;
  const senderName = ctx.senderName || "HR Representative";
  const senderTitle = ctx.senderTitle || "Human Resources";
  const senderEmail = ctx.senderEmail || "";
  const employerName = orgName || "the Company";
  const todayDate = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return `Analyze the following leave case and draft the three required documents.
${ragSection}${stateSection}
CASE INFORMATION:
- Case Number: ${ctx.caseNumber}
- Employee Number: ${ctx.employeeNumber}
- Employee Name: ${employeeName}
- Leave Reason: ${REASON_LABELS[ctx.leaveReasonCategory] ?? ctx.leaveReasonCategory}
- Requested Start: ${ctx.requestedStart}
- Requested End: ${ctx.requestedEnd ?? "Not specified (open-ended)"}
- Intermittent: ${ctx.intermittent ? "Yes" : "No"}
- Organization: ${employerName}
- Organization States: ${states.length > 0 ? states.join(", ") : "Unknown (apply federal FMLA only)"}

NOTICE AUTO-FILL VALUES — use these exact values in the notice text (do NOT use generic placeholders):
- Employer / Company Name: ${employerName}
- Employee Name: ${employeeName}
- HR Representative Name: ${senderName}
- HR Representative Title: ${senderTitle}
- HR Representative Email: ${senderEmail}
- Notice Date: ${todayDate}

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
${medCertReqs}

INSTRUCTIONS:
Based on all the above, determine the recommended action and draft all three required documents. The Designation Notice IS the approval/denial communication — no separate approval or denial letter is needed. The Medical Certification Form is a standalone document the employee takes to their healthcare provider (or completes themselves for bonding/military/personal leave) — it is attached to the Eligibility Notice.

Use the actual names and values from NOTICE AUTO-FILL VALUES throughout the notices — the employee's real name, the company's real name, the HR representative's real name, title, and email.

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
      "content": "Full notice text covering ALL required elements listed above for the Eligibility Notice. 300-600 words. Include all applicable federal and state required elements. Address the employee by name, sign from the HR representative by name and title."
    },
    {
      "noticeType": "DESIGNATION_NOTICE",
      "title": "Leave Designation Notice",
      "content": "Full notice text covering ALL required elements listed above for the Designation Notice, reflecting the recommended action (APPROVE/DENY/REQUEST_MORE_INFO). 300-600 words. This notice conveys the leave decision — no separate approval or denial letter is issued. Address the employee by name, sign from the HR representative by name and title."
    },
    {
      "noticeType": "MEDICAL_CERTIFICATION",
      "title": "Medical Certification Form",
      "content": "A complete, fillable medical certification form appropriate for the leave reason. This is a standalone document the employee takes to their healthcare provider. Include all required sections with clearly labeled blank fields using underscores (e.g., ___________) for write-in areas. Must be ready to print and complete — 400-800 words."
    }
  ]
}

Current date: ${todayDate}`;
}

export async function generateAiRecommendation(
  ctx: CaseContext,
): Promise<AiRecommendationResult> {
  // Fetch org name + operating states so we can tailor notices to applicable state laws
  const orgInfo = await getOrgInfo(ctx.organizationId ?? null);
  const orgStates = orgInfo.states;
  const orgName = orgInfo.name;

  const ragQuery = `${REASON_LABELS[ctx.leaveReasonCategory] ?? ctx.leaveReasonCategory} leave eligibility ${ctx.analysisResult.summary} ${orgStates.join(" ")}`;
  let ragChunks: string[] = [];
  try {
    ragChunks = await retrieveRelevantChunks(ragQuery, ctx.organizationId ?? null);
    logger.info({ caseNumber: ctx.caseNumber, chunkCount: ragChunks.length, orgStates, orgName }, "RAG chunks retrieved");
  } catch (err) {
    logger.warn({ err, caseNumber: ctx.caseNumber }, "RAG retrieval failed — proceeding without context");
  }

  const systemPrompt = buildSystemPrompt(ragChunks.length > 0, buildStateGuidance(orgStates).length > 0);
  const userPrompt = buildUserPrompt(ctx, ragChunks, orgStates, orgName);

  logger.info({ caseNumber: ctx.caseNumber, ragEnabled: ragChunks.length > 0, orgStates, orgName }, "Generating AI recommendation");

  const message = await anthropic.messages.create({
    model: "claude-3-haiku-20240307",
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  const rawContent = textBlock?.type === "text" ? textBlock.text : null;
  if (!rawContent) {
    throw new Error("No content returned from AI");
  }

  // Strip markdown code fences if the model wrapped the JSON (e.g. ```json ... ```)
  const content = rawContent
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  let parsed: AiRecommendationResult;
  try {
    parsed = JSON.parse(content) as AiRecommendationResult;
  } catch (parseErr) {
    logger.error({ parseErr, rawContent: rawContent.slice(0, 500) }, "Failed to parse AI JSON response");
    throw new Error("AI returned malformed JSON — please try again");
  }

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
