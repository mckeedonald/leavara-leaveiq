import React, { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Bell, FileUp, LogIn, FilePlus, X } from "lucide-react";
import { apiFetch } from "@/lib/auth";

interface Notification {
  id: string;
  action: string;
  actor: string;
  createdAt: string;
  caseId: string;
  caseNumber: string;
  employeeFirstName: string | null;
  employeeLastName: string | null;
}

const STORAGE_KEY = "leaveiq_notifications_last_seen";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function notifLabel(n: Notification): { icon: React.ReactNode; text: string } {
  const name = [n.employeeFirstName, n.employeeLastName].filter(Boolean).join(" ") || "An employee";
  switch (n.action) {
    case "CASE_CREATED":
      return {
        icon: <FilePlus className="w-4 h-4 text-primary" />,
        text: `New case submitted — ${name} (${n.caseNumber})`,
      };
    case "EMPLOYEE_DOCUMENT_UPLOADED":
      return {
        icon: <FileUp className="w-4 h-4 text-violet-500" />,
        text: `${name} uploaded a document (${n.caseNumber})`,
      };
    case "EMPLOYEE_REPORTED_RTW":
      return {
        icon: <LogIn className="w-4 h-4 text-emerald-600" />,
        text: `${name} reported a return-to-work date (${n.caseNumber})`,
      };
    default:
      return { icon: <Bell className="w-4 h-4 text-muted-foreground" />, text: n.action };
  }
}

export function NotificationsDropdown() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastSeen, setLastSeen] = useState<number>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? parseInt(stored, 10) : 0;
  });
  const ref = useRef<HTMLDivElement>(null);
  const [, navigate] = useLocation();

  const unreadCount = notifications.filter(
    (n) => new Date(n.createdAt).getTime() > lastSeen
  ).length;

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ notifications: Notification[] }>("/api/notifications");
      setNotifications(data.notifications);
    } catch {
      // fail silently
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // poll every 30s
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleOpen() {
    setOpen((o) => !o);
  }

  function markAllRead() {
    const now = Date.now();
    localStorage.setItem(STORAGE_KEY, String(now));
    setLastSeen(now);
  }

  function handleNotifClick(caseId: string) {
    setOpen(false);
    navigate(`/cases/${caseId}`);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        className="p-2 rounded-full transition-colors relative hover:bg-black/5"
        style={{ color: "#8C7058" }}
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-80 rounded-2xl border bg-white shadow-xl z-50 overflow-hidden"
          style={{ borderColor: "#D4C9BB" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "#D4C9BB", background: "#FAF9F7" }}>
            <span className="font-semibold text-sm" style={{ color: "#3D2010" }}>Notifications</span>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-primary hover:underline"
                >
                  Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-0.5 rounded hover:bg-black/5" style={{ color: "#8C7058" }}>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="max-h-96 overflow-y-auto divide-y" style={{ divideColor: "#EDE9E3" }}>
            {loading && notifications.length === 0 && (
              <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
            )}
            {!loading && notifications.length === 0 && (
              <div className="py-10 text-center text-sm text-muted-foreground">No notifications yet.</div>
            )}
            {notifications.map((n) => {
              const { icon, text } = notifLabel(n);
              const isUnread = new Date(n.createdAt).getTime() > lastSeen;
              return (
                <button
                  key={n.id}
                  onClick={() => handleNotifClick(n.caseId)}
                  className={`w-full text-left flex items-start gap-3 px-4 py-3 transition-colors hover:bg-amber-50/60 ${isUnread ? "bg-amber-50/40" : ""}`}
                >
                  <div className="mt-0.5 flex-shrink-0 w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center">
                    {icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs leading-snug text-foreground">{text}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(n.createdAt)}</p>
                  </div>
                  {isUnread && (
                    <span className="mt-1.5 flex-shrink-0 w-2 h-2 rounded-full bg-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
