/**
 * Employee e-signature page — publicly accessible via /performiq/sign?token=xxx
 * No authentication required.
 */
import React, { useEffect, useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Loader2, PenLine, FileText } from "lucide-react";

const C = {
  perf: "#2E7B7B",
  dark: "#1A3333",
  muted: "#6B9090",
  border: "#C4D9D9",
  bg: "#F7FAFA",
};

interface SignData {
  status: "ok" | "declined" | "completed" | "employee_signed" | "manager_signed";
  alreadySigned?: boolean;
  employeeComment?: string;
  caseNumber?: string;
  employeeName?: string;
  organizationName?: string;
  docLabel?: string;
  docText?: string;
  signatureId?: string;
}

export default function SignDocument() {
  const token = new URLSearchParams(window.location.search).get("token");

  const [data, setData] = useState<SignData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Signing state
  const [action, setAction] = useState<"sign" | "decline" | null>(null);
  const [signatureInput, setSignatureInput] = useState("");
  const [declineComment, setDeclineComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<"signed" | "declined" | null>(null);

  useEffect(() => {
    if (!token) { setError("No signing token found. Please use the link from your email."); setLoading(false); return; }
    fetch(`/api/piq/sign?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); }
        else { setData(d); }
      })
      .catch(() => setError("Failed to load document. Please try again."))
      .finally(() => setLoading(false));
  }, [token]);

  async function submitAction() {
    if (!token || !action) return;
    if (action === "sign" && !signatureInput.trim()) return;

    setSubmitting(true);
    try {
      const r = await fetch("/api/piq/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          action,
          signatureData: action === "sign" ? signatureInput.trim() : undefined,
          comment: action === "decline" ? declineComment.trim() : undefined,
        }),
      });
      const d = await r.json();
      if (d.error) { setError(d.error); return; }
      setResult(action);
    } catch {
      setError("Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: C.perf }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: C.bg }}>
        <div className="bg-white rounded-2xl border p-8 max-w-md w-full text-center shadow-sm" style={{ borderColor: "#FCA5A5" }}>
          <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-red-500" />
          <h2 className="text-lg font-bold mb-2" style={{ color: C.dark }}>Unable to Load Document</h2>
          <p className="text-sm" style={{ color: C.muted }}>{error}</p>
        </div>
      </div>
    );
  }

  // Already actioned
  if (data?.status === "declined") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: C.bg }}>
        <div className="bg-white rounded-2xl border p-8 max-w-md w-full text-center shadow-sm" style={{ borderColor: C.border }}>
          <XCircle className="w-10 h-10 mx-auto mb-3 text-amber-500" />
          <h2 className="text-lg font-bold mb-2" style={{ color: C.dark }}>Document Declined</h2>
          <p className="text-sm" style={{ color: C.muted }}>You have previously declined to sign this document.</p>
          {data.employeeComment && (
            <p className="text-sm mt-2 italic" style={{ color: C.muted }}>Your comment: "{data.employeeComment}"</p>
          )}
        </div>
      </div>
    );
  }

  if (data?.alreadySigned || data?.status === "completed" || data?.status === "manager_signed") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: C.bg }}>
        <div className="bg-white rounded-2xl border p-8 max-w-md w-full text-center shadow-sm" style={{ borderColor: "#BBF7D0" }}>
          <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-green-600" />
          <h2 className="text-lg font-bold mb-2" style={{ color: "#166534" }}>Already Signed</h2>
          <p className="text-sm" style={{ color: C.muted }}>You have already signed this document. Thank you!</p>
        </div>
      </div>
    );
  }

  if (data?.status === "employee_signed") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: C.bg }}>
        <div className="bg-white rounded-2xl border p-8 max-w-md w-full text-center shadow-sm" style={{ borderColor: "#BBF7D0" }}>
          <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-green-600" />
          <h2 className="text-lg font-bold mb-2" style={{ color: "#166534" }}>Already Signed</h2>
          <p className="text-sm" style={{ color: C.muted }}>Your signature has been recorded. HR will countersign to complete the process.</p>
        </div>
      </div>
    );
  }

  // Post-submit result
  if (result === "signed") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: C.bg }}>
        <div className="bg-white rounded-2xl border p-8 max-w-md w-full text-center shadow-sm" style={{ borderColor: "#BBF7D0" }}>
          <CheckCircle2 className="w-10 h-10 mx-auto mb-4 text-green-600" />
          <h2 className="text-xl font-bold mb-2" style={{ color: "#166534" }}>Document Signed</h2>
          <p className="text-sm" style={{ color: C.muted }}>
            Thank you, <strong>{data?.employeeName}</strong>. Your signature has been recorded.
          </p>
          <p className="text-sm mt-2" style={{ color: C.muted }}>
            HR will countersign and you will receive a copy of the completed document.
          </p>
          <div className="mt-4 p-3 rounded-xl text-xs" style={{ background: "#F0FDF4", color: "#166534" }}>
            Case: {data?.caseNumber}
          </div>
        </div>
      </div>
    );
  }

  if (result === "declined") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: C.bg }}>
        <div className="bg-white rounded-2xl border p-8 max-w-md w-full text-center shadow-sm" style={{ borderColor: C.border }}>
          <XCircle className="w-10 h-10 mx-auto mb-4 text-amber-500" />
          <h2 className="text-xl font-bold mb-2" style={{ color: C.dark }}>Decline Recorded</h2>
          <p className="text-sm" style={{ color: C.muted }}>
            Your decision to decline has been recorded. HR has been notified and will follow up.
          </p>
        </div>
      </div>
    );
  }

  // Main signing page
  return (
    <div className="min-h-screen p-4 md:p-8" style={{ background: C.bg }}>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl border p-6 mb-6 shadow-sm" style={{ borderColor: C.border }}>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `${C.perf}20` }}>
              <FileText className="w-6 h-6" style={{ color: C.perf }} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: C.muted }}>
                {data?.organizationName ?? "Leavara PerformIQ"}
              </p>
              <h1 className="text-xl font-bold" style={{ color: C.dark }}>{data?.docLabel ?? "Performance Document"}</h1>
              <p className="text-sm mt-1" style={{ color: C.muted }}>
                For review and signature — <strong>{data?.employeeName}</strong> · {data?.caseNumber}
              </p>
            </div>
          </div>
        </div>

        {/* Document content */}
        <div className="bg-white rounded-2xl border p-6 mb-6 shadow-sm" style={{ borderColor: C.border }}>
          <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: C.muted }}>Document</h2>
          <pre className="text-sm leading-relaxed whitespace-pre-wrap font-sans" style={{ color: C.dark }}>
            {data?.docText || "No document content available."}
          </pre>
        </div>

        {/* Action area */}
        {action === null && (
          <div className="bg-white rounded-2xl border p-6 shadow-sm" style={{ borderColor: C.border }}>
            <h2 className="font-semibold mb-2" style={{ color: C.dark }}>Your Signature</h2>
            <p className="text-sm mb-6" style={{ color: C.muted }}>
              By signing below, you acknowledge that you have read and received this document. Signing does not necessarily mean you agree with its contents.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setAction("sign")}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: C.perf }}
              >
                <PenLine className="w-4 h-4" /> Sign Document
              </button>
              <button
                onClick={() => setAction("decline")}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold border transition-colors hover:bg-red-50"
                style={{ borderColor: "#FCA5A5", color: "#B91C1C" }}
              >
                <XCircle className="w-4 h-4" /> Decline to Sign
              </button>
            </div>
          </div>
        )}

        {action === "sign" && (
          <div className="bg-white rounded-2xl border p-6 shadow-sm" style={{ borderColor: C.border }}>
            <h2 className="font-semibold mb-1" style={{ color: C.dark }}>Electronic Signature</h2>
            <p className="text-sm mb-4" style={{ color: C.muted }}>
              Type your full legal name to sign. This constitutes your electronic signature.
            </p>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold block mb-1.5" style={{ color: C.muted }}>
                  Full Name (as electronic signature)
                </label>
                <input
                  type="text"
                  value={signatureInput}
                  onChange={(e) => setSignatureInput(e.target.value)}
                  placeholder={data?.employeeName ?? "Your full name"}
                  className="w-full border rounded-xl px-4 py-3 text-lg outline-none focus:ring-2"
                  style={{
                    borderColor: C.border,
                    color: C.dark,
                    fontFamily: "Georgia, serif",
                    fontStyle: "italic",
                  }}
                />
              </div>
              <p className="text-xs" style={{ color: C.muted }}>
                By clicking "Sign Document", you agree that this electronic signature is the legal equivalent of your handwritten signature.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setAction(null)}
                  className="px-4 py-2.5 rounded-xl border text-sm font-medium"
                  style={{ borderColor: C.border, color: C.muted }}
                >
                  Back
                </button>
                <button
                  onClick={submitAction}
                  disabled={!signatureInput.trim() || submitting}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90"
                  style={{ background: C.perf }}
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <PenLine className="w-4 h-4" />}
                  {submitting ? "Signing…" : "Sign Document"}
                </button>
              </div>
            </div>
          </div>
        )}

        {action === "decline" && (
          <div className="bg-white rounded-2xl border p-6 shadow-sm" style={{ borderColor: "#FCA5A5" }}>
            <h2 className="font-semibold mb-1" style={{ color: "#B91C1C" }}>Decline to Sign</h2>
            <p className="text-sm mb-4" style={{ color: C.muted }}>
              Please provide a reason for declining (optional but recommended).
            </p>
            <div className="space-y-4">
              <textarea
                value={declineComment}
                onChange={(e) => setDeclineComment(e.target.value)}
                placeholder="Reason for declining (optional)…"
                rows={4}
                className="w-full border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 resize-none"
                style={{ borderColor: "#FCA5A5", color: C.dark }}
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setAction(null)}
                  className="px-4 py-2.5 rounded-xl border text-sm font-medium"
                  style={{ borderColor: C.border, color: C.muted }}
                >
                  Back
                </button>
                <button
                  onClick={submitAction}
                  disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                  style={{ background: "#B91C1C" }}
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                  {submitting ? "Submitting…" : "Confirm Decline"}
                </button>
              </div>
            </div>
          </div>
        )}

        <p className="text-center text-xs mt-6" style={{ color: C.muted }}>
          Powered by Leavara PerformIQ — Secure electronic document management
        </p>
      </div>
    </div>
  );
}
