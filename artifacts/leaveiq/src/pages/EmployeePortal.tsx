import React, { useState, useRef, useEffect } from "react";
import { EmployeeLayout } from "@/components/layout/EmployeeLayout";
import { Send, UserRound, User, CheckCircle, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOrgBranding } from "@/lib/useOrgBranding";

function getOrgSlug(): string {
  if (typeof window === "undefined") return "";
  const hostname = window.location.hostname;
  const parts = hostname.split(".");
  if (parts.length >= 3 && parts.slice(-2).join(".") === "leavara.net") {
    return parts[0];
  }
  return new URLSearchParams(window.location.search).get("org") ?? "";
}

interface ChatMessage {
  id: string;
  role: "bot" | "user";
  text: string;
  options?: { label: string; value: string }[];
  inputType?: "text" | "date" | "textarea";
}

type Branch = "leave" | "accommodation";

type Step =
  // Common
  | "welcome"
  | "choose_branch"
  | "employee_number"
  | "email"
  // Leave branch
  | "leave_reason"
  | "leave_reason_other"
  | "start_date"
  | "end_date"
  | "intermittent"
  | "leave_name"
  | "leave_summary"
  | "leave_submitted"
  // Accommodation branch
  | "ada_name"
  | "ada_limitation"
  | "ada_accommodation_requested"
  | "ada_is_temporary"
  | "ada_duration"
  | "ada_notes"
  | "ada_summary"
  | "ada_submitted";

interface IntakeData {
  // Common
  branch?: Branch;
  employeeNumber?: string;
  employeeEmail?: string;
  submittedBy?: string;
  // Leave
  leaveReasonCategory?: string;
  leaveReasonOther?: string;
  requestedStart?: string;
  requestedEnd?: string | null;
  intermittent?: boolean;
  // ADA
  functionalLimitations?: string;
  accommodationRequested?: string;
  isTemporary?: boolean;
  estimatedDuration?: string;
  additionalNotes?: string;
}

const LEAVE_REASON_OPTIONS = [
  { label: "My Own Health Condition", value: "own_health" },
  { label: "Caring for a Family Member", value: "care_family" },
  { label: "Pregnancy / Childbirth Disability", value: "pregnancy_disability" },
  { label: "Bonding with a New Child", value: "bonding" },
  { label: "Military / USERRA Leave", value: "military" },
  { label: "Bereavement Leave", value: "bereavement" },
  { label: "Jury Duty or Witness Leave", value: "jury_duty" },
  { label: "Another type of leave", value: "other" },
];

const REASON_LABELS: Record<string, string> = {
  own_health: "Employee's Own Health Condition",
  care_family: "Care for a Family Member",
  pregnancy_disability: "Pregnancy / Childbirth Disability",
  bonding: "Bonding with a New Child",
  military: "Military / USERRA Leave",
  bereavement: "Bereavement Leave",
  jury_duty: "Jury Duty or Witness Leave",
  other: "Other",
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
    text: "👋 Hi! I'm Ava, your leave and accommodations assistant. I'm here to help you submit a request — it only takes a few minutes, and your HR team will take it from there.",
  },
  {
    id: "welcome-2",
    role: "bot",
    text: "Once submitted, HR will review your request and reach out directly. Whenever you're ready, let's get started!",
    options: [{ label: "Let's begin", value: "begin" }],
  },
];

