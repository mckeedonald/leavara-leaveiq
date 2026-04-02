import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "./logger";
import type { AnalysisResult } from "./eligibility";
import { retrieveRelevantChunks } from "./rag";

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

const NOTICE_TYPES_BY_SITUATION: Record<string, string[]> = {
  APPROVE: ["ELIGIBILITY_NOTICE", "DESIGNATION_NOTICE", "APPROVAL_LETTER"],
  DENY: ["ELIGIBILITY_NOTICE", "DENIAL_LETTER"],
  REQUEST_MORE_INFO: ["ELIGIBILITY_NOTICE", "MORE_INFO_REQUEST"],
};

const NOTICE_TITLES: Record<string, string> = {
  ELIGIBILITY_NOTICE: "Notice of Eligibility & Rights",
  DESIGNATION_NOTICE: "FMLA/CFRA Designation Notice",
  APPROVAL_LETTER: "Leave Approval Letter",
  DENIAL_LETTER: "Leave Denial Letter",
  MORE_INFO_REQUEST: "Request for Additional Information",
};

function buildSystemPrompt(hasRagContext: boolean): string {
  return `You are an expert HR leave administration specialist and employment law paralegal. 
Your role is to assist HR professionals at US-based companies with California and federal leave law (FMLA, CFRA, PDL, and company personal leave policies).

When analyzing a leave case:
1. Review the eligibility analysis results carefully
2. ${hasRagContext ? "Ground your reasoning in the REGULATORY CONTEXT and COMPANY POLICY sections provided — cite specific provisions where applicable" : "Apply your knowledge of FMLA, CFRA, PDL, and California leave law"}
3. Determine the most legally sound recommended action
4. Draft all required notices with professional, compliant language
5. Be specific about the legal basis for your recommendation
6. All notices must be legally accurate and professionally formatted

Respond ONLY with a valid JSON object matching the exact schema requested. Do not include markdown or code blocks.`;
}

function buildUserPrompt(ctx: CaseContext, ragChunks: string[]): string {
  const { analysisResult } = ctx;

  const eligiblePrograms = analysisResult.eligiblePrograms
    .map(
      (p) =>
        `- ${p.program}: ${p.eligible ? "ELIGIBLE" : "NOT ELIGIBLE"} — ${p.reason}${p.entitlementWeeks ? ` (${p.entitlementWeeks} weeks)` : ""}`,
    )
    .join("\n");

  const ragSection = ragChunks.length > 0
    ? `\nRELEVANT REGULATORY & POLICY CONTEXT:\n${ragChunks.map((c, i) => `[${i + 1}] ${c}`).join("\n\n")}\n`
    : "";

  return `Analyze the following leave case and provide a recommendation with required notice drafts.
${ragSection}
CASE INFORMATION:
- Case Number: ${ctx.caseNumber}
- Employee Number: ${ctx.employeeNumber}
- Leave Reason: ${REASON_LABELS[ctx.leaveReasonCategory] ?? ctx.leaveReasonCategory}
- Requested Start: ${ctx.requestedStart}
- Requested End: ${ctx.requestedEnd ?? "Not specified (open-ended)"}
- Intermittent: ${ctx.intermittent ? "Yes" : "No"}

ELIGIBILITY ANALYSIS RESULTS:
- Overall Summary: ${analysisResult.summary}
- Requires HR Review: ${analysisResult.requiresHrReview ? "Yes" : "No"}
${analysisResult.reviewReason ? `- Review Reason: ${analysisResult.reviewReason}` : ""}
- Confidence Score: ${(analysisResult.confidenceScore * 100).toFixed(0)}%
- Avg Hours/Week: ${analysisResult.avgHoursPerWeek ?? "Unknown"}
- Lookback Period: ${analysisResult.lookbackMonths} months

PROGRAM ELIGIBILITY:
${eligiblePrograms}

INSTRUCTIONS:
Based on this analysis${ragChunks.length > 0 ? " and the regulatory/policy context above" : ""}, provide a JSON response with the following structure:
{
  "recommendation": {
    "action": "APPROVE" | "DENY" | "REQUEST_MORE_INFO",
    "reasoning": "A thorough 2-4 sentence plain-language explanation of why this action is recommended, referencing specific eligibility findings${ragChunks.length > 0 ? " and relevant regulatory provisions" : ""}.",
    "confidenceScore": 0.0-1.0,
    "keyFactors": ["Array of 3-5 specific factors that drove this recommendation"]
  },
  "notices": [
    {
      "noticeType": "ELIGIBILITY_NOTICE" | "DESIGNATION_NOTICE" | "APPROVAL_LETTER" | "DENIAL_LETTER" | "MORE_INFO_REQUEST",
      "title": "Human-readable notice title",
      "content": "Full professionally-formatted notice text with all required details. Include [EMPLOYER NAME], [DATE], [HR REPRESENTATIVE NAME] placeholders where appropriate. The notice should be suitable for direct delivery to the employee. For FMLA/CFRA notices, reference the applicable law. Notices should be 200-500 words."
    }
  ]
}

Select notices based on the recommended action:
- APPROVE: Include ELIGIBILITY_NOTICE, DESIGNATION_NOTICE, and APPROVAL_LETTER
- DENY: Include ELIGIBILITY_NOTICE and DENIAL_LETTER  
- REQUEST_MORE_INFO: Include ELIGIBILITY_NOTICE and MORE_INFO_REQUEST

Use current date: ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;
}

export async function generateAiRecommendation(
  ctx: CaseContext,
): Promise<AiRecommendationResult> {
  const ragQuery = `${REASON_LABELS[ctx.leaveReasonCategory] ?? ctx.leaveReasonCategory} leave eligibility ${ctx.analysisResult.summary}`;
  let ragChunks: string[] = [];
  try {
    ragChunks = await retrieveRelevantChunks(ragQuery, ctx.organizationId ?? null);
    logger.info({ caseNumber: ctx.caseNumber, chunkCount: ragChunks.length }, "RAG chunks retrieved");
  } catch (err) {
    logger.warn({ err, caseNumber: ctx.caseNumber }, "RAG retrieval failed — proceeding without context");
  }

  const systemPrompt = buildSystemPrompt(ragChunks.length > 0);
  const userPrompt = buildUserPrompt(ctx, ragChunks);

  logger.info({ caseNumber: ctx.caseNumber, ragEnabled: ragChunks.length > 0 }, "Generating AI recommendation");

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No content returned from AI");
  }

  const parsed = JSON.parse(content) as AiRecommendationResult;

  if (!parsed.recommendation || !Array.isArray(parsed.notices)) {
    throw new Error("Invalid AI response structure");
  }

  const noticeTypes = NOTICE_TYPES_BY_SITUATION[parsed.recommendation.action] ?? [];
  const filteredNotices = parsed.notices.filter((n) =>
    noticeTypes.includes(n.noticeType),
  );

  for (const noticeType of noticeTypes) {
    if (!filteredNotices.find((n) => n.noticeType === noticeType)) {
      filteredNotices.push({
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
      noticeCount: filteredNotices.length,
    },
    "AI recommendation generated",
  );

  return {
    recommendation: parsed.recommendation,
    notices: filteredNotices,
  };
}
