import React, { useState, useRef, useEffect } from "react";
import { EmployeeLayout } from "@/components/layout/EmployeeLayout";
import { Send, UserRound, User, CheckCircle, Loader2, RotateCcw, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

function getOrgSlug(): string {
  if (typeof window === "undefined") return "";
  const hostname = window.location.hostname;
  const parts = hostname.split(".");
  if (parts.length >= 3 && parts.slice(-2).join(".") === "leavara.net") {
    return parts[0];
  }
  return new URLSearchParams(window.location.search).get("org") ?? "";
}

type LeaveReason = "own_health" | "care_family" | "pregnancy_disability" | "bonding" | "military" | "personal";

interface ChatMessage {
  id: string;
  role: "bot" | "user";
  text: string;
  options?: { label: string; value: string }[];
  inputType?: "text" | "date" | "confirm";
}

type Step =
  | "welcome"
  | "employee_number"
  | "email"
  | "reason"
  | "start_date"
  | "end_date"
  | "intermittent"
  | "your_name"
  | "employee_email"
  | "summary"
  | "submitted";

interface IntakeData {
  employeeNumber?: string;
  employeeEmail?: string;
  leaveReasonCategory?: LeaveReason;
  requestedStart?: string;
  requestedEnd?: string | null;
  intermittent?: boolean;
  submittedBy?: string;
  employeeEmail?: string;
}

const REASON_OPTIONS = [
  { label: "Employee's Own Care", value: "own_health" },
  { label: "Care for a Family Member", value: "care_family" },
  { label: "Pregnancy Disability", value: "pregnancy_disability" },
  { label: "Bonding with a New Child", value: "bonding" },
  { label: "Military", value: "military" },
  { label: "Personal", value: "personal" },
];

const REASON_LABELS: Record<string, string> = {
  own_health: "Employee's Own Care",
  care_family: "Care for a Family Member",
  pregnancy_disability: "Pregnancy Disability",
  bonding: "Bonding with a New Child",
  military: "Military",
  personal: "Personal",
};

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function genId() {
  return Math.random().toString(36).slice(2);
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: "welcome-1",
    role: "bot",
    text: "👋 Hi! I'm Ava, your leave request assistant. I'll guide you through submitting a leave of absence request in just a few steps.",
  },
  {
    id: "welcome-2",
    role: "bot",
    text: "Your request will be reviewed by HR — they'll reach out once the analysis is complete. Ready to get started?",
    options: [{ label: "Yes, let's begin", value: "begin" }],
  },
];

