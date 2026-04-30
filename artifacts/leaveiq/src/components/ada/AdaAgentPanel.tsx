/**
 * AdaAgentPanel — Conversational panel for the Ada ADA accommodation agent.
 * HR interacts with Ada to navigate the interactive process, research accommodations,
 * draft letters, and schedule follow-ups.
 */
import React, { useState, useRef, useEffect } from "react";
import { ShieldCheck, Send, Loader2, BookOpen, Calendar, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/auth";

interface AdaMessage {
  role: "user" | "assistant";
  content: string;
}

interface AgentResponse {
  response: string;
  janLookupPerformed: boolean;
  actionSuggested?: string;
  suggestedFollowUpDate?: string;
}

interface AdaAgentPanelProps {
  caseId: string;
  onActionSuggested?: (action: string) => void;
  onFollowUpSuggested?: (date: string) => void;
}

export function AdaAgentPanel({ caseId, onActionSuggested, onFollowUpSuggested }: AdaAgentPanelProps) {
  const [history, setHistory] = useState<AdaMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [janToggle, setJanToggle] = useState(false);
  const [lastJanUsed, setLastJanUsed] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, isLoading]);

  const sendMessage = async () => {
    const msg = inputValue.trim();
    if (!msg || isLoading) return;

    const userMsg: AdaMessage = { role: "user", content: msg };
    const newHistory = [...history, userMsg];
    setHistory(newHistory);
    setInputValue("");
    setIsLoading(true);

    try {
      const result = await apiFetch<AgentResponse>(`/api/ada/cases/${caseId}/agent`, {
        method: "POST",
        body: JSON.stringify({
          message: msg,
          history: history, // send history without the new message (server appends it)
          lookupJan: janToggle,
        }),
      });

      const assistantMsg: AdaMessage = { role: "assistant", content: result.response };
      setHistory((prev) => [...prev, assistantMsg]);
      setLastJanUsed(result.janLookupPerformed);

      if (result.actionSuggested && onActionSuggested) {
        onActionSuggested(result.actionSuggested);
      }
      if (result.suggestedFollowUpDate && onFollowUpSuggested) {
        onFollowUpSuggested(result.suggestedFollowUpDate);
      }
    } catch (err) {
      setHistory((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "I encountered an issue processing your request. Please try again in a moment.",
        },
      ]);
    } finally {
      setIsLoading(false);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  };

  return (
    <div
      className="rounded-2xl border overflow-hidden flex flex-col"
      style={{ background: "#FAFAFA", borderColor: "#DDD6FE" }}
    >
      {/* Header */}
      <button
        onClick={() => setIsCollapsed((c) => !c)}
        className="flex items-center justify-between px-5 py-4 w-full text-left transition-colors hover:bg-violet-50/50"
        style={{ background: "#F5F3FF", borderBottom: isCollapsed ? "none" : "1px solid #DDD6FE" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm"
            style={{ background: "linear-gradient(135deg, #7C3AED, #A855F7)" }}
          >
            <ShieldCheck className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-semibold text-sm" style={{ color: "#4C1D95" }}>Ada — ADA Specialist</p>
            <p className="text-xs" style={{ color: "#7C3AED" }}>Interactive process guidance & accommodation research</p>
          </div>
        </div>
        {isCollapsed
          ? <ChevronDown className="w-4 h-4" style={{ color: "#7C3AED" }} />
          : <ChevronUp className="w-4 h-4" style={{ color: "#7C3AED" }} />
        }
      </button>

      {!isCollapsed && (
        <>
          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 min-h-[200px] max-h-[420px]">
            {history.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full py-8 text-center gap-2">
                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "#EDE9FE" }}>
                  <ShieldCheck className="w-6 h-6" style={{ color: "#7C3AED" }} />
                </div>
                <p className="font-medium text-sm" style={{ color: "#4C1D95" }}>Hi, I'm Ada</p>
                <p className="text-xs max-w-xs leading-relaxed" style={{ color: "#6D28D9" }}>
                  I'll guide you through the ADA interactive process — from reviewing this request and
                  researching accommodations, to drafting letters and scheduling follow-ups. How can I help?
                </p>
                <div className="flex flex-wrap justify-center gap-2 mt-3">
                  {[
                    "Review this accommodation request",
                    "Research accommodation options",
                    "Send physician certification",
                    "Draft an approval letter",
                  ].map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => {
                        setInputValue(prompt);
                        setTimeout(() => textareaRef.current?.focus(), 50);
                      }}
                      className="px-3 py-1.5 text-xs rounded-lg border transition-colors hover:bg-violet-50"
                      style={{ borderColor: "#DDD6FE", color: "#5B21B6", background: "#FFFFFF" }}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {history.map((msg, i) => (
              <div
                key={i}
                className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[90%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap shadow-sm",
                    msg.role === "user" ? "rounded-br-sm" : "rounded-bl-sm"
                  )}
                  style={
                    msg.role === "user"
                      ? { background: "#7C3AED", color: "#FFFFFF" }
                      : { background: "#FFFFFF", border: "1px solid #DDD6FE", color: "#1E1B4B" }
                  }
                >
                  {renderMarkdown(msg.content)}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div
                  className="px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-2 text-sm shadow-sm"
                  style={{ background: "#FFFFFF", border: "1px solid #DDD6FE", color: "#6D28D9" }}
                >
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {lastJanUsed ? "Looking up JAN accommodations…" : "Ada is thinking…"}
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* JAN lookup toggle */}
          <div
            className="flex items-center gap-3 px-4 py-2 border-t border-b"
            style={{ borderColor: "#EDE9FE", background: "#F5F3FF" }}
          >
            <BookOpen className="w-3.5 h-3.5 shrink-0" style={{ color: "#7C3AED" }} />
            <label className="flex items-center gap-2 cursor-pointer text-xs" style={{ color: "#5B21B6" }}>
              <input
                type="checkbox"
                checked={janToggle}
                onChange={(e) => setJanToggle(e.target.checked)}
                className="rounded"
                style={{ accentColor: "#7C3AED" }}
              />
              Always search JAN database for this message
            </label>
            <span className="ml-auto text-xs opacity-60" style={{ color: "#7C3AED" }}>askjan.org</span>
          </div>

          {/* Input */}
          <div className="p-3" style={{ background: "#FAFAFE" }}>
            <div
              className="flex flex-col gap-2 rounded-xl border px-3 py-2"
              style={{ borderColor: "#DDD6FE", background: "#FFFFFF" }}
            >
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Ask Ada about accommodations, the interactive process, letters…"
                rows={2}
                className="text-sm bg-transparent outline-none resize-none w-full"
                style={{ color: "#1E1B4B" }}
                disabled={isLoading}
              />
              <div className="flex justify-between items-center">
                <span className="text-xs opacity-50" style={{ color: "#7C3AED" }}>
                  Enter to send · Shift+Enter for new line
                </span>
                <button
                  onClick={sendMessage}
                  disabled={!inputValue.trim() || isLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-40 disabled:cursor-not-allowed transition-opacity hover:opacity-90"
                  style={{ background: "#7C3AED" }}
                >
                  <Send className="w-3 h-3" /> Send
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function renderMarkdown(text: string) {
  // Simple markdown: **bold**, *italic*, bullet lists
  const lines = text.split("\n");
  return lines.map((line, li) => {
    if (line.startsWith("- ") || line.startsWith("• ")) {
      return (
        <div key={li} className="flex gap-2">
          <span className="shrink-0 mt-1" style={{ color: "#7C3AED" }}>•</span>
          <span>{inlineMarkdown(line.slice(2))}</span>
        </div>
      );
    }
    if (line.startsWith("## ")) {
      return <p key={li} className="font-bold text-sm mt-2 first:mt-0">{inlineMarkdown(line.slice(3))}</p>;
    }
    if (line.startsWith("### ")) {
      return <p key={li} className="font-semibold text-xs mt-1.5 first:mt-0 uppercase tracking-wide opacity-70">{inlineMarkdown(line.slice(4))}</p>;
    }
    if (line === "") return <div key={li} className="h-2" />;
    return <p key={li}>{inlineMarkdown(line)}</p>;
  });
}

function inlineMarkdown(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={i}>{part.slice(1, -1)}</em>;
    return <span key={i}>{part}</span>;
  });
}
