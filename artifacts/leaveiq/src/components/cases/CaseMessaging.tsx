import React, { useEffect, useRef, useState } from "react";
import { MessageSquare, Send, Loader2 } from "lucide-react";

export interface CaseMessage {
  id: string;
  senderType: "hr" | "employee";
  senderName: string;
  content: string;
  createdAt: string;
}

interface CaseMessagingProps {
  /** Fetch messages */
  fetchMessages: () => Promise<CaseMessage[]>;
  /** Send a message — return the created message */
  sendMessage: (content: string) => Promise<CaseMessage>;
  /** Who is currently viewing ("hr" | "employee") */
  viewerType: "hr" | "employee";
  /** Accent color (defaults to terracotta for LeaveIQ) */
  accentColor?: string;
  /** Border/card styles */
  borderColor?: string;
  cardBg?: string;
}

export function CaseMessaging({
  fetchMessages,
  sendMessage,
  viewerType,
  accentColor = "#C97E59",
  borderColor = "#E8DDD4",
  cardBg = "#FFFFFF",
}: CaseMessagingProps) {
  const [messages, setMessages] = useState<CaseMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMessages()
      .then(setMessages)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [fetchMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const msg = await sendMessage(text);
      setMessages((prev) => [...prev, msg]);
      setDraft("");
    } catch {
      // swallow — user can retry
    } finally {
      setSending(false);
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const isHrSide = (msg: CaseMessage) => msg.senderType === "hr";
  const isMine = (msg: CaseMessage) =>
    (viewerType === "hr" && msg.senderType === "hr") ||
    (viewerType === "employee" && msg.senderType === "employee");

  return (
    <div className="flex flex-col" style={{ minHeight: "300px" }}>
      <div
        className="flex items-center gap-2 px-4 py-3 border-b"
        style={{ borderColor, background: accentColor + "10" }}
      >
        <MessageSquare className="w-4 h-4" style={{ color: accentColor }} />
        <span className="font-semibold text-sm" style={{ color: "#3D2010" }}>Case Messages</span>
        <span className="ml-auto text-xs" style={{ color: "#8C7058" }}>
          {messages.length} {messages.length === 1 ? "message" : "messages"} · saved to case file
        </span>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ maxHeight: "380px", background: "#FAFAF8" }}>
        {loading ? (
          <div className="text-center py-8 text-xs" style={{ color: "#8C7058" }}>Loading messages…</div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="w-8 h-8 mx-auto mb-2" style={{ color: "#C4B8AE" }} />
            <p className="text-xs" style={{ color: "#8C7058" }}>
              No messages yet. Start a conversation — all messages are saved to the case file.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const mine = isMine(msg);
            return (
              <div key={msg.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className="max-w-xs lg:max-w-md rounded-2xl px-4 py-2.5 text-sm"
                  style={
                    mine
                      ? { background: accentColor, color: "#FFF", borderRadius: "18px 18px 4px 18px" }
                      : { background: "#FFF", color: "#3D2010", border: `1px solid ${borderColor}`, borderRadius: "18px 18px 18px 4px" }
                  }
                >
                  {!mine && (
                    <p className="text-xs font-semibold mb-1" style={{ color: accentColor }}>
                      {msg.senderName}
                    </p>
                  )}
                  <p className="leading-snug whitespace-pre-wrap">{msg.content}</p>
                  <p
                    className="text-xs mt-1 text-right"
                    style={{ color: mine ? "rgba(255,255,255,0.7)" : "#8C7058" }}
                  >
                    {new Date(msg.createdAt).toLocaleString(undefined, {
                      month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Compose */}
      <div className="border-t p-3 flex gap-2" style={{ borderColor, background: cardBg }}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Type a message… (Shift+Enter for new line)"
          rows={2}
          className="flex-1 px-3 py-2 text-sm rounded-xl border outline-none resize-none"
          style={{ borderColor, color: "#3D2010", background: "#FAFAF8" }}
        />
        <button
          onClick={handleSend}
          disabled={!draft.trim() || sending}
          className="px-3 py-2 rounded-xl text-white flex items-center gap-1.5 text-sm font-medium self-end disabled:opacity-50 transition-opacity"
          style={{ background: accentColor }}
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
