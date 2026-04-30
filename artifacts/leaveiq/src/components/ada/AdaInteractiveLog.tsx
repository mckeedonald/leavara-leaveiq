/**
 * AdaInteractiveLog — Formal ADA interactive process log display.
 * Timestamped entries with clear sender identification for compliance documentation.
 */
import React, { useState } from "react";
import {
  FileText, User, Bot, Calendar, Stethoscope, CheckCircle,
  XCircle, Mail, ClipboardList, AlertCircle, ChevronDown, ChevronUp, Plus
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/auth";

export interface LogEntry {
  id: string;
  caseId: string;
  entryType: string;
  authorId?: string | null;
  authorName?: string | null;
  authorRole: "hr" | "employee" | "system";
  content: string;
  metadata?: string | null;
  createdAt: string;
}

const ENTRY_CONFIG: Record<string, {
  icon: React.ReactNode;
  label: string;
  bg: string;
  text: string;
  border: string;
}> = {
  hr_note:               { icon: <User className="w-4 h-4" />,          label: "HR Note",              bg: "#EFF6FF", text: "#1E40AF", border: "#BFDBFE" },
  employee_response:     { icon: <User className="w-4 h-4" />,          label: "Employee Response",    bg: "#F0FDF4", text: "#166534", border: "#BBF7D0" },
  meeting_record:        { icon: <Calendar className="w-4 h-4" />,      label: "Meeting Record",       bg: "#FFF7ED", text: "#92400E", border: "#FDE68A" },
  physician_cert_sent:   { icon: <Stethoscope className="w-4 h-4" />,   label: "Physician Cert Sent",  bg: "#F5F3FF", text: "#5B21B6", border: "#DDD6FE" },
  physician_cert_received:{ icon: <Stethoscope className="w-4 h-4" />,  label: "Physician Cert Received", bg: "#F0FDF4", text: "#166534", border: "#BBF7D0" },
  accommodation_approved:{ icon: <CheckCircle className="w-4 h-4" />,   label: "Accommodation Approved", bg: "#F0FDF4", text: "#166534", border: "#BBF7D0" },
  accommodation_denied:  { icon: <XCircle className="w-4 h-4" />,       label: "Accommodation Denied", bg: "#FEF2F2", text: "#991B1B", border: "#FECACA" },
  letter_sent:           { icon: <Mail className="w-4 h-4" />,          label: "Letter Sent",          bg: "#F0F9FF", text: "#075985", border: "#BAE6FD" },
  follow_up_scheduled:   { icon: <Calendar className="w-4 h-4" />,      label: "Follow-up Scheduled",  bg: "#FFF7ED", text: "#92400E", border: "#FDE68A" },
  jan_lookup:            { icon: <ClipboardList className="w-4 h-4" />, label: "JAN Research",         bg: "#F5F3FF", text: "#5B21B6", border: "#DDD6FE" },
  ada_determination:     { icon: <AlertCircle className="w-4 h-4" />,   label: "ADA Determination",    bg: "#FEF3C7", text: "#92400E", border: "#FDE68A" },
  ada_agent:             { icon: <Bot className="w-4 h-4" />,           label: "Ada Agent",            bg: "#F5F3FF", text: "#5B21B6", border: "#DDD6FE" },
};

function getConfig(entryType: string) {
  return ENTRY_CONFIG[entryType] ?? {
    icon: <FileText className="w-4 h-4" />,
    label: entryType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    bg: "#F9FAFB", text: "#374151", border: "#E5E7EB",
  };
}

function formatLogDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

interface AddEntryFormProps {
  caseId: string;
  onAdded: () => void;
}

function AddEntryForm({ caseId, onAdded }: AddEntryFormProps) {
  const [open, setOpen] = useState(false);
  const [entryType, setEntryType] = useState("hr_note");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSaving(true);
    try {
      await apiFetch(`/api/ada/cases/${caseId}/log`, {
        method: "POST",
        body: JSON.stringify({ entryType, content: content.trim() }),
      });
      setContent("");
      setOpen(false);
      onAdded();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-xl border transition-colors hover:bg-violet-50"
          style={{ borderColor: "#DDD6FE", color: "#5B21B6" }}
        >
          <Plus className="w-4 h-4" /> Add Log Entry
        </button>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border p-4 flex flex-col gap-3"
          style={{ borderColor: "#DDD6FE", background: "#FAFAFE" }}
        >
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs font-medium block mb-1" style={{ color: "#5B21B6" }}>Entry Type</label>
              <select
                value={entryType}
                onChange={(e) => setEntryType(e.target.value)}
                className="w-full text-sm border rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-violet-200"
                style={{ borderColor: "#DDD6FE" }}
              >
                {Object.entries(ENTRY_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: "#5B21B6" }}>Notes</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              placeholder="Document this step in the interactive process…"
              className="w-full text-sm border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-violet-200 resize-none"
              style={{ borderColor: "#DDD6FE" }}
              autoFocus
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-sm px-3 py-1.5 rounded-lg border hover:bg-gray-50 transition-colors"
              style={{ borderColor: "#D1D5DB", color: "#374151" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!content.trim() || saving}
              className="text-sm px-4 py-1.5 rounded-lg font-medium text-white disabled:opacity-50 transition-opacity"
              style={{ background: "#7C3AED" }}
            >
              {saving ? "Saving…" : "Add Entry"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

interface AdaInteractiveLogProps {
  entries: LogEntry[];
  caseId: string;
  onRefresh: () => void;
}

export function AdaInteractiveLog({ entries, caseId, onRefresh }: AdaInteractiveLogProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "#DDD6FE" }}>
      {/* Header */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-5 py-4 text-left transition-colors hover:bg-violet-50/50"
        style={{ background: "#F5F3FF", borderBottom: collapsed ? "none" : "1px solid #DDD6FE" }}
      >
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4" style={{ color: "#7C3AED" }} />
          <span className="font-semibold text-sm" style={{ color: "#4C1D95" }}>
            Interactive Process Log
          </span>
          <span
            className="ml-2 px-2 py-0.5 rounded-full text-xs font-bold"
            style={{ background: "#DDD6FE", color: "#5B21B6" }}
          >
            {entries.length}
          </span>
        </div>
        {collapsed
          ? <ChevronDown className="w-4 h-4" style={{ color: "#7C3AED" }} />
          : <ChevronUp className="w-4 h-4" style={{ color: "#7C3AED" }} />
        }
      </button>

      {!collapsed && (
        <div className="p-5 flex flex-col gap-4" style={{ background: "#FAFAFE" }}>
          {entries.length === 0 ? (
            <div className="text-center py-8 text-sm" style={{ color: "#6D28D9" }}>
              <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>No log entries yet. The interactive process log will appear here.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {entries.map((entry) => {
                const config = getConfig(entry.entryType);
                return (
                  <div
                    key={entry.id}
                    className="flex gap-3"
                  >
                    {/* Icon */}
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border mt-0.5"
                      style={{ background: config.bg, color: config.text, borderColor: config.border }}
                    >
                      {config.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded-full border"
                          style={{ background: config.bg, color: config.text, borderColor: config.border }}
                        >
                          {config.label}
                        </span>
                        <span className="text-xs font-medium text-foreground">
                          {entry.authorName ?? (entry.authorRole === "hr" ? "HR" : entry.authorRole === "system" ? "System" : "Employee")}
                        </span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground">{formatLogDate(entry.createdAt)}</span>
                      </div>
                      <div
                        className="text-sm leading-relaxed rounded-xl px-3 py-2 whitespace-pre-wrap"
                        style={{
                          background: "#FFFFFF",
                          border: `1px solid ${config.border}`,
                          color: "#1E1B4B",
                        }}
                      >
                        {entry.content}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <AddEntryForm caseId={caseId} onAdded={onRefresh} />
        </div>
      )}
    </div>
  );
}
