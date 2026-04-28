import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import {
  Send,
  Bot,
  User,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { PiqLayout } from "@/components/performiq/PiqLayout";
import { piqApiFetch, usePiqAuth } from "@/lib/piqAuth";
import type { PiqDocumentContent } from "@workspace/db";

const C = {
  perf: "#2E7B7B",
  card: "#FFFFFF",
  border: "#C4D9D9",
  textDark: "#1A3333",
  textMuted: "#6B9090",
  agentBg: "#F0F5F5",
  userBg: "#2E7B7B",
};

interface Employee {
  id: string;
  fullName: string;
  jobTitle: string;
  department: string;
  hireDate: string | null;
}

interface DocType {
  id: string;
  displayLabel: string;
  baseType: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

type Step = "select_employee" | "agent_chat" | "review_draft";

/* Auth token helper — unified auth stores as leavara_token */
function getAuthToken(): string {
  return (
    localStorage.getItem("leavara_token") ??
    localStorage.getItem("leaveiq_token") ??
    ""
  );
}

export default function NewCase() {
  const { user } = usePiqAuth();
  const [, navigate] = useLocation();

  const [step, setStep] = useState<Step>("select_employee");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [docTypes, setDocTypes] = useState<DocType[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [empSearch, setEmpSearch] = useState("");

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [startingSession, setStartingSession] = useState(false);
  const [draft, setDraft] = useState<PiqDocumentContent | null>(null);
  const [draftDocBaseType, setDraftDocBaseType] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    piqApiFetch<Employee[]>("/api/performiq/employees?isActive=true")
      .then(setEmployees)
      .catch(() => {});
    piqApiFetch<DocType[]>("/api/performiq/admin/document-types")
      .then(setDocTypes)
      .catch(() => {});
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function startAgentSession(employee: Employee) {
    setStartingSession(true);
    setError(null);
    try {
      const data = await piqApiFetch<{ sessionId: string; greeting: string }>(
        "/api/performiq/agent/sessions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ employeeId: employee.id }),
        }
      );
      setSessionId(data.sessionId);
      // Show the agent's opening greeting — no user message needed
      setMessages([{ role: "assistant", content: data.greeting }]);
      setStep("agent_chat");
    } catch {
      setError("Failed to start session with the Performance Specialist. Please try again.");
    } finally {
      setStartingSession(false);
    }
  }

  async function sendMessage(text: string) {
    if (!sessionId || !text.trim() || sending) return;

    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    const assistantMsg: Message = { role: "assistant", content: "" };
    setMessages((prev) => [...prev, assistantMsg]);

    try {
      const res = await fetch(
        `/api/performiq/agent/sessions/${sessionId}/message`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getAuthToken()}`,
          },
          body: JSON.stringify({
            message: text,
            employeeInfo: selectedEmployee
              ? {
                  fullName: selectedEmployee.fullName,
                  jobTitle: selectedEmployee.jobTitle,
                  department: selectedEmployee.department,
                  hireDate: selectedEmployee.hireDate,
                  managerName: user?.fullName ?? "",
                }
              : undefined,
          }),
        }
      );

      if (!res.body) throw new Error("No stream");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const raw = decoder.decode(value);
        const lines = raw.split("\n").filter((l) => l.startsWith("data: "));
        for (const line of lines) {
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "chunk") {
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  content: updated[updated.length - 1].content + event.text,
                };
                return updated;
              });
            } else if (event.type === "draft") {
              const d = event.draft as PiqDocumentContent & { docBaseType?: string };
              setDraft(d);
              setDraftDocBaseType((d as any).docBaseType ?? null);
            }
          } catch {
            // malformed event — ignore
          }
        }
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content:
            "Sorry, I encountered an error. Please try again.",
        };
        return updated;
      });
    } finally {
      setSending(false);
    }
  }

  async function createCaseFromDraft() {
    if (!draft || !selectedEmployee || !sessionId) return;
    setSaving(true);
    setError(null);

    // Resolve document type ID — agent emits docBaseType in the draft JSON
    let documentTypeId: string | null = null;
    if (draftDocBaseType) {
      const match = docTypes.find((dt) => dt.baseType === draftDocBaseType);
      if (match) documentTypeId = match.id;
    }
    // Fall back to first available if no match (rare; HR can reconfigure after)
    if (!documentTypeId && docTypes.length > 0) {
      documentTypeId = docTypes[0].id;
    }

    try {
      const newCase = await piqApiFetch<{ id: string }>("/api/performiq/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: selectedEmployee.id,
          documentTypeId,
          docBaseType: draftDocBaseType ?? undefined,
          agentSessionId: sessionId,
          initialDraft: draft,
        }),
      });
      navigate(`/performiq/cases/${newCase.id}`);
    } catch {
      setError("Failed to create case. Please try again.");
      setSaving(false);
    }
  }

  const filteredEmployees = employees.filter(
    (e) =>
      !empSearch ||
      e.fullName.toLowerCase().includes(empSearch.toLowerCase()) ||
      (e.department ?? "").toLowerCase().includes(empSearch.toLowerCase())
  );

  const STEPS: { key: Step; label: string }[] = [
    { key: "select_employee", label: "Employee" },
    { key: "agent_chat", label: "AI Chat" },
    { key: "review_draft", label: "Review" },
  ];

  return (
    <PiqLayout>
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: C.textDark }}>
            New Performance Case
          </h1>
          <p className="text-sm mt-0.5" style={{ color: C.textMuted }}>
            Your Performance Specialist will guide you through the process.
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <React.Fragment key={s.key}>
              <div
                className="flex items-center gap-2 text-xs font-medium"
                style={{
                  color:
                    step === s.key
                      ? C.perf
                      : STEPS.findIndex((x) => x.key === step) > i
                      ? "#065F46"
                      : C.textMuted,
                }}
              >
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{
                    background:
                      step === s.key
                        ? C.perf
                        : STEPS.findIndex((x) => x.key === step) > i
                        ? "#D1FAE5"
                        : "#EDF5F5",
                    color:
                      step === s.key
                        ? "#FFF"
                        : STEPS.findIndex((x) => x.key === step) > i
                        ? "#065F46"
                        : C.textMuted,
                  }}
                >
                  {i + 1}
                </span>
                <span className="hidden sm:block">{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <ChevronRight className="w-3 h-3 shrink-0" style={{ color: C.textMuted }} />
              )}
            </React.Fragment>
          ))}
        </div>

        {error && (
          <div
            className="mb-4 px-4 py-3 rounded-xl text-sm border flex items-center gap-2"
            style={{ background: "#FEE2E2", borderColor: "#FCA5A5", color: "#B91C1C" }}
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Step 1: Select Employee */}
        {step === "select_employee" && (
          <div
            className="rounded-2xl border p-6"
            style={{ background: C.card, borderColor: C.border }}
          >
            <h2 className="font-semibold text-lg mb-4" style={{ color: C.textDark }}>
              Who is this case for?
            </h2>
            <input
              type="text"
              placeholder="Search by name or department…"
              value={empSearch}
              onChange={(e) => setEmpSearch(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl text-sm outline-none border mb-4"
              style={{ background: C.agentBg, borderColor: C.border, color: C.textDark }}
            />
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {filteredEmployees.map((e) => (
                <button
                  key={e.id}
                  onClick={() => {
                    setSelectedEmployee(e);
                    startAgentSession(e);
                  }}
                  disabled={startingSession}
                  className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-left transition-colors hover:bg-teal-50 border disabled:opacity-60"
                  style={{ borderColor: C.border }}
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ background: C.perf }}
                  >
                    {e.fullName
                      .split(" ")
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join("")}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium text-sm" style={{ color: C.textDark }}>
                      {e.fullName}
                    </p>
                    <p className="text-xs" style={{ color: C.textMuted }}>
                      {e.jobTitle} · {e.department}
                    </p>
                  </div>
                  {startingSession && selectedEmployee?.id === e.id ? (
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" style={{ color: C.perf }} />
                  ) : (
                    <ChevronRight className="w-4 h-4 shrink-0" style={{ color: C.textMuted }} />
                  )}
                </button>
              ))}
              {filteredEmployees.length === 0 && (
                <p className="text-center py-6 text-sm" style={{ color: C.textMuted }}>
                  No employees found. Upload employee data from HR Settings.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Agent Chat */}
        {step === "agent_chat" && (
          <div
            className="rounded-2xl border overflow-hidden flex flex-col"
            style={{ background: C.card, borderColor: C.border, height: "68vh" }}
          >
            {/* Chat header */}
            <div
              className="px-5 py-4 flex items-center gap-3 shrink-0"
              style={{ borderBottom: `1px solid ${C.border}`, background: C.agentBg }}
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                style={{ background: C.perf }}
              >
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm" style={{ color: C.textDark }}>
                  Performance Specialist
                </p>
                <p className="text-xs" style={{ color: C.textMuted }}>
                  {selectedEmployee?.fullName} · {selectedEmployee?.jobTitle}
                </p>
              </div>
              {draft && (
                <button
                  onClick={() => setStep("review_draft")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                  style={{ background: "#065F46" }}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Draft Ready — Review
                </button>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1"
                      style={{ background: C.perf }}
                    >
                      <Bot className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}
                  <div
                    className="max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap"
                    style={
                      msg.role === "user"
                        ? {
                            background: C.userBg,
                            color: "#FFF",
                            borderBottomRightRadius: "4px",
                          }
                        : {
                            background: C.agentBg,
                            color: C.textDark,
                            borderBottomLeftRadius: "4px",
                          }
                    }
                  >
                    {/* Strip the raw <document> JSON — draft is surfaced via the button */}
                    {msg.content.replace(/<document>[\s\S]*?<\/document>/g, "").trim()}
                    {msg.role === "assistant" &&
                      i === messages.length - 1 &&
                      sending && (
                        <span
                          className="inline-block ml-1 w-1.5 h-4 animate-pulse"
                          style={{ background: C.perf }}
                        />
                      )}
                  </div>
                  {msg.role === "user" && (
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1"
                      style={{ background: "#E0F0F0" }}
                    >
                      <User className="w-3.5 h-3.5" style={{ color: C.perf }} />
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div
              className="px-5 py-4 shrink-0"
              style={{ borderTop: `1px solid ${C.border}` }}
            >
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Type your response…"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && !e.shiftKey && sendMessage(input)
                  }
                  disabled={sending}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none border"
                  style={{
                    background: C.agentBg,
                    borderColor: C.border,
                    color: C.textDark,
                  }}
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={sending || !input.trim()}
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white disabled:opacity-50 transition-opacity hover:opacity-90"
                  style={{ background: C.perf }}
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Review Draft */}
        {step === "review_draft" && draft && (
          <div
            className="rounded-2xl border overflow-hidden"
            style={{ background: C.card, borderColor: C.border }}
          >
            <div
              className="px-6 py-5 flex items-center justify-between"
              style={{ borderBottom: `1px solid ${C.border}` }}
            >
              <div>
                <h2 className="font-semibold text-lg" style={{ color: C.textDark }}>
                  Review Draft
                </h2>
                <p className="text-xs mt-0.5" style={{ color: C.textMuted }}>
                  Review before creating the case. You can edit individual sections in the case workspace.
                </p>
              </div>
              <button
                onClick={() => setStep("agent_chat")}
                className="text-xs hover:opacity-70"
                style={{ color: C.textMuted }}
              >
                ← Back to chat
              </button>
            </div>

            <div className="p-6 space-y-5">
              {(
                [
                  ["Document Purpose", draft.documentTypePurpose],
                  ["Incident Description", draft.incidentDescription],
                  ["Policy Violations", draft.policyViolations],
                  ["Impact & Consequences", draft.impactConsequences],
                  ["Prior Discipline History", draft.priorDisciplineHistory],
                  ["Expectations Going Forward", draft.expectationsGoingForward],
                  ["Consequences of Non-Compliance", draft.failureConsequences],
                  ["Additional Notes", draft.additionalNotes],
                ] as [string, string][]
              )
                .filter(([, content]) => content?.trim())
                .map(([label, content]) => (
                  <div key={label}>
                    <p
                      className="text-xs font-semibold uppercase tracking-wide mb-1.5"
                      style={{ color: C.textMuted }}
                    >
                      {label}
                    </p>
                    <div
                      className="rounded-xl p-4 text-sm leading-relaxed"
                      style={{ background: C.agentBg, color: C.textDark }}
                    >
                      {content}
                    </div>
                  </div>
                ))}
            </div>

            <div className="px-6 pb-6 flex justify-end gap-3">
              <button
                onClick={() => setStep("agent_chat")}
                className="px-5 py-2.5 rounded-xl text-sm font-medium border hover:bg-teal-50 transition-colors"
                style={{ borderColor: C.border, color: C.textDark }}
              >
                Request Changes
              </button>
              <button
                onClick={createCaseFromDraft}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60 hover:opacity-90 transition-opacity"
                style={{ background: C.perf }}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                Create Case
              </button>
            </div>
          </div>
        )}
      </div>
    </PiqLayout>
  );
}
