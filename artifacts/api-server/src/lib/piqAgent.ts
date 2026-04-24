import Anthropic from "@anthropic-ai/sdk";
import { db, piqAgentSessionsTable, piqAgentMessagesTable, piqPoliciesTable, piqCasesTable, piqEmployeesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "./logger.js";
import type { PiqDocumentContent } from "@workspace/db";

const anthropic = new Anthropic({ apiKey: process.env["ANTHROPIC_API_KEY"] });

const SYSTEM_PROMPT = `You are the Leavara PerformIQ Performance Specialist — an expert HR documentation assistant.

Your role is to help managers create accurate, professional, and legally defensible performance documentation including:
- Verbal Coaching / Coaching Sessions
- Written Warnings
- Final Warnings / Last Chance Agreements

## Your Process

Conduct a structured intake conversation with the manager to gather all necessary information. Ask 1-2 questions at a time in a conversational, professional tone. Do NOT dump all questions at once.

### Information to gather (progressively):
1. What specific behavior or performance issue occurred? What exactly happened?
2. When and where did the incident occur?
3. Was the employee aware of the expectation or policy before this incident?
4. Has this behavior occurred before? If so, what action was taken previously?
5. What is the impact of this behavior on the team, customers, operations, or safety?
6. Were there any mitigating circumstances the employee raised or that you are aware of?
7. Are there any witnesses?
8. What specific expectations should be set going forward (measurable and time-bound where possible)?
9. What are the consequences if the employee fails to meet these expectations?

### Tone & Style
- Conversational and professional
- Ask clarifying follow-up questions if answers are vague
- Acknowledge the manager's input before asking the next question
- When you have enough detail, say "I have enough information to draft the document. Let me prepare that for you."

### Document Generation
When ready to generate, produce a structured document in JSON format wrapped in <document> tags:
<document>
{
  "documentTypePurpose": "...",
  "incidentDescription": "...",
  "policyViolations": "...",
  "impactConsequences": "...",
  "priorDisciplineHistory": "...",
  "expectationsGoingForward": "...",
  "failureConsequences": "...",
  "additionalNotes": ""
}
</document>

Write each field as full, professional paragraph(s) — not bullet points. The tone should be factual, specific, and appropriate for an HR document.

After presenting the draft, ask: "Would you like to adjust anything in this draft before I finalize it?"

### Policy References
If org policies are provided in context, explicitly cite the policy name and relevant section in policyViolations.

### Important
- Never fabricate specific dates, amounts, or details not provided by the manager
- If the manager's answer is vague, ask for specifics before drafting
- Protect the employee's dignity — document facts, not character judgments`;

interface AgentTurnOptions {
  sessionId: string;
  organizationId: string;
  userMessage: string;
  employeeInfo?: {
    fullName: string;
    jobTitle: string;
    department: string;
    hireDate: string | null;
    managerName: string;
  };
  onChunk?: (text: string) => void;
}

export async function runAgentTurn({
  sessionId,
  organizationId,
  userMessage,
  employeeInfo,
  onChunk,
}: AgentTurnOptions): Promise<{ text: string; draft: PiqDocumentContent | null }> {
  // Load conversation history
  const history = await db
    .select({ role: piqAgentMessagesTable.role, content: piqAgentMessagesTable.content })
    .from(piqAgentMessagesTable)
    .where(eq(piqAgentMessagesTable.sessionId, sessionId))
    .orderBy(piqAgentMessagesTable.createdAt);

  // Load org policies for context
  const policies = await db
    .select({ title: piqPoliciesTable.title, category: piqPoliciesTable.category, content: piqPoliciesTable.content })
    .from(piqPoliciesTable)
    .where(and(eq(piqPoliciesTable.organizationId, organizationId), eq(piqPoliciesTable.isActive, true)));

  const policyContext =
    policies.length > 0
      ? `\n\n## Organization Policies (reference when documenting violations):\n${policies.map((p) => `### ${p.title} (${p.category})\n${p.content}`).join("\n\n")}`
      : "\n\n## Organization Policies: No policies have been configured yet. Note this gap when relevant.";

  const employeeContext = employeeInfo
    ? `\n\n## Employee Information (pre-populated for the document):\n- Name: ${employeeInfo.fullName}\n- Job Title: ${employeeInfo.jobTitle}\n- Department: ${employeeInfo.department}\n- Hire Date: ${employeeInfo.hireDate ?? "Unknown"}\n- Manager: ${employeeInfo.managerName}`
    : "";

  const systemPrompt = SYSTEM_PROMPT + policyContext + employeeContext;

  // Store user message
  await db.insert(piqAgentMessagesTable).values({
    sessionId,
    organizationId,
    role: "user",
    content: userMessage,
  });

  const messages: Anthropic.MessageParam[] = [
    ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: userMessage },
  ];

  let fullText = "";

  const stream = anthropic.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    system: systemPrompt,
    messages,
  });

  for await (const chunk of stream) {
    if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
      fullText += chunk.delta.text;
      onChunk?.(chunk.delta.text);
    }
  }

  // Store assistant response
  await db.insert(piqAgentMessagesTable).values({
    sessionId,
    organizationId,
    role: "assistant",
    content: fullText,
  });

  // Try to extract draft document if present
  let draft: PiqDocumentContent | null = null;
  const docMatch = fullText.match(/<document>([\s\S]*?)<\/document>/);
  if (docMatch) {
    try {
      const parsed = JSON.parse(docMatch[1].trim());
      draft = {
        employeeInfo: employeeInfo
          ? {
              fullName: employeeInfo.fullName,
              jobTitle: employeeInfo.jobTitle,
              department: employeeInfo.department,
              hireDate: employeeInfo.hireDate ?? "",
              managerName: employeeInfo.managerName,
            }
          : { fullName: "", jobTitle: "", department: "", hireDate: "", managerName: "" },
        ...parsed,
      };

      // Mark session as completed with draft
      await db
        .update(piqAgentSessionsTable)
        .set({ finalDraft: draft, status: "completed", updatedAt: new Date() })
        .where(eq(piqAgentSessionsTable.id, sessionId));
    } catch {
      logger.warn("Could not parse draft document from agent response");
    }
  }

  return { text: fullText, draft };
}
