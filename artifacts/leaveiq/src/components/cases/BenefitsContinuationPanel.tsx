import React, { useState, useCallback } from "react";
import { apiFetch } from "@/lib/auth";
import { useAuth } from "@/lib/auth";
import {
  Sparkles, Plus, Trash2, Send, Loader2, CheckCircle2, AlertTriangle, Mail, Edit3, Save,
} from "lucide-react";

interface Benefit {
  id: string;
  name: string;
  monthlyAmount: string;
}

interface GeneratedLetter {
  noticeType: string;
  title: string;
  content: string;
}

interface Props {
  caseId: string;
  employeeEmail?: string | null;
}

const COMMON_BENEFITS = [
  "Medical Insurance",
  "Dental Insurance",
  "Vision Insurance",
  "Life Insurance",
  "Short-Term Disability",
  "Long-Term Disability",
  "401(k) / Retirement",
  "FSA / HSA",
];

function uid() {
  return Math.random().toString(36).slice(2);
}

export function BenefitsContinuationPanel({ caseId, employeeEmail }: Props) {
  const { user } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const [benefits, setBenefits] = useState<Benefit[]>([
    { id: uid(), name: "Medical Insurance", monthlyAmount: "" },
  ]);
  const [generating, setGenerating] = useState(false);
  const [letter, setLetter] = useState<GeneratedLetter | null>(null);
  const [editedContent, setEditedContent] = useState("");
  const [genError, setGenError] = useState<string | null>(null);

  const [overrideEmail, setOverrideEmail] = useState(employeeEmail ?? "");
  const [sending, setSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  function addBenefit(name = "") {
    setBenefits((prev) => [...prev, { id: uid(), name, monthlyAmount: "" }]);
  }

  function removeBenefit(id: string) {
    setBenefits((prev) => prev.filter((b) => b.id !== id));
  }

  function updateBenefit(id: string, field: "name" | "monthlyAmount", value: string) {
    setBenefits((prev) => prev.map((b) => (b.id === id ? { ...b, [field]: value } : b)));
  }

  const totalMonthly = benefits.reduce((sum, b) => {
    const n = parseFloat(b.monthlyAmount);
    return sum + (isNaN(n) ? 0 : n);
  }, 0);

  const generate = useCallback(async () => {
    const filled = benefits.filter((b) => b.name.trim() && b.monthlyAmount.trim());
    if (filled.length === 0) return;
    setGenerating(true);
    setGenError(null);
    setLetter(null);
    setSendSuccess(false);
    setSendError(null);
    try {
      const data = await apiFetch<GeneratedLetter>(`/api/cases/${caseId}/benefits-continuation-letter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          benefits: filled.map((b) => ({ name: b.name, monthlyAmount: b.monthlyAmount })),
        }),
      });
      setLetter(data);
      setEditedContent(data.content);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }, [caseId, benefits]);

  const sendLetter = useCallback(async () => {
    if (!editedContent || !overrideEmail.trim()) return;
    setSending(true);
    setSendError(null);
    try {
      await apiFetch(`/api/cases/${caseId}/send-notices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notices: [{ noticeType: "BENEFITS_CONTINUATION", content: editedContent }],
          approvedBy: user?.email ?? "HR",
          employeeEmail: overrideEmail.trim(),
        }),
      });
      setSendSuccess(true);
      setLetter(null);
      setEditedContent("");
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }, [caseId, editedContent, overrideEmail, user?.email]);

  const canGenerate = benefits.some((b) => b.name.trim() && b.monthlyAmount.trim());

  return (
    <div
      className="border rounded-2xl overflow-hidden shadow-sm"
      style={{ background: "linear-gradient(135deg, #F0F7F4 0%, #E8F5F0 100%)", borderColor: "#A8D5C5" }}
    >
      {/* Header */}
      <button
        className="w-full flex items-center justify-between px-5 py-4 text-left"
        style={{ background: "linear-gradient(135deg, #2E7B7B 0%, #1F5858 100%)" }}
        onClick={() => setIsExpanded((v) => !v)}
      >
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-5 h-5 text-white" />
          <div>
            <p className="font-bold text-white text-base">Benefits Continuation Letter</p>
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.75)" }}>
              Enter benefits details — Ava will generate the letter
            </p>
          </div>
        </div>
        <span className="text-white/70 text-sm">{isExpanded ? "▲" : "▼"}</span>
      </button>

      {isExpanded && (
        <div className="p-5 space-y-5">
          {/* Benefits input table */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold" style={{ color: "#1A3333" }}>
                Continuing Benefits
              </p>
              <p className="text-xs font-medium" style={{ color: "#2E7B7B" }}>
                Total: ${totalMonthly.toFixed(2)}/month
              </p>
            </div>
            <div className="space-y-2">
              {benefits.map((b) => (
                <div key={b.id} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={b.name}
                    onChange={(e) => updateBenefit(b.id, "name", e.target.value)}
                    placeholder="Benefit name"
                    list="benefit-suggestions"
                    className="flex-1 px-3 py-2 text-sm border rounded-xl outline-none"
                    style={{ borderColor: "#A8D5C5", color: "#1A3333", background: "#FAFFFE" }}
                  />
                  <div className="flex items-center gap-1">
                    <span className="text-sm" style={{ color: "#6B9090" }}>$</span>
                    <input
                      type="number"
                      value={b.monthlyAmount}
                      onChange={(e) => updateBenefit(b.id, "monthlyAmount", e.target.value)}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      className="w-24 px-3 py-2 text-sm border rounded-xl outline-none"
                      style={{ borderColor: "#A8D5C5", color: "#1A3333", background: "#FAFFFE" }}
                    />
                    <span className="text-xs" style={{ color: "#6B9090" }}>/mo</span>
                  </div>
                  <button
                    onClick={() => removeBenefit(b.id)}
                    className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                    title="Remove"
                  >
                    <Trash2 className="w-3.5 h-3.5" style={{ color: "#9CA3AF" }} />
                  </button>
                </div>
              ))}
            </div>

            <datalist id="benefit-suggestions">
              {COMMON_BENEFITS.map((b) => <option key={b} value={b} />)}
            </datalist>

            <div className="flex gap-2 mt-3">
              <button
                onClick={() => addBenefit("")}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border transition-colors"
                style={{ borderColor: "#A8D5C5", color: "#2E7B7B", background: "#FAFFFE" }}
              >
                <Plus className="w-3.5 h-3.5" /> Add Benefit
              </button>
              {COMMON_BENEFITS.filter(
                (name) => !benefits.some((b) => b.name.toLowerCase() === name.toLowerCase())
              ).slice(0, 3).map((name) => (
                <button
                  key={name}
                  onClick={() => addBenefit(name)}
                  className="px-3 py-1.5 text-xs rounded-xl border transition-colors"
                  style={{ borderColor: "#A8D5C5", color: "#6B9090", background: "#FAFFFE" }}
                >
                  + {name.split(" ")[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Generate button */}
          {!letter && !generating && (
            <button
              onClick={generate}
              disabled={!canGenerate}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-opacity"
              style={{ background: "linear-gradient(135deg, #2E7B7B 0%, #1F5858 100%)" }}
            >
              <Sparkles className="w-4 h-4" /> Generate Benefits Continuation Letter
            </button>
          )}

          {generating && (
            <div className="flex items-center justify-center gap-2 py-4">
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#2E7B7B" }} />
              <p className="text-sm" style={{ color: "#2E7B7B" }}>Generating letter…</p>
            </div>
          )}

          {genError && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl border text-sm"
              style={{ background: "#FEF2F2", borderColor: "#FCA5A5", color: "#991B1B" }}>
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              {genError}
              <button onClick={generate} className="underline ml-auto shrink-0">Retry</button>
            </div>
          )}

          {sendSuccess && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl border text-sm"
              style={{ background: "#F0FDF4", borderColor: "#86EFAC", color: "#166534" }}>
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              Benefits continuation letter sent successfully to <strong>{overrideEmail}</strong>.
            </div>
          )}

          {/* Generated letter editor */}
          {letter && !sendSuccess && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold flex items-center gap-1.5" style={{ color: "#1A3333" }}>
                  <Edit3 className="w-3.5 h-3.5" /> Generated Letter — Review &amp; Edit
                </p>
                <button
                  onClick={generate}
                  className="text-xs flex items-center gap-1" style={{ color: "#6B9090" }}
                >
                  <Sparkles className="w-3 h-3" /> Regenerate
                </button>
              </div>
              <textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                rows={14}
                className="w-full px-3 py-2.5 text-sm border rounded-xl outline-none resize-y font-mono leading-relaxed"
                style={{ borderColor: "#A8D5C5", color: "#1A3333", background: "#FAFFFE" }}
              />

              {/* Email + send */}
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: "#1A3333" }}>
                  Employee Email
                </label>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 shrink-0" style={{ color: "#6B9090" }} />
                  <input
                    type="email"
                    value={overrideEmail}
                    onChange={(e) => setOverrideEmail(e.target.value)}
                    placeholder="employee@company.com"
                    className="flex-1 text-sm border rounded-xl px-3 py-2 outline-none"
                    style={{ borderColor: "#A8D5C5", color: "#1A3333", background: "#FAFFFE" }}
                  />
                </div>
              </div>

              {sendError && (
                <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-xl border"
                  style={{ background: "#FEF2F2", borderColor: "#FCA5A5", color: "#991B1B" }}>
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {sendError}
                </div>
              )}

              <button
                onClick={sendLetter}
                disabled={!editedContent || !overrideEmail.trim() || sending}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-opacity"
                style={{ background: "linear-gradient(135deg, #2E7B7B 0%, #1F5858 100%)" }}
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {sending ? "Sending…" : "Send to Employee"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
