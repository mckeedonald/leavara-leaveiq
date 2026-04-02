import React, { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";

const C = {
  bg:           "#F0EEE9",
  bgCard:       "#FAF8F5",
  khaki:        "#B8A992",
  mocha:        "#A47864",
  terracotta:   "#C97E59",
  terracottaDk: "#9E5D38",
  rose:         "#EAA292",
  textDark:     "#3D2010",
  textBody:     "#5C3D28",
  textMuted:    "#8C7058",
  border:       "#D4C9BB",
  inputBg:      "#F7F4F0",
  inputBorder:  "#C8BAA8",
  errorBg:      "#FDF0EE",
  errorBorder:  "#E8A898",
  errorText:    "#9E4030",
};

const COMPANY_SIZES = [
  "1 – 25 employees",
  "26 – 100 employees",
  "101 – 500 employees",
  "501 – 1,000 employees",
  "1,001 – 5,000 employees",
  "5,000+ employees",
];

interface FormData {
  companyName: string;
  contactName: string;
  title: string;
  email: string;
  phone: string;
  companySize: string;
  message: string;
}

const EMPTY: FormData = {
  companyName: "",
  contactName: "",
  title: "",
  email: "",
  phone: "",
  companySize: "",
  message: "",
};

export default function Interest() {
  const [form, setForm] = useState<FormData>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(field: keyof FormData) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm(prev => ({ ...prev, [field]: e.target.value }));
      setError(null);
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.companyName.trim() || !form.contactName.trim() || !form.email.trim() || !form.companySize) {
      setError("Please fill in all required fields.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Submission failed");
      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    borderRadius: 8,
    border: `1px solid ${C.inputBorder}`,
    background: C.inputBg,
    color: C.textDark,
    fontSize: 14,
    outline: "none",
    fontFamily: "Roboto, sans-serif",
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: C.bg, fontFamily: "Roboto, sans-serif" }}>
        <div className="w-full max-w-md text-center">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: C.terracotta + "20" }}>
            <CheckCircle2 className="w-10 h-10" style={{ color: C.terracotta }} />
          </div>
          <img src="/leavara-logo.png" alt="Leavara" className="h-10 w-10 object-contain mx-auto mb-3" />
          <h1 className="text-2xl font-bold mb-3" style={{ color: C.textDark }}>Thank You!</h1>
          <p className="text-base mb-2" style={{ color: C.textBody }}>
            We've received your interest in Leavara LeaveIQ.
          </p>
          <p className="text-sm mb-8" style={{ color: C.textMuted }}>
            A member of our team will be in touch with you shortly to discuss how LeaveIQ can support your HR team.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium hover:opacity-80 transition-opacity"
            style={{ color: C.terracotta }}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Leavara
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: C.bg, fontFamily: "Roboto, sans-serif" }}>
      <header className="sticky top-0 z-50 border-b shadow-sm" style={{ background: `${C.bg}f5`, borderColor: C.khaki }}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/leavara-logo.png" alt="Leavara" className="h-8 w-8 object-contain" />
            <span className="font-bold text-lg" style={{ color: C.textDark }}>
              Leavara <span style={{ color: C.terracottaDk }}>LeaveIQ</span>
            </span>
          </Link>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm font-medium hover:opacity-70 transition-opacity"
            style={{ color: C.textBody }}
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center px-6 py-14">
        <div className="w-full max-w-xl">
          <div className="mb-8">
            <img src="/leavara-logo.png" alt="Leavara" className="h-12 w-12 object-contain mb-4" />
            <h1 className="text-3xl font-bold mb-2" style={{ color: C.textDark }}>Get Started with LeaveIQ</h1>
            <p style={{ color: C.textBody }}>
              Tell us a bit about your organization and we'll reach out to show you how Leavara LeaveIQ can streamline your leave of absence management.
            </p>
          </div>

          <div className="rounded-2xl border p-8 shadow-sm" style={{ background: C.bgCard, borderColor: C.border }}>
            {error && (
              <div className="mb-5 px-4 py-3 rounded-lg text-sm border" style={{ background: C.errorBg, borderColor: C.errorBorder, color: C.errorText }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: C.textBody }}>
                    Company Name <span style={{ color: C.terracotta }}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Acme Corporation"
                    value={form.companyName}
                    onChange={set("companyName")}
                    required
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: C.textBody }}>
                    Company Size <span style={{ color: C.terracotta }}>*</span>
                  </label>
                  <select
                    value={form.companySize}
                    onChange={set("companySize")}
                    required
                    style={{ ...inputStyle, appearance: "none" }}
                  >
                    <option value="">Select size…</option>
                    {COMPANY_SIZES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: C.textBody }}>
                    Your Name <span style={{ color: C.terracotta }}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Jane Smith"
                    value={form.contactName}
                    onChange={set("contactName")}
                    required
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: C.textBody }}>
                    Your Title
                  </label>
                  <input
                    type="text"
                    placeholder="HR Director"
                    value={form.title}
                    onChange={set("title")}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: C.textBody }}>
                    Work Email <span style={{ color: C.terracotta }}>*</span>
                  </label>
                  <input
                    type="email"
                    placeholder="jane@company.com"
                    value={form.email}
                    onChange={set("email")}
                    required
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: C.textBody }}>
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="(555) 000-0000"
                    value={form.phone}
                    onChange={set("phone")}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: C.textBody }}>
                  Anything else you'd like us to know?
                </label>
                <textarea
                  placeholder="Tell us about your current leave management process or any questions you have…"
                  value={form.message}
                  onChange={set("message")}
                  rows={4}
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ background: C.terracotta }}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  "Request Information"
                )}
              </button>

              <p className="text-xs text-center" style={{ color: C.textMuted }}>
                We respect your privacy. Your information is only used to contact you about LeaveIQ.
              </p>
            </form>
          </div>
        </div>
      </main>

      <footer className="border-t py-6 text-center text-xs" style={{ background: C.terracotta, borderColor: C.terracotta, color: C.bg + "bb" }}>
        © {new Date().getFullYear()} Leavara, LLC · All rights reserved.
      </footer>
    </div>
  );
}