export default function EmployeePortal() {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [step, setStep] = useState<Step>("welcome");
  const [data, setData] = useState<IntakeData>({});
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [caseNumber, setCaseNumber] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const addBotMessage = (text: string, opts?: Partial<Omit<ChatMessage, "id" | "role" | "text">>) => {
    const msg: ChatMessage = { id: genId(), role: "bot", text, ...opts };
    setMessages((prev) => [...prev, msg]);
  };

  const addUserMessage = (text: string) => {
    const msg: ChatMessage = { id: genId(), role: "user", text };
    setMessages((prev) => [...prev, msg]);
  };

  const botDelay = (fn: () => void, ms = 700) => {
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      fn();
    }, ms);
  };

  const handleOptionClick = (value: string, label: string) => {
    addUserMessage(label);

    if (step === "welcome") {
      botDelay(() => {
        addBotMessage("What is your employee number? (e.g., EMP-1023)", { inputType: "text" });
        setStep("employee_number");
        setTimeout(() => inputRef.current?.focus(), 100);
      });
      return;
    }

    if (step === "reason") {
      const reason = value as LeaveReason;
      setData((d) => ({ ...d, leaveReasonCategory: reason }));
      botDelay(() => {
        addBotMessage("Got it. When do you need your leave to start?", { inputType: "date" });
        setStep("start_date");
        setTimeout(() => inputRef.current?.focus(), 100);
      });
      return;
    }

    if (step === "end_date") {
      if (value === "no_end") {
        setData((d) => ({ ...d, requestedEnd: null }));
        botDelay(() => {
          addBotMessage(
            "Will this be intermittent leave? (e.g., a few hours or days at a time, rather than one continuous block)",
            {
              options: [
                { label: "Yes, intermittent", value: "yes" },
                { label: "No, continuous leave", value: "no" },
              ],
            }
          );
          setStep("intermittent");
        });
      }
      return;
    }

    if (step === "intermittent") {
      const intermittent = value === "yes";
      setData((d) => ({ ...d, intermittent }));
      botDelay(() => {
        addBotMessage("Almost done! What is your full name? (This is how your request will be submitted)", {
          inputType: "text",
        });
        setStep("your_name");
        setTimeout(() => inputRef.current?.focus(), 100);
      });
      return;
    }

    if (step === "summary") {
      if (value === "confirm") {
        submitCase();
      } else {
        // restart
        setMessages(INITIAL_MESSAGES);
        setStep("welcome");
        setData({});
        setInputValue("");
      }
      return;
    }
  };

  const handleTextSubmit = (value: string) => {
    if (!value.trim()) return;
    const trimmed = value.trim();
    addUserMessage(trimmed);
    setInputValue("");

    if (step === "employee_number") {
      setData((d) => ({ ...d, employeeNumber: trimmed }));
      botDelay(() => {
        addBotMessage(
          "What is your work or personal email address? HR will use this to send you required notices about your leave request.",
          { inputType: "text" }
        );
        setStep("email");
        setTimeout(() => inputRef.current?.focus(), 100);
      });
      return;
    }

    if (step === "email") {
      setData((d) => ({ ...d, employeeEmail: trimmed }));
      botDelay(() => {
        addBotMessage("What is the reason for your leave request?", {
          options: REASON_OPTIONS,
        });
        setStep("reason");
      });
      return;
    }

    if (step === "start_date") {
      if (!isValidDate(trimmed)) {
        botDelay(() => {
          addBotMessage("Please enter a valid date (e.g., 2026-04-15 or April 15, 2026).", { inputType: "date" });
          setTimeout(() => inputRef.current?.focus(), 100);
        }, 300);
        return;
      }
      const normalized = normalizeDate(trimmed);
      setData((d) => ({ ...d, requestedStart: normalized }));
      botDelay(() => {
        addBotMessage(
          `Do you know when you'll be returning? You can give an expected end date or say "not sure".`,
          {
            options: [{ label: "Not sure yet", value: "no_end" }],
            inputType: "date",
          }
        );
        setStep("end_date");
        setTimeout(() => inputRef.current?.focus(), 100);
      });
      return;
    }

    if (step === "end_date") {
      if (trimmed.toLowerCase().includes("not") || trimmed.toLowerCase().includes("sure") || trimmed.toLowerCase().includes("unknown")) {
        setData((d) => ({ ...d, requestedEnd: null }));
      } else if (isValidDate(trimmed)) {
        setData((d) => ({ ...d, requestedEnd: normalizeDate(trimmed) }));
      } else {
        botDelay(() => {
          addBotMessage(`Please enter a valid end date or click "Not sure yet".`, { inputType: "date" });
          setTimeout(() => inputRef.current?.focus(), 100);
        }, 300);
        return;
      }
      botDelay(() => {
        addBotMessage(
          "Will this be intermittent leave? (e.g., a few hours or days at a time, rather than one continuous block)",
          {
            options: [
              { label: "Yes, intermittent", value: "yes" },
              { label: "No, continuous leave", value: "no" },
            ],
          }
        );
        setStep("intermittent");
      });
      return;
    }

    if (step === "your_name") {
      setData((d) => ({ ...d, submittedBy: trimmed }));
      botDelay(() => {
        addBotMessage(
          "What is your work email address? HR will use this to send you leave notices and updates.",
          { inputType: "text" },
        );
        setStep("employee_email");
        setTimeout(() => inputRef.current?.focus(), 100);
      });
      return;
    }

    if (step === "employee_email") {
      if (!trimmed.includes("@") || !trimmed.includes(".")) {
        botDelay(() => {
          addBotMessage("Please enter a valid email address (e.g., jane@company.com).", { inputType: "text" });
          setTimeout(() => inputRef.current?.focus(), 100);
        }, 300);
        return;
      }
      setData((d) => ({ ...d, employeeEmail: trimmed }));
      const updated = { ...data, submittedBy: data.submittedBy, employeeEmail: trimmed };
      botDelay(() => {
        showSummary(updated);
      });
      return;
    }
  };

  const showSummary = (finalData: IntakeData) => {
    const lines = [
      `**Employee number:** ${finalData.employeeNumber}`,
      `**Email:** ${finalData.employeeEmail || "Not provided"}`,
      `**Reason:** ${REASON_LABELS[finalData.leaveReasonCategory ?? ""] ?? finalData.leaveReasonCategory}`,
      `**Start date:** ${formatDateDisplay(finalData.requestedStart ?? "")}`,
      `**End date:** ${finalData.requestedEnd ? formatDateDisplay(finalData.requestedEnd) : "Not specified"}`,
      `**Intermittent:** ${finalData.intermittent ? "Yes" : "No"}`,
      `**Submitted by:** ${finalData.submittedBy}`,
      `**Email:** ${finalData.employeeEmail}`,
    ];
    addBotMessage(
      `Here's a summary of your request:\n\n${lines.join("\n")}\n\nDoes everything look correct?`,
      {
        options: [
          { label: "✅ Submit my request", value: "confirm" },
          { label: "↩ Start over", value: "restart" },
        ],
      }
    );
    setStep("summary");
  };

  const submitCase = async () => {
    setIsTyping(true);
    try {
      const orgSlug = getOrgSlug();
      const url = orgSlug ? `/api/cases?org=${encodeURIComponent(orgSlug)}` : "/api/cases";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeNumber: data.employeeNumber!,
          employeeEmail: data.employeeEmail ?? undefined,
          requestedStart: data.requestedStart!,
          requestedEnd: data.requestedEnd ?? undefined,
          leaveReasonCategory: data.leaveReasonCategory! as string,
          intermittent: data.intermittent ?? false,
          submittedBy: data.submittedBy!,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error ?? "Submission failed");
      setIsTyping(false);
      const cn = (result as { caseNumber?: string }).caseNumber ?? "N/A";
      setCaseNumber(cn);
      addBotMessage(
        `🎉 Your leave request has been submitted successfully!\n\n**Case number: ${cn}**\n\nHR will review your eligibility and reach out to you. You'll typically hear back within 2–3 business days.`
      );
      setStep("submitted");
    } catch {
      setIsTyping(false);
      addBotMessage(
        "Hmm, something went wrong when submitting your request. Please try again or contact HR directly.",
        {
          options: [{ label: "Try again", value: "confirm" }],
        }
      );
    }
  };

  const isValidDate = (str: string) => {
    const d = new Date(str);
    return !isNaN(d.getTime());
  };

  const normalizeDate = (str: string): string => {
    // Use midday to avoid UTC/local timezone off-by-one issues
    const withTime = str.match(/^\d{4}-\d{2}-\d{2}$/) ? str + "T12:00:00" : str;
    const d = new Date(withTime);
    if (isNaN(d.getTime())) return str;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const currentInputType = messages.filter((m) => m.role === "bot").slice(-1)[0]?.inputType;

  return (
    <EmployeeLayout showBack>
      <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full px-4 py-6 gap-4">
        {/* Chat window */}
        <div className="flex-1 flex flex-col gap-4 overflow-y-auto min-h-0">
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              onOptionClick={handleOptionClick}
              disabled={step === "submitted" || isTyping}
            />
          ))}

          {isTyping && (
            <div className="flex items-end gap-2">
              <BotAvatar />
              <div className="bg-white shadow-sm rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5" style={{ border: "1px solid #D4C9BB" }}>
                <span className="w-2 h-2 rounded-full animate-bounce [animation-delay:0ms]" style={{ background: "#C8A888" }} />
                <span className="w-2 h-2 rounded-full animate-bounce [animation-delay:150ms]" style={{ background: "#C8A888" }} />
                <span className="w-2 h-2 rounded-full animate-bounce [animation-delay:300ms]" style={{ background: "#C8A888" }} />
              </div>
            </div>
          )}

          {step === "submitted" && caseNumber && (
            <div className="rounded-2xl p-5 flex flex-col gap-3 text-center mt-2 shadow-sm" style={{ background: "#FDF6F2", border: "1.5px solid #C97E5966" }}>
              <div className="flex items-center justify-center">
                <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "#C97E5922" }}>
                  <CheckCircle className="w-8 h-8" style={{ color: "#C97E59" }} />
                </div>
              </div>
              <p className="font-bold text-lg" style={{ color: "#3D2010" }}>Request Submitted</p>
              <p className="text-sm" style={{ color: "#5C3D28" }}>
                Case <span className="font-mono font-semibold" style={{ color: "#9E5D38" }}>{caseNumber}</span> has been created. HR will review and contact you soon.
              </p>
              <button
                onClick={() => {
                  setMessages(INITIAL_MESSAGES);
                  setStep("welcome");
                  setData({});
                  setInputValue("");
                  setCaseNumber(null);
                }}
                className="mx-auto flex items-center gap-2 text-sm font-medium underline underline-offset-2 hover:opacity-70 transition-opacity"
                style={{ color: "#A47864" }}
              >
                <RotateCcw className="w-4 h-4" /> Submit another request
              </button>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        {currentInputType && step !== "submitted" && !isTyping && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleTextSubmit(inputValue);
            }}
            className="flex items-center gap-2 bg-white rounded-2xl shadow-sm px-4 py-2 sticky bottom-0"
            style={{ border: "1px solid #D4C9BB" }}
          >
            <input
              ref={inputRef}
              type={step === "employee_email" ? "email" : "text"}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={
                currentInputType === "date"
                  ? "e.g. 2025-08-01 or August 1, 2025"
                  : step === "employee_number"
                  ? "e.g. EMP-1023"
                  : step === "email"
                  ? "your.email@company.com"
                  : step === "your_name"
                  ? "Your full name"
                  : step === "employee_email"
                  ? "your.name@company.com"
                  : "Type your answer…"
              }
              className="flex-1 text-sm bg-transparent outline-none py-1"
              style={{ color: "#3D2010" }}
              autoFocus
            />
            <button
              type="submit"
              disabled={!inputValue.trim()}
              className="disabled:opacity-40 disabled:cursor-not-allowed text-white p-2 rounded-xl transition-opacity hover:opacity-90"
              style={{ background: "#C97E59" }}
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </EmployeeLayout>
  );
}

