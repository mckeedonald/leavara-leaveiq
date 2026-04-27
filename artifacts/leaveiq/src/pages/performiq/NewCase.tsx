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
  FileText,
} from "lucide-react";
import { PiqLayout } from "@/components/performiq/PiqLayout";
import { piqApiFetch, usePiqAuth } from "@/lib/piqAuth";
import type { PiqDocumentContent } from "@workspace/db";

const C = {
  perf: "#2E7B7B",
  perfDark: "#2E4D80",
  card: "#FFFFFF",
  border: "#C4D9D9",
  textDark: "#1A3333",
  textMuted: "#6B9090",
  agentBg: "#F0F4FB",
  userBg: "#2E7B7B",
};

interface Employee { id: string; fullName: string; jobTitle: string; department: string; hireDate: string | null; }
interface DocType { id: string; displayLabel: string; baseType: string; }
interface Message { role: "user" | "assistant"; content: string; }

type Step = "select_employee" | "select_doc_type" | "agent_chat" | "review_draft";

export default function NewCase() {
  const { user } = usePiqAuth();
  const [, navigate] = useLocation();

  const [step, setStep] = useState<Step>("select_employee");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [docTypes, setDocTypes] = useState<DocType[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedDocType, setSelectedDocType] = useState<DocType | null>(null);
  const [empSearch, setEmpSearch] = useState("");

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState<PiqDocumentContent | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    piqApiFetch<Employee[]>("/api/performiq/employees?isActive=true").then(setEmployees).catch(() => {});
    piqApiFetch<DocType[]>("/api/performiq/admin/document-types").then(setDocTypes).catch(() => {});
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function startAgentSession() {
    try {
      const data = await piqApiFetch<{ sessionId: string }>("/api/performiq/agent/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: selectedEmployee?.id }),
      });
      setSessionId(data.sessionId);
      setStep("agent_chat");

      // Send the initial greeting prompt
      await sendMessage("Hello, I need to initiate a " + selectedDocType?.displayLabel + " for " + selectedEmployee?.fullName + ".", data.sessionId);
    } catch {
      setError("Failed to start agent session");
    }
  }

  async function sendMessage(text: string, sid?: string) {
    const activeSessionId = sid ?? sessionId;
    if (!activeSessionId || !text.trim() || sending) return;

    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    const assistantMsg: Message = { role: "assistant", content: "" };
    setMessages((prev) => [...prev, assistantMsg]);

    try {
      const res = await fetch(`/api/performiq/agent/sessions/${activeSessionId}/message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("performiq_token")}`,
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
      });

      if (!res.body) throw new Error("No stream");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        const lines = text.split("\n").filter((l) => l.startsWith("data: "));
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
              setDraft(event.draft);
            }
          } catch {}
        }
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "assistant", content: "Sorry, I encountered an error. Please try again." };
        return updated;
      });
    } finally {
      setSending(false);
    }
  }

  async function createCaseFromDraft() {
    if (!draft || !selectedEmployee || !selectedDocType || !sessionId) return;
    setSaving(true);
    try {
      const newCase = await piqApiFetch<{ id: string }>("/api/performiq/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: selectedEmployee.id,
          documentTypeId: selectedDocType.id,
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
      (e.department ?? "").toLowerCase().includes(empSearch.toLowerCase()),
  );

  const BASE_COLORS: Record<string, string> = {
    coaching: "#2E7B7B",
    written_warning: "#B45309",
    final_warning: "#B91C1C",
  };

  return (
    <PiqLayout>
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: C.textDark }}>New Performance Case</h1>
          <p className="text-sm mt-0.5" style={{ color: C.textMuted }}>
            Our AI Performance Specialist will guide you through the documentation process.
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {(["select_employee", "select_doc_type", "agent_chat", "review_draft"] as Step[]).map((s, i) => (
            <React.Fragment key={s}>
              <div
                className="flex items-center gap-2 text-xs font-medium"
                style={{ color: step === s ? C.perf : s < step ? "#065F46" : C.textMuted }}
              >
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{
                    background: step === s ? C.perf : s < step ? "#D1FAE5" : "#EDF1F8",
                    color: step === s ? "#FFF" : s < step ? "#065F46" : C.textMuted,
                  }}
                >
                  {i + 1}
                </span>
                <span className="hidden sm:block">
                  {s === "select_employee" ? "Employee" : s === "select_doc_type" ? "Type" : s === "agent_chat" ? "AI Intake" : "Review"}
                </span>
              </div>
              {i < 3 && <ChevronRight className="w-3 h-3 shrink-0" style={{ color: C.textMuted }} />}
            </React.Fragment>
          ))}
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl text-sm border flex items-center gap-2" style={{ background: "#FEE2E2", borderColor: "#FCA5A5", color: "#B91C1C" }}>
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Step 1: Select Employee */}
        {step === "select_employee" && (
          <div className="rounded-2xl border p-6" style={{ background: C.card, borderColor: C.border }}>
            <h2 className="font-semibold text-lg mb-4" style={{ color: C.textDark }}>Select Employee</h2>
            <input
              type="text"
              placeholder="Search by name or department…"
              value={empSearch}
              onChange={(e) => setEmpSearch(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl text-sm outline-none border mb-4"
              style={{ background: C.agentBg, borderColor: C.border, color: C.textDark }}
            />
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {filteredEmployees.map((e) => (
                <button
                  key={e.id}
                  onClick={() => {
                    setSelectedEmployee(e);
                    setStep("select_doc_type");
                  }}
                  className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-left transition-colors hover:bg-blue-50 border"
                  style={{ borderColor: C.border }}
                >
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: C.perf }}>
                    {e.fullName.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                  </div>
                  <div>
                    <p className="font-medium text-sm" style={{ color: C.textDark }}>{e.fullName}</p>
                    <p className="text-xs" style={{ color: C.textMuted }}>{e.jobTitle} · {e.department}</p>
                  </div>
                </button>
              ))}
              {filteredEmployees.length === 0 && (
                <p className="text-center py-6 text-sm" style={{ color: C.textMuted }}>No employees found</p>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Select Document Type */}
        {step === "select_doc_type" && (
          <div className="rounded-2xl border p-6" style={{ background: C.card, borderColor: C.border }}>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="font-semibold text-lg" style={{ color: C.textDark }}>Document Type</h2>
            </div>
            <p className="text-sm mb-6" style={{ color: C.textMuted }}>
              For: <strong style={{ color: C.textDark }}>{selectedEmployee?.fullName}</strong> · {selectedEmployee?.jobTitle}
            </p>
            <div className="space-y-3">
              {docTypes.map((dt) => {
                const color = BASE_COLORS[dt.baseType] ?? C.perf;
                return (
                  <button
                    key={dt.id}
                    onClick={() => {
                      setSelectedDocType(dt);
                      startAgentSession();
                    }}
                    className="w-full flex items-center gap-4 px-5 py-4 rounded-xl text-left transition-all hover:shadow-md border"
                    style={{ borderColor: C.border }}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: color + "18" }}>
                      <FileText className="w-5 h-5" style={{ color }} />
                    </div>
                    <div>
                      <p className="font-semibold text-sm" style={{ color: C.textDark }}>{dt.displayLabel}</p>
                      <p className="text-xs mt-0.5 capitalize" style={{ color }}>
                        {dt.baseType.replace(/_/g, " ")}
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 ml-auto shrink-0" style={{ color: C.textMuted }} />
                  </button>
                );
              })}
              {docTypes.length === 0 && (
                <p className="text-center py-8 text-sm" style={{ color: C.textMuted }}>
                  No document types configured. Ask your HR admin to set them up.
                </p>
              )}
            </div>
            <button onClick={() => setStep("select_employee")} className="mt-4 text-sm hover:opacity-70" style={{ color: C.textMuted }}>
              ← Back
            </button>
          </div>
        )}

        {/* Step 3: Agent Chat */}
        {step === "agent_chat" && (
          <div className="rounded-2xl border overflow-hidden flex flex-col" style={{ background: C.card, borderColor: C.border, height: "65vh" }}>
            {/* Chat header */}
            <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: `1px solid ${C.border}`, background: C.agentBg }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: C.perf }}>
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-sm" style={{ color: C.textDark }}>Performance Specialist</p>
                <p className="text-xs" style={{ color: C.textMuted }}>Powered by Claude AI</p>
              </div>
              {draft && (
                <button
                  onClick={() => setStep("review_draft")}
                  className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                  style={{ background: "#065F46" }}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Draft Ready — Review
                </button>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1" style={{ background: C.perf }}>
                      <Bot className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}
                  <div
                    className="max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap"
                    style={
                      msg.role === "user"
                        ? { background: C.userBg, color: "#FFF", borderBottomRightRadius: "4px" }
                        : { background: C.agentBg, color: C.textDark, borderBottomLeftRadius: "4px" }
                    }
                  >
                    {/* Hide the raw <document> JSON from the chat */}
                    {msg.content.replace(/<document>[\s\S]*?<\/document>/g, "")}
                    {msg.role === "assistant" && i === messages.length - 1 && sending && (
                      <span className="inline-block ml-1 w-1.5 h-4 animate-pulse" style={{ background: C.perf }} />
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1" style={{ background: "#E8EEF8" }}>
                      <User className="w-3.5 h-3.5" style={{ color: C.perf }} />
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-5 py-4" style={{ borderTop: `1px solid ${C.border}` }}>
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Type your response…"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
                  disabled={sending}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none border"
                  style={{ background: C.agentBg, borderColor: C.border, color: C.textDark }}
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={sending || !input.trim()}
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white disabled:opacity-50 transition-opacity hover:opacity-90"
                  style={{ background: C.perf }}
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Review Draft */}
        {step === "review_draft" && draft && (
          <div className="rounded-2xl border overflow-hidden" style={{ background: C.card, borderColor: C.border }}>
            <div className="px-6 py-5 flex items-center justify-between" style={{ borderBottom: `1px solid ${C.border}` }}>
              <div>
                <h2 className="font-semibold text-lg" style={{ color: C.textDark }}>Review AI-Generated Draft</h2>
                <p className="text-xs mt-0.5" style={{ color: C.textMuted }}>
                  Review and confirm before creating the case. You can edit sections in the case workspace.
                </p>
              </div>
              <button onClick={() => setStep("agent_chat")} className="text-xs hover:opacity-70" style={{ color: C.textMuted }}>
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
                ] as [string, string][]
              ).map(([label, content]) => (
                <div key={label}>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: C.textMuted }}>
                    {label}
                  </p>
                  <div className="rounded-xl p-4 text-sm leading-relaxed" style={{ background: C.agentBg, color: C.textDark }}>
                    {content || <span style={{ color: C.textMuted }}>Not provided</span>}
                  </div>
                </div>
              ))}
            </div>

            <div className="px-6 pb-6 flex justify-end gap-3">
              <button
                onClick={() => setStep("agent_chat")}
                className="px-5 py-2.5 rounded-xl text-sm font-medium border hover:bg-blue-50 transition-colors"
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
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Create Case
              </button>
            </div>
          </div>
        )}
      </div>
    </PiqLayout>
  );
}