export default function EmployeePortal() {
  const { logoUrl: orgLogoUrl, orgName } = useOrgBranding();
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [step, setStep] = useState<Step>("welcome");
  const [data, setData] = useState<IntakeData>({});
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [caseNumber, setCaseNumber] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const addBotMessage = (text: string, opts?: Partial<Omit<ChatMessage, "id" | "role" | "text">>) => {
    setMessages((prev) => [...prev, { id: genId(), role: "bot", text, ...opts }]);
  };

  const addUserMessage = (text: string) => {
    setMessages((prev) => [...prev, { id: genId(), role: "user", text }]);
  };

  const botDelay = (fn: () => void, ms = 650) => {
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      fn();
    }, ms);
  };

  const focusInput = () => setTimeout(() => inputRef.current?.focus(), 100);

  // ─── Option click handler ─────────────────────────────────────────────────
  const handleOptionClick = (value: string, label: string) => {
    addUserMessage(label);

    // Welcome → ask leave or accommodation
    if (step === "welcome") {
      botDelay(() => {
        addBotMessage(
          "Are you looking to request a leave of absence, or are you seeking a workplace accommodation?",
          {
            options: [
              { label: "Request a Leave of Absence", value: "leave" },
              { label: "Request a Workplace Accommodation", value: "accommodation" },
            ],
          }
        );
        setStep("choose_branch");
      });
      return;
    }

    // Choose branch
    if (step === "choose_branch") {
      const branch = value as Branch;
      setData((d) => ({ ...d, branch }));
      botDelay(() => {
        addBotMessage("To start, what's your employee number?", { inputType: "text" });
        setStep("employee_number");
        focusInput();
      });
      return;
    }

    // Leave reason selected
    if (step === "leave_reason") {
      setData((d) => ({ ...d, leaveReasonCategory: value }));
      if (value === "other") {
        botDelay(() => {
          addBotMessage(
            "Of course! Could you briefly describe the type of leave you need? For example, domestic violence leave, school activities leave, organ donation leave, or something else.",
            { inputType: "text" }
          );
          setStep("leave_reason_other");
          focusInput();
        });
      } else {
        botDelay(() => {
          addBotMessage("Got it. What date do you need your leave to start?", { inputType: "date" });
          setStep("start_date");
          focusInput();
        });
      }
      return;
    }

    // End date "not sure yet"
    if (step === "end_date" && value === "no_end") {
      setData((d) => ({ ...d, requestedEnd: null }));
      botDelay(() => {
        addBotMessage(
          "No problem — we can revisit that later. Will this be intermittent leave? That means taking leave in separate blocks (like a few hours or days at a time) rather than all at once.",
          {
            options: [
              { label: "Yes, intermittent", value: "yes" },
              { label: "No, continuous", value: "no" },
            ],
          }
        );
        setStep("intermittent");
      });
      return;
    }

    // Intermittent
    if (step === "intermittent") {
      const intermittent = value === "yes";
      setData((d) => ({ ...d, intermittent }));
      botDelay(() => {
        addBotMessage(
          "Almost done! What's your full name so we can submit the request?",
          { inputType: "text" }
        );
        setStep("leave_name");
        focusInput();
      });
      return;
    }

    // Leave summary confirm/restart
    if (step === "leave_summary") {
      if (value === "confirm") {
        submitLeaveCase();
      } else {
        resetPortal();
      }
      return;
    }

    // ADA: is temporary
    if (step === "ada_is_temporary") {
      const isTemporary = value === "yes";
      setData((d) => ({ ...d, isTemporary }));
      if (isTemporary) {
        botDelay(() => {
          addBotMessage(
            "How long do you expect this limitation to last? (e.g., \"3 months\", \"6 weeks\", \"until after surgery\")",
            { inputType: "text" }
          );
          setStep("ada_duration");
          focusInput();
        });
      } else {
        botDelay(() => {
          addBotMessage(
            "Understood. Is there anything else you'd like HR to know about your situation — medical context, prior accommodations, or specific concerns? (Optional — press Enter to skip.)",
            { inputType: "textarea" }
          );
          setStep("ada_notes");
          focusInput();
        });
      }
      return;
    }

    // ADA summary confirm/restart
    if (step === "ada_summary") {
      if (value === "confirm") {
        submitAdaCase();
      } else {
        resetPortal();
      }
      return;
    }
  };

  // ─── Text submit handler ──────────────────────────────────────────────────
  const handleTextSubmit = (value: string) => {
    const trimmed = value.trim();

    // ada_notes allows empty submit (skip)
    if (!trimmed && step !== "ada_notes") return;
    addUserMessage(trimmed || "(no additional notes)");
    setInputValue("");

    if (step === "employee_number") {
      setData((d) => ({ ...d, employeeNumber: trimmed }));
      botDelay(() => {
        addBotMessage(
          "Thanks! What email address should HR use to send you updates?",
          { inputType: "text" }
        );
        setStep("email");
        focusInput();
      });
      return;
    }

    if (step === "email") {
      if (!trimmed.includes("@") || !trimmed.includes(".")) {
        botDelay(() => {
          addBotMessage(
            "Hmm, that doesn't look quite right. Could you enter a valid email address? (e.g., jane@company.com)",
            { inputType: "text" }
          );
          focusInput();
        }, 350);
        return;
      }
      setData((d) => ({ ...d, employeeEmail: trimmed }));
      const branch = data.branch;
      if (branch === "leave") {
        botDelay(() => {
          addBotMessage("What's the reason for your leave request?", {
            options: LEAVE_REASON_OPTIONS,
          });
          setStep("leave_reason");
        });
      } else {
        // accommodation branch → go to name
        botDelay(() => {
          addBotMessage(
            "What's your full name?",
            { inputType: "text" }
          );
          setStep("ada_name");
          focusInput();
        });
      }
      return;
    }

    // Leave branch: other reason description
    if (step === "leave_reason_other") {
      setData((d) => ({ ...d, leaveReasonOther: trimmed }));
      botDelay(() => {
        addBotMessage(
          `Got it — I'll note that as: "${trimmed}". HR will review the specifics with you.\n\nWhat date do you need your leave to start?`,
          { inputType: "date" }
        );
        setStep("start_date");
        focusInput();
      });
      return;
    }

    if (step === "start_date") {
      if (!isValidDate(trimmed)) {
        botDelay(() => {
          addBotMessage(
            "I couldn't quite parse that date. Try entering it like \"2026-08-01\" or \"August 1, 2026\".",
            { inputType: "date" }
          );
          focusInput();
        }, 350);
        return;
      }
      const normalized = normalizeDate(trimmed);
      setData((d) => ({ ...d, requestedStart: normalized }));
      botDelay(() => {
        addBotMessage(
          `Got it — ${formatDateDisplay(normalized)}. Do you have an expected return date, or is that still up in the air?`,
          {
            options: [{ label: "Not sure yet", value: "no_end" }],
            inputType: "date",
          }
        );
        setStep("end_date");
        focusInput();
      });
      return;
    }

    if (step === "end_date") {
      const lower = trimmed.toLowerCase();
      if (lower.includes("not") || lower.includes("sure") || lower.includes("unknown") || lower.includes("tbd") || lower.includes("unsure")) {
        setData((d) => ({ ...d, requestedEnd: null }));
      } else if (isValidDate(trimmed)) {
        setData((d) => ({ ...d, requestedEnd: normalizeDate(trimmed) }));
      } else {
        botDelay(() => {
          addBotMessage(
            `No worries if it's uncertain — click "Not sure yet" or enter a date like "2026-06-01".`,
            { inputType: "date" }
          );
          focusInput();
        }, 350);
        return;
      }
      botDelay(() => {
        addBotMessage(
          "Will this be intermittent leave? That means taking leave in separate blocks rather than all at once.",
          {
            options: [
              { label: "Yes, intermittent", value: "yes" },
              { label: "No, continuous", value: "no" },
            ],
          }
        );
        setStep("intermittent");
      });
      return;
    }

    if (step === "leave_name") {
      setData((prev) => {
        const updated = { ...prev, submittedBy: trimmed };
        botDelay(() => showLeaveSummary(updated));
        return updated;
      });
      return;
    }

    // ADA branch steps
    if (step === "ada_name") {
      setData((d) => ({ ...d, submittedBy: trimmed }));
      botDelay(() => {
        addBotMessage(
          `Thank you, ${trimmed.split(" ")[0]}. To help HR understand your situation, I have a few questions.\n\nFirst — can you describe the limitation or difficulty you're experiencing at work? Please focus on what you have trouble doing, rather than a diagnosis. For example: \"I have difficulty standing for more than 20 minutes\" or \"I struggle with concentrating in noisy environments.\"`,
          { inputType: "textarea" }
        );
        setStep("ada_limitation");
        focusInput();
      });
      return;
    }

    if (step === "ada_limitation") {
      if (!trimmed) {
        botDelay(() => {
          addBotMessage(
            "Please describe the limitation you're experiencing at work — this helps HR understand what type of accommodation may help.",
            { inputType: "textarea" }
          );
          focusInput();
        }, 350);
        return;
      }
      setData((d) => ({ ...d, functionalLimitations: trimmed }));
      botDelay(() => {
        addBotMessage(
          "Thank you for sharing that. What accommodation are you requesting? If you're not sure of the exact accommodation, describe what you think would help — HR and the accommodation process will work with you to identify the right solution.",
          { inputType: "textarea" }
        );
        setStep("ada_accommodation_requested");
        focusInput();
      });
      return;
    }

    if (step === "ada_accommodation_requested") {
      if (!trimmed) {
        botDelay(() => {
          addBotMessage(
            "What accommodation do you think would help with your limitation? If you're unsure, just describe what you need.",
            { inputType: "textarea" }
          );
          focusInput();
        }, 350);
        return;
      }
      setData((d) => ({ ...d, accommodationRequested: trimmed }));
      botDelay(() => {
        addBotMessage(
          "Is this limitation temporary (e.g., recovering from an injury or procedure) or is it an ongoing condition?",
          {
            options: [
              { label: "Temporary", value: "yes" },
              { label: "Ongoing / Permanent", value: "no" },
            ],
          }
        );
        setStep("ada_is_temporary");
      });
      return;
    }

    if (step === "ada_duration") {
      setData((d) => ({ ...d, estimatedDuration: trimmed }));
      botDelay(() => {
        addBotMessage(
          "Is there anything else you'd like HR to know — prior accommodations, specific concerns, or additional context? (Optional — press Enter or click Submit to skip.)",
          { inputType: "textarea" }
        );
        setStep("ada_notes");
        focusInput();
      });
      return;
    }

    if (step === "ada_notes") {
      setData((prev) => {
        const updated = { ...prev, additionalNotes: trimmed || undefined };
        botDelay(() => showAdaSummary(updated));
        return updated;
      });
      return;
    }
  };

  // ─── Summary builders ─────────────────────────────────────────────────────
  const showLeaveSummary = (finalData: IntakeData) => {
    const reasonLabel =
      finalData.leaveReasonCategory === "other"
        ? `Other — ${finalData.leaveReasonOther ?? "Not specified"}`
        : REASON_LABELS[finalData.leaveReasonCategory ?? ""] ?? finalData.leaveReasonCategory;

    const lines = [
      `**Employee number:** ${finalData.employeeNumber}`,
      `**Email:** ${finalData.employeeEmail ?? "Not provided"}`,
      `**Name:** ${finalData.submittedBy}`,
      `**Reason:** ${reasonLabel}`,
      `**Start date:** ${formatDateDisplay(finalData.requestedStart ?? "")}`,
      `**End date:** ${finalData.requestedEnd ? formatDateDisplay(finalData.requestedEnd) : "Not specified"}`,
      `**Intermittent:** ${finalData.intermittent ? "Yes" : "No"}`,
    ];
    addBotMessage(
      `Here's a summary of your leave request:\n\n${lines.join("\n")}\n\nDoes everything look correct?`,
      {
        options: [
          { label: "✅ Submit my request", value: "confirm" },
          { label: "↩ Start over", value: "restart" },
        ],
      }
    );
    setStep("leave_summary");
  };

  const showAdaSummary = (finalData: IntakeData) => {
    const lines = [
      `**Employee number:** ${finalData.employeeNumber}`,
      `**Email:** ${finalData.employeeEmail ?? "Not provided"}`,
      `**Name:** ${finalData.submittedBy}`,
      `**Limitation described:** ${finalData.functionalLimitations}`,
      `**Accommodation requested:** ${finalData.accommodationRequested}`,
      `**Temporary:** ${finalData.isTemporary ? `Yes${finalData.estimatedDuration ? ` (${finalData.estimatedDuration})` : ""}` : "No — ongoing"}`,
      finalData.additionalNotes ? `**Additional notes:** ${finalData.additionalNotes}` : null,
    ].filter(Boolean) as string[];

    addBotMessage(
      `Here's a summary of your accommodation request:\n\n${lines.join("\n")}\n\nHR will review this and reach out to begin the interactive process. Does everything look correct?`,
      {
        options: [
          { label: "✅ Submit my request", value: "confirm" },
          { label: "↩ Start over", value: "restart" },
        ],
      }
    );
    setStep("ada_summary");
  };

  // ─── Submit handlers ──────────────────────────────────────────────────────
  const submitLeaveCase = async () => {
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
          employeeFirstName: data.submittedBy?.split(" ")[0] ?? undefined,
          employeeLastName: data.submittedBy?.split(" ").slice(1).join(" ") || undefined,
          requestedStart: data.requestedStart!,
          requestedEnd: data.requestedEnd ?? undefined,
          leaveReasonCategory: data.leaveReasonCategory === "other"
            ? "other"
            : data.leaveReasonCategory!,
          leaveReasonOther: data.leaveReasonOther,
          intermittent: data.intermittent ?? false,
          submittedBy: data.submittedBy!,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error((result as { error?: string }).error ?? "Submission failed");
      setIsTyping(false);
      const submitted = result as { caseNumber?: string };
      const cn = submitted.caseNumber ?? "N/A";
      setCaseNumber(cn);
      addBotMessage(
        `🎉 You're all set! Your leave request has been submitted.\n\n**Case number: ${cn}**\n\nHR will review your eligibility and contact you — typically within 2–3 business days.\n\nIf you provided an email address, a confirmation has been sent there with a secure link to track your case and upload any supporting documents.`
      );
      setStep("leave_submitted");
    } catch {
      setIsTyping(false);
      addBotMessage(
        "Something went wrong when submitting your request. Please try again, or reach out to HR directly.",
        { options: [{ label: "Try again", value: "confirm" }] }
      );
    }
  };

  const submitAdaCase = async () => {
    setIsTyping(true);
    try {
      const orgSlug = getOrgSlug();
      const url = orgSlug ? `/api/ada/cases?org=${encodeURIComponent(orgSlug)}` : "/api/ada/cases";
      const firstName = data.submittedBy?.split(" ")[0] ?? "";
      const lastName = data.submittedBy?.split(" ").slice(1).join(" ") || "";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeNumber: data.employeeNumber!,
          employeeEmail: data.employeeEmail ?? undefined,
          employeeFirstName: firstName || undefined,
          employeeLastName: lastName || undefined,
          disabilityDescription: data.functionalLimitations,
          functionalLimitations: data.functionalLimitations,
          accommodationRequested: data.accommodationRequested,
          isTemporary: data.isTemporary ?? false,
          estimatedDuration: data.estimatedDuration,
          additionalNotes: data.additionalNotes,
          submittedBy: data.submittedBy!,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error((result as { error?: string }).error ?? "Submission failed");
      setIsTyping(false);
      const submitted = result as { caseNumber?: string };
      const cn = submitted.caseNumber ?? "N/A";
      setCaseNumber(cn);
      addBotMessage(
        `🎉 Your accommodation request has been submitted.\n\n**Case number: ${cn}**\n\nHR will review your request and reach out to begin the interactive process — typically within a few business days. No physician documentation is needed at this stage; HR will guide you through next steps.\n\nIf you provided an email address, a confirmation has been sent there with a secure link to track your case.`
      );
      setStep("ada_submitted");
    } catch {
      setIsTyping(false);
      addBotMessage(
        "Something went wrong when submitting your request. Please try again, or reach out to HR directly.",
        { options: [{ label: "Try again", value: "confirm" }] }
      );
    }
  };

  const resetPortal = () => {
    setMessages(INITIAL_MESSAGES);
    setStep("welcome");
    setData({});
    setInputValue("");
    setCaseNumber(null);
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const isValidDate = (str: string) => {
    const d = new Date(str);
    return !isNaN(d.getTime());
  };

  const normalizeDate = (str: string): string => {
    const withTime = str.match(/^\d{4}-\d{2}-\d{2}$/) ? str + "T12:00:00" : str;
    const d = new Date(withTime);
    if (isNaN(d.getTime())) return str;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const isSubmitted = step === "leave_submitted" || step === "ada_submitted";
  const lastBotMsg = [...messages].reverse().find((m) => m.role === "bot");
  const currentInputType = lastBotMsg?.inputType;
  const showInput = !!currentInputType && !isSubmitted && !isTyping;

  const inputPlaceholder = () => {
    if (currentInputType === "date") return "e.g. 2026-08-01 or August 1, 2026";
    if (currentInputType === "textarea") return "Type your answer… (Enter to submit)";
    switch (step) {
      case "employee_number": return "e.g. 1023";
      case "email": return "your.email@company.com";
      case "leave_name":
      case "ada_name": return "Your full name";
      default: return "Type your answer…";
    }
  };

  return (
    <EmployeeLayout showBack orgLogoUrl={orgLogoUrl} orgName={orgName}>
      <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full px-4 py-6 gap-4">
        {/* Chat window */}
        <div className="flex-1 flex flex-col gap-4 overflow-y-auto min-h-0">
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              onOptionClick={handleOptionClick}
              disabled={isSubmitted || isTyping}
            />
          ))}

          {isTyping && (
            <div className="flex items-end gap-2">
              <BotAvatar />
              <div
                className="bg-white shadow-sm rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5"
                style={{ border: "1px solid #D4C9BB" }}
              >
                <span className="w-2 h-2 rounded-full animate-bounce [animation-delay:0ms]" style={{ background: "#C8A888" }} />
                <span className="w-2 h-2 rounded-full animate-bounce [animation-delay:150ms]" style={{ background: "#C8A888" }} />
                <span className="w-2 h-2 rounded-full animate-bounce [animation-delay:300ms]" style={{ background: "#C8A888" }} />
              </div>
            </div>
          )}

          {isSubmitted && caseNumber && (
            <SubmittedCard
              caseNumber={caseNumber}
              email={data.employeeEmail}
              isAda={step === "ada_submitted"}
              onReset={resetPortal}
            />
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        {showInput && (
          currentInputType === "textarea" ? (
            <TextareaInput
              value={inputValue}
              onChange={setInputValue}
              onSubmit={() => handleTextSubmit(inputValue)}
              placeholder={inputPlaceholder()}
              allowEmpty={step === "ada_notes"}
              inputRef={inputRef as React.RefObject<HTMLTextAreaElement>}
            />
          ) : (
            <form
              onSubmit={(e) => { e.preventDefault(); handleTextSubmit(inputValue); }}
              className="flex items-center gap-2 bg-white rounded-2xl shadow-sm px-4 py-2 sticky bottom-0"
              style={{ border: "1px solid #D4C9BB" }}
            >
              <input
                ref={inputRef as React.RefObject<HTMLInputElement>}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={inputPlaceholder()}
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
          )
        )}
      </div>
    </EmployeeLayout>
  );
}

