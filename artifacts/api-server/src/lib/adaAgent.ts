/**
 * Ada — ADA Interactive Process Agent
 *
 * Assists HR through the full ADA accommodation workflow:
 *  1. Review initial request & gather context
 *  2. Send physician certification request
 *  3. Research accommodations via JAN live lookup
 *  4. Guide interactive process conversations
 *  5. Draft approval or denial letters
 *  6. Suggest follow-up scheduling
 *
 * Distinct from Ava (leave management) — Ada focuses exclusively on
 * ADA accommodations, undue hardship analysis, and the interactive process.
 */

import { anthropic } from "./anthropic.js";
import { lookupJanAccommodations, formatJanResultsForPrompt } from "./janLookup.js";
import { retrieveRelevantChunks } from "./rag.js";
import { logger } from "./logger.js";
import type { AdaCase } from "@workspace/db";

const ADA_SYSTEM_PROMPT = `You are Ada, an expert ADA (Americans with Disabilities Act) accommodation specialist embedded in the Leavara LeaveIQ platform. You assist HR professionals with the complete ADA interactive process.

YOUR EXPERTISE COVERS:
- ADA Title I requirements (employers with 15+ employees)
- Section 504 of the Rehabilitation Act
- The ADA Amendments Act of 2008 (ADAAA)
- EEOC enforcement guidance on reasonable accommodation
- Undue hardship analysis
- The interactive process requirements
- Medical inquiry limitations under ADA
- Confidentiality requirements for medical information
- ADA leave of absence as a reasonable accommodation
- Relationship between ADA, FMLA, and state leave laws

THE INTERACTIVE PROCESS REQUIRES:
1. Acknowledge the request promptly
2. Engage in good-faith discussion with the employee
3. Identify the precise job-related limitation
4. Identify potential accommodations
5. Assess effectiveness and undue hardship
6. Select the most appropriate accommodation
7. Document every step

CRITICAL RULES:
- Never advise HR to ask employees about their specific diagnosis (only functional limitations)
- Medical information must be kept confidential and separate from personnel files
- Always recommend the least burdensome effective accommodation first
- An employer can deny only if accommodation causes undue hardship (significant difficulty or expense)
- When denying, always inform employee of ADA leave as an alternative
- Direct HR to job Accommodation Network (JAN) resources — always cite JAN when discussing specific accommodations
- You have access to live JAN database lookups — use them for every accommodation discussion

RESPONSE STYLE:
- Professional but approachable
- Cite specific ADA sections and EEOC guidance when relevant
- Always cite JAN sources when discussing specific accommodation ideas
- Format letters professionally with proper headings
- Suggest specific follow-up timelines (ADA requires prompt action — typically within 30 days)
- Flag any legal risks or compliance concerns clearly`;

export interface AdaMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AdaTurnOptions {
  caseData: Partial<AdaCase>;
  conversationHistory: AdaMessage[];
  userMessage: string;
  userRole: string;
  userName: string;
  /** If set, Ada will perform a JAN lookup for this limitation description */
  lookupJan?: boolean;
}

export interface AdaTurnResult {
  response: string;
  janLookupPerformed: boolean;
  suggestedFollowUpDate?: string; // ISO date string if Ada suggests a follow-up
  actionSuggested?: string; // e.g. "send_physician_cert" | "draft_approval" | "draft_denial"
}

