import { anthropic } from "./anthropic";
import { logger } from "./logger";

export type AiAction = "APPROVE" | "DENY" | "APPROVE_PARTIAL" | "REQUEST_MORE_INFO";

export interface AiRecommendation {
  action: AiAction;
  reasoning: string;
  confidence: number;
  generatedAt: string;
}

export interface NoticeDraft {
  noticeType: string;
  subject: string;
  content: string;
}

export interface AiAgentResult {
  recommendation: AiRecommendation;
  notices: NoticeDraft[];
}

interface CaseInput {
  caseNumber: string;
  employeeNumber: string;
  employeeEmail?: string | null;
  leaveReasonCategory: string;
  requestedStart: string;
  requestedEnd?: string | null;
  intermittent: boolean;
  analysisResult: {
    eligiblePrograms: Array<{
      program: string;
      eligible: boolean;
      entitlementWeeks?: number | null;
      reason: string;
    }>;
    summary: string;
    requiresHrReview: boolean;
    reviewReason?: string | null;
    confidenceScore: number;
  };
}

const REASON_LABELS: Record<string, string> = {
  own_health: "Employee's own serious health condition",
  care_family: "Caring for a family member with a serious health condition",
  pregnancy_disability: "Pregnancy disability",
  bonding: "Bonding with a new child",
  military: "Military family leave",
  personal: "Personal leave",
};

function buildSystemPrompt(): string {
  return `You are an expert HR compliance specialist with deep knowledge of the Family and Medical Leave Act (FMLA), state leave laws (CFRA, PDL, WFMLA, etc.), and company leave policies.

Your role is to:
1. Review leave of absence cases and provide a clear recommendation
2. Draft all required notices and communications in a professional, legally precise, and empathetic tone
3. Ensure all notices comply with applicable federal and state law
4. HR will always review and potentially edit your drafts before sending

Your output must be a valid JSON object with no markdown formatting.`;
}

function buildUserPrompt(c: CaseInput): string {
  const programs = c.analysisResult.eligiblePrograms
    .map(
      (p) =>
        `  - ${p.program}: ${p.eligible ? `ELIGIBLE (${p.entitlementWeeks ?? "N/A"} weeks)` : "NOT ELIGIBLE"} — ${p.reason}`,
    )
    .join("\n");

  return `Review this leave of absence case and return a JSON response.

CASE DETAILS:
- Case Number: ${c.caseNumber}
- Employee Number: ${c.employeeNumber}
- Leave Reason: ${REASON_LABELS[c.leaveReasonCategory] ?? c.leaveReasonCategory}
- Requested Start: ${c.requestedStart}
- Requested End: ${c.requestedEnd ?? "Not specified (open-ended)"}
- Schedule: ${c.intermittent ? "Intermittent" : "Continuous"}

ELIGIBILITY ANALYSIS RESULTS:
${programs}

Analysis Summary: ${c.analysisResult.summary}
Requires HR Review: ${c.analysisResult.requiresHrReview ? "Yes" : "No"}${c.analysisResult.reviewReason ? ` — ${c.analysisResult.reviewReason}` : ""}
Confidence Score: ${(c.analysisResult.confidenceScore * 100).toFixed(0)}%

INSTRUCTIONS:
Based on the eligibility analysis, provide:
1. A recommendation (APPROVE, DENY, APPROVE_PARTIAL, or REQUEST_MORE_INFO)
2. Clear reasoning for HR to understand and communicate
3. Draft notices appropriate for this case

Return ONLY this JSON structure (no markdown, no code blocks):
{
  "recommendation": {
    "action": "APPROVE" | "DENY" | "APPROVE_PARTIAL" | "REQUEST_MORE_INFO",
    "reasoning": "2-3 sentences explaining the recommendation clearly for an HR professional",
    "confidence": 0.0-1.0
  },
  "notices": [
    {
      "noticeType": "ELIGIBILITY_NOTICE" | "DESIGNATION_NOTICE_APPROVAL" | "DESIGNATION_NOTICE_DENIAL" | "CERTIFICATION_REQUEST" | "APPROVAL_LETTER" | "DENIAL_LETTER" | "INFO_REQUEST_LETTER",
      "subject": "Email subject line",
      "content": "Full professional email body text. Use plain text with line breaks. Include all legally required elements. Address the employee as 'Dear [Employee Name],' and close professionally."
    }
  ]
}

Draft the notices appropriate to the eligibility determination and your recommendation. For FMLA/CFRA eligible cases include an Eligibility Notice. Always include a decision letter matching the recommendation action.`;
}

export async function generateAiRecommendation(c: CaseInput): Promise<AiAgentResult> {
  logger.info({ caseNumber: c.caseNumber }, "Generating AI recommendation");

  const stream = anthropic.messages.stream({
    model: "claude-opus-4-6",
    max_tokens: 8192,
    thinking: { type: "adaptive" },
    system: buildSystemPrompt(),
    messages: [{ role: "user", content: buildUserPrompt(c) }],
  });

  const message = await stream.finalMessage();

  const textBlock = message.content.find((b) => b.type === "text");
  const raw = textBlock?.type === "text" ? textBlock.text : "";

  let parsed: AiAgentResult;
  try {
    const json = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    const result = JSON.parse(json) as { recommendation: AiRecommendation; notices: NoticeDraft[] };

    parsed = {
      recommendation: {
        action: result.recommendation.action,
        reasoning: result.recommendation.reasoning,
        confidence: result.recommendation.confidence,
        generatedAt: new Date().toISOString(),
      },
      notices: result.notices ?? [],
    };
  } catch (err) {
    logger.error({ err, raw }, "Failed to parse AI response");
    throw new Error("AI returned an unparseable response");
  }

  logger.info(
    { caseNumber: c.caseNumber, action: parsed.recommendation.action, noticeCount: parsed.notices.length },
    "AI recommendation generated",
  );

  return parsed;
}