// ─── Textarea input component ──────────────────────────────────────────────
function TextareaInput({
  value,
  onChange,
  onSubmit,
  placeholder,
  allowEmpty,
  inputRef,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  placeholder: string;
  allowEmpty: boolean;
  inputRef: React.RefObject<HTMLTextAreaElement>;
}) {
  return (
    <div
      className="flex flex-col gap-2 bg-white rounded-2xl shadow-sm px-4 py-3 sticky bottom-0"
      style={{ border: "1px solid #D4C9BB" }}
    >
      <textarea
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (value.trim() || allowEmpty) onSubmit();
          }
        }}
        placeholder={placeholder}
        rows={3}
        className="flex-1 text-sm bg-transparent outline-none resize-none py-1 w-full"
        style={{ color: "#3D2010" }}
        autoFocus
      />
      <div className="flex justify-between items-center">
        <span className="text-xs" style={{ color: "#A47864" }}>
          {allowEmpty ? "Press Enter to submit, or skip" : "Shift+Enter for new line · Enter to submit"}
        </span>
        <button
          onClick={onSubmit}
          disabled={!value.trim() && !allowEmpty}
          className="disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-xl text-xs font-medium transition-opacity hover:opacity-90 flex items-center gap-1.5"
          style={{ background: "#C97E59" }}
        >
          <Send className="w-3 h-3" /> Submit
        </button>
      </div>
    </div>
  );
}