function BotAvatar() {
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm" style={{ background: "#C97E59", boxShadow: "0 2px 6px #C97E5944" }}>
      <UserRound className="w-4 h-4 text-white" />
    </div>
  );
}

function MessageBubble({
  message,
  onOptionClick,
  disabled,
}: {
  message: ChatMessage;
  onOptionClick: (value: string, label: string) => void;
  disabled: boolean;
}) {
  const isBot = message.role === "bot";

  return (
    <div className={cn("flex items-end gap-2", isBot ? "" : "flex-row-reverse")}>
      {isBot ? (
        <BotAvatar />
      ) : (
        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm" style={{ background: "linear-gradient(135deg, #C97E59, #EAA292)" }}>
          <User className="w-4 h-4 text-white" />
        </div>
      )}

      <div className={cn("flex flex-col gap-2 max-w-[85%]", isBot ? "items-start" : "items-end")}>
        <div
          className={cn(
            "px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap shadow-sm",
            isBot ? "rounded-bl-sm" : "rounded-br-sm"
          )}
          style={
            isBot
              ? { background: "#FFFFFF", border: "1px solid #D4C9BB", color: "#3D2010" }
              : { background: "#C97E59", color: "#FFFFFF" }
          }
        >
          {renderText(message.text)}
        </div>

        {isBot && message.options && (
          <div className="flex flex-wrap gap-2 mt-1">
            {message.options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => !disabled && onOptionClick(opt.value, opt.label)}
                disabled={disabled}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-xl border transition-all",
                  disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:text-white"
                )}
                style={
                  disabled
                    ? { background: "#F7F4F0", borderColor: "#D4C9BB", color: "#8C7058" }
                    : { background: "#FFFFFF", borderColor: "#C97E5966", color: "#7A5540" }
                }
                onMouseEnter={(e) => { if (!disabled) { (e.currentTarget as HTMLButtonElement).style.background = "#C97E59"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#C97E59"; (e.currentTarget as HTMLButtonElement).style.color = "#FFFFFF"; } }}
                onMouseLeave={(e) => { if (!disabled) { (e.currentTarget as HTMLButtonElement).style.background = "#FFFFFF"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#C97E5966"; (e.currentTarget as HTMLButtonElement).style.color = "#7A5540"; } }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function renderText(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}