export async function runAdaTurn(opts: AdaTurnOptions): Promise<AdaTurnResult> {
  const { caseData, conversationHistory, userMessage, userRole, userName, lookupJan } = opts;

  // Build case context block
  const employeeName = [caseData.employeeFirstName, caseData.employeeLastName]
    .filter(Boolean).join(" ") || `Employee #${caseData.employeeNumber}`;

  const caseContext = `
[ADA CASE CONTEXT]
Case Number: ${caseData.caseNumber ?? "New Case"}
Employee: ${employeeName}
Email: ${caseData.employeeEmail ?? "Not provided"}
Status: ${caseData.status ?? "pending_review"}
Disability Description: ${caseData.disabilityDescription ?? "Not yet documented"}
Functional Limitations: ${caseData.functionalLimitations ?? "Not yet documented"}
Accommodation Requested: ${caseData.accommodationRequested ?? "Not yet documented"}
Is Temporary: ${caseData.isTemporary ? "Yes" : "No"}
Has Physician Support: ${caseData.hasPhysicianSupport === true ? "Yes" : caseData.hasPhysicianSupport === false ? "No" : "Unknown"}
Physician Cert Sent: ${caseData.physicianCertSentAt ? new Date(caseData.physicianCertSentAt).toLocaleDateString() : "Not yet sent"}
Physician Cert Received: ${caseData.physicianCertReceivedAt ? new Date(caseData.physicianCertReceivedAt).toLocaleDateString() : "Not yet received"}
Current Decision: ${caseData.decision ?? "Pending"}

[HR USER CONTEXT]
Name: ${userName}
Role: ${userRole}
Date: ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`;

  // JAN lookup if requested or if discussing accommodations
  let janContext = "";
  let janLookupPerformed = false;
  const shouldLookupJan = lookupJan ||
    userMessage.toLowerCase().includes("accommodation") ||
    userMessage.toLowerCase().includes("jan") ||
    userMessage.toLowerCase().includes("what can we") ||
    userMessage.toLowerCase().includes("options") ||
    userMessage.toLowerCase().includes("ideas");

  if (shouldLookupJan && (caseData.functionalLimitations || caseData.disabilityDescription)) {
    try {
      const janResults = await lookupJanAccommodations(
        caseData.functionalLimitations ?? caseData.disabilityDescription ?? "",
        caseData.accommodationRequested ?? "",
      );
      janContext = "\n\n" + formatJanResultsForPrompt(janResults);
      janLookupPerformed = true;
    } catch (err) {
      logger.warn({ err }, "JAN lookup failed — continuing without");
    }
  }

  // RAG lookup for relevant ADA law chunks
  let ragContext = "";
  try {
    const chunks = await retrieveRelevantChunks(
      `ADA reasonable accommodation ${caseData.disabilityDescription ?? ""} ${caseData.accommodationRequested ?? ""}`,
      null, // organizationId null = global legal knowledge
    );
    if (chunks.length > 0) {
      ragContext = "\n\n[RELEVANT ADA/LEAVE LAW CONTEXT]\n" + chunks.join("\n\n---\n\n");
    }
  } catch {
    // Silent — RAG enhancement is optional
  }

  const systemPrompt = ADA_SYSTEM_PROMPT + caseContext + janContext + ragContext;

  // Build messages for Claude
  const messages: Array<{ role: "user" | "assistant"; content: string }> = [
    ...conversationHistory,
    { role: "user", content: userMessage },
  ];

  const response = await anthropic.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 2000,
    system: systemPrompt,
    messages,
  });

  const responseText = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("\n");

  // Detect Ada's suggested actions from response
  const lowerResponse = responseText.toLowerCase();
  let actionSuggested: string | undefined;
  let suggestedFollowUpDate: string | undefined;

  if (lowerResponse.includes("physician certification") && lowerResponse.includes("send")) {
    actionSuggested = "send_physician_cert";
  } else if (lowerResponse.includes("approval letter") || (lowerResponse.includes("approve") && lowerResponse.includes("draft"))) {
    actionSuggested = "draft_approval";
  } else if (lowerResponse.includes("denial letter") || (lowerResponse.includes("deny") && lowerResponse.includes("draft"))) {
    actionSuggested = "draft_denial";
  }

  // Extract follow-up date suggestions (look for "within X days" patterns)
  const followUpMatch = responseText.match(/follow[- ]up (?:within|in) (\d+) (?:business )?days?/i) ??
    responseText.match(/schedule (?:a )?follow[- ]up (?:within|in) (\d+)/i);
  if (followUpMatch) {
    const days = parseInt(followUpMatch[1]);
    const followUpDate = new Date();
    followUpDate.setDate(followUpDate.getDate() + days);
    // Skip weekends
    while (followUpDate.getDay() === 0 || followUpDate.getDay() === 6) {
      followUpDate.setDate(followUpDate.getDate() + 1);
    }
    suggestedFollowUpDate = followUpDate.toISOString().split("T")[0];
  }

  return { response: responseText, janLookupPerformed, actionSuggested, suggestedFollowUpDate };
}

/**
 * Generate the ADA physician certification request letter.
 * This is distinct from FMLA — ADA allows limited medical inquiry,
 * only about whether the employee has a disability and what accommodation is needed.
 */