// ─── Submitted card ────────────────────────────────────────────────────────
function SubmittedCard({
  caseNumber,
  email,
  isAda,
  onReset,
}: {
  caseNumber: string;
  email?: string;
  isAda: boolean;
  onReset: () => void;
}) {
  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-3 text-center mt-2 shadow-sm"
      style={{ background: "#FDF6F2", border: "1.5px solid #C97E5966" }}
    >
      <div className="flex items-center justify-center">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center"
          style={{ background: "#C97E5922" }}
        >
          <CheckCircle className="w-8 h-8" style={{ color: "#C97E59" }} />
        </div>
      </div>
      <p className="font-bold text-lg" style={{ color: "#3D2010" }}>
        {isAda ? "Accommodation Request Submitted" : "Leave Request Submitted"}
      </p>
      <div
        className="rounded-xl px-4 py-3"
        style={{ background: "#F5E8DF", border: "1px solid #C97E5933" }}
      >
        <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "#A47864" }}>
          Your Case Number
        </p>
        <p className="font-mono font-bold text-xl" style={{ color: "#9E5D38" }}>
          {caseNumber}
        </p>
      </div>
      <p className="text-sm" style={{ color: "#5C3D28" }}>
        {isAda
          ? "HR will review your request and contact you to begin the interactive accommodation process — typically within 2–3 business days."
          : "HR will review your eligibility and contact you — typically within 2–3 business days."}
      </p>
      {email && (
        <p className="text-xs" style={{ color: "#A47864" }}>
          A confirmation with your secure case portal link has been sent to{" "}
          <strong>{email}</strong>. Check your inbox (and spam folder) for next steps.
        </p>
      )}
      <button
        onClick={onReset}
        className="mx-auto flex items-center gap-2 text-sm font-medium underline underline-offset-2 hover:opacity-70 transition-opacity"
        style={{ color: "#A47864" }}
      >
        <RotateCcw className="w-4 h-4" /> Submit another request
      </button>
    </div>
  );
}

// ─── Bot avatar ────────────────────────────────────────────────────────────
function BotAvatar() {
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm"
      style={{ background: "#C97E59", boxShadow: "0 2px 6px #C97E5944" }}
    >
      <UserRound className="w-4 h-4 text-white" />
    </div>
  );
}

// ─── Message bubble ────────────────────────────────────────────────────────
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
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm"
          style={{ background: "linear-gradient(135deg, #C97E59, #EAA292)" }}
        >
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
              <OptionButton
                key={opt.value}
                label={opt.label}
                value={opt.value}
                disabled={disabled}
                onClick={onOptionClick}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function OptionButton({
  label,
  value,
  disabled,
  onClick,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onClick: (value: string, label: string) => void;
}) {
  return (
    <button
      onClick={() => !disabled && onClick(value, label)}
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
      onMouseEnter={(e) => {
        if (!disabled) {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.background = "#C97E59";
          el.style.borderColor = "#C97E59";
          el.style.color = "#FFFFFF";
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.background = "#FFFFFF";
          el.style.borderColor = "#C97E5966";
          el.style.color = "#7A5540";
        }
      }}
    >
      {label}
    </button>
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