export async function generatePhysicianCertRequest(caseData: Partial<AdaCase>): Promise<string> {
  const employeeName = [caseData.employeeFirstName, caseData.employeeLastName]
    .filter(Boolean).join(" ") || "the employee";
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const prompt = `Generate a professional ADA Physician Certification Request letter. This letter requests medical information from a healthcare provider to support an ADA reasonable accommodation request.

CASE INFORMATION:
- Employee: ${employeeName}
- Accommodation Requested: ${caseData.accommodationRequested ?? "Workplace accommodations"}
- Functional Limitations Reported: ${caseData.functionalLimitations ?? "To be determined by physician"}
- Date: ${today}

REQUIREMENTS:
1. The letter must comply with ADA — only request information about whether the employee has a disability (under ADA's broad definition), the nature of the functional limitation, and what accommodation(s) would be effective
2. Do NOT request the specific diagnosis or medical history
3. Include a confidentiality statement
4. Include a response deadline (typically 15 business days)
5. Include return instructions
6. Be professional and compliant with EEOC guidance
7. Include a physician certification section with signature lines for:
   - Verification that the employee has a disability as defined by ADA
   - Description of functional limitations (not diagnosis)
   - Recommended accommodations
   - Whether limitations are temporary or permanent
   - Physician signature and date

Return ONLY the letter text, formatted for direct use.`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("\n");

    if (text.trim()) return text;
  } catch (err) {
    logger.error({ err }, "Claude API call failed for physician cert — falling back to template");
  }

  // Fallback: ADA-compliant template if Claude is unavailable
  return `${today}

RE: Request for Medical Information to Support ADA Accommodation Request
Employee: ${employeeName}
Case Number: ${caseData.caseNumber ?? ""}

Dear Healthcare Provider,

We are writing to request your professional opinion to assist us in evaluating a request for reasonable accommodation under the Americans with Disabilities Act (ADA).

Your patient, ${employeeName}, has requested the following workplace accommodation:
${caseData.accommodationRequested ?? "Workplace accommodation (see employee's request)"}

To evaluate this request in accordance with EEOC guidance, we are asking you to provide the following information ONLY — we are NOT requesting a specific diagnosis or complete medical records:

1. Does your patient have a physical or mental impairment that substantially limits one or more major life activities as defined by the ADA?
   [ ] Yes  [ ] No

2. The nature and extent of the functional limitations resulting from this impairment as they relate to the employee's ability to perform job duties:
   _______________________________________________________________
   _______________________________________________________________

3. Your professional recommendation regarding accommodations that would enable the employee to perform their essential job functions effectively:
   _______________________________________________________________
   _______________________________________________________________

4. Are the limitations temporary or permanent?
   [ ] Temporary — expected duration: ________________________
   [ ] Permanent or long-term

**IMPORTANT:** We are NOT requesting the employee's specific diagnosis, complete medical records, or unrelated medical history. Please limit your response to the functional limitations and accommodation recommendations relevant to this request.

---

**CONFIDENTIALITY STATEMENT**

All medical information provided in response to this request will be kept strictly confidential, stored separately from the employee's personnel file, and disclosed only to individuals with a legitimate need to know as required by the ADA.

---

Please return this completed form within **15 business days** to:

Human Resources Department
[Organization Name]

Physician Name: _______________________________
License Number: _______________________________
Signature: ____________________________________
Date: ________________________________________
Phone: _______________________________________

Thank you for your prompt attention to this matter.

Sincerely,

Human Resources Department`;
}

/**
 * Generate an ADA accommodation approval letter.
 */
export async function generateApprovalLetter(
  caseData: Partial<AdaCase>,
  approvedAccommodations: string[],
  hrName: string,
): Promise<string> {
  const employeeName = [caseData.employeeFirstName, caseData.employeeLastName]
    .filter(Boolean).join(" ") || "Employee";
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const prompt = `Generate a professional ADA reasonable accommodation approval letter.

CASE INFORMATION:
- Employee: ${employeeName}
- Date: ${today}
- HR Representative: ${hrName}
- Original Request: ${caseData.accommodationRequested ?? "Workplace accommodation"}
- APPROVED Accommodations: ${approvedAccommodations.join("; ")}

REQUIREMENTS:
1. Professional, empathetic tone
2. Confirm what accommodation(s) are approved
3. Explain any implementation timeline
4. State that this decision may be revisited if the employee's needs or job functions change
5. Invite the employee to continue the interactive process if needs change
6. Include a confidentiality reminder regarding medical information
7. Proper letter format with greeting, body paragraphs, and signature block

Return ONLY the letter text, formatted for direct use.`;

  const message = await anthropic.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 1200,
    messages: [{ role: "user", content: prompt }],
  });

  return message.content.filter((b) => b.type === "text").map((b) => (b as any).text).join("\n");
}

/**
 * Generate an ADA accommodation denial letter.
 * Must state the specific undue hardship basis and inform employee of ADA leave option.
 */
export async function generateDenialLetter(
  caseData: Partial<AdaCase>,
  hardshipJustification: string,
  hrName: string,
): Promise<string> {
  const employeeName = [caseData.employeeFirstName, caseData.employeeLastName]
    .filter(Boolean).join(" ") || "Employee";
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const prompt = `Generate a professional ADA reasonable accommodation denial letter that is legally compliant.

CASE INFORMATION:
- Employee: ${employeeName}
- Date: ${today}
- HR Representative: ${hrName}
- Requested Accommodation: ${caseData.accommodationRequested ?? "Requested accommodation"}
- Undue Hardship Basis: ${hardshipJustification}

REQUIREMENTS:
1. State clearly that the specific accommodation is denied
2. State the specific undue hardship basis (use the provided justification)
3. ADA requires you to specifically state what creates the undue hardship
4. MUST inform the employee that they may be eligible for a leave of absence as an alternative accommodation under ADA
5. MUST invite continued engagement in the interactive process to explore alternative accommodations
6. MUST inform the employee of their right to file a charge with the EEOC if they believe this is discriminatory
7. Provide the EEOC contact: www.eeoc.gov or 1-800-669-4000
8. Professional, respectful tone — this is not adversarial
9. Include information about any appeals or grievance process

Return ONLY the letter text, formatted for direct use.`;

  const message = await anthropic.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 1400,
    messages: [{ role: "user", content: prompt }],
  });

  return message.content.filter((b) => b.type === "text").map((b) => (b as any).text).join("\n");
}
