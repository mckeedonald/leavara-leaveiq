import React, { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { apiFetch } from "@/lib/auth";
import { Users, CalendarDays, Clock } from "lucide-react";
import { format, parseISO, isWithinInterval, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, addMonths, subMonths, isSameDay, isSameMonth } from "date-fns";

const S = {
  bg: "#F0EEE9",
  card: "#FFFFFF",
  border: "#D4C9BB",
  terracotta: "#C97E59",
  textDark: "#3D2010",
  textMid: "#7A5540",
  textMuted: "#A07860",
};

const LEAVE_TYPE_COLORS: Record<string, string> = {
  CFRA: "#C97E59",
  FMLA: "#A47864",
  PDL: "#E8872A",
  COMPANY_PERSONAL: "#9E5D38",
  OTHER: "#7A5540",
};

const STATE_LABELS: Record<string, string> = {
  INTAKE: "Intake",
  ELIGIBILITY_ANALYSIS: "Eligibility Review",
  HR_REVIEW_QUEUE: "HR Review",
  NOTICE_DRAFTED: "Notice Drafted",
  APPROVED: "Approved",
  DENIED: "Denied",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

interface LeaveCase {
  id: string;
  caseNumber: string;
  employeeName: string;
  leaveType: string;
  state: string;
  startDate: string | null;
  endDate: string | null;
}

function LeaveCalendar({ cases }: { cases: LeaveCase[] }) {
  const [current, setCurrent] = useState(new Date());
  const monthStart = startOfMonth(current);
  const monthEnd = endOfMonth(current);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  function casesForDay(day: Date): LeaveCase[] {
    return cases.filter((c) => {
      if (!c.startDate) return false;
      const start = parseISO(c.startDate);
      const end = c.endDate ? parseISO(c.endDate) : start;
      return isWithinInterval(day, { start, end });
    });
  }

  return (
    <div className="rounded-2xl p-5 shadow-sm" style={{ background: S.card, border: `1px solid ${S.border}` }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm" style={{ color: S.textDark }}>
          {format(current, "MMMM yyyy")}
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => setCurrent((d) => subMonths(d, 1))}
            className="px-2 py-1 rounded-lg text-xs hover:bg-black/5"
            style={{ color: S.textMuted }}
          >
            ‹
          </button>
          <button
            onClick={() => setCurrent(new Date())}
            className="px-2 py-1 rounded-lg text-xs hover:bg-black/5"
            style={{ color: S.terracotta }}
          >
            Today
          </button>
          <button
            onClick={() => setCurrent((d) => addMonths(d, 1))}
            className="px-2 py-1 rounded-lg text-xs hover:bg-black/5"
            style={{ color: S.textMuted }}
          >
            ›
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="text-center text-xs font-semibold py-1" style={{ color: S.textMuted }}>
            {d}
          </div>
        ))}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7 gap-px" style={{ background: S.border }}>
        {days.map((day) => {
          const daysCases = casesForDay(day);
          const isToday = isSameDay(day, new Date());
          const inMonth = isSameMonth(day, current);
          return (
            <div
              key={day.toISOString()}
              className="min-h-[72px] p-1 flex flex-col"
              style={{ background: S.card, opacity: inMonth ? 1 : 0.4 }}
            >
              <span
                className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1 self-end ${isToday ? "text-white" : ""}`}
                style={isToday ? { background: S.terracotta, color: "#fff" } : { color: S.textMid }}
              >
                {format(day, "d")}
              </span>
              <div className="space-y-0.5">
                {daysCases.slice(0, 2).map((c) => (
                  <div
                    key={c.id}
                    className="text-[9px] font-medium px-1 py-0.5 rounded truncate"
                    style={{
                      background: `${LEAVE_TYPE_COLORS[c.leaveType] ?? S.terracotta}22`,
                      color: LEAVE_TYPE_COLORS[c.leaveType] ?? S.terracotta,
                    }}
                    title={`${c.employeeName} — ${c.leaveType}`}
                  >
                    {c.employeeName.split(" ")[0]}
                  </div>
                ))}
                {daysCases.length > 2 && (
                  <div className="text-[9px] font-medium px-1" style={{ color: S.textMuted }}>
                    +{daysCases.length - 2} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-4 pt-3" style={{ borderTop: `1px solid ${S.border}` }}>
        {Object.entries(LEAVE_TYPE_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
            <span className="text-xs" style={{ color: S.textMuted }}>{type.replace(/_/g, " ")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ManagerDashboard() {
  const [cases, setCases] = useState<LeaveCase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ cases: LeaveCase[] }>("/api/cases?managerView=true")
      .then((d) => setCases(d.cases))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const activeCases = cases.filter((c) => !["CLOSED", "CANCELLED", "DENIED"].includes(c.state));

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: S.textDark }}>My Team's Leave</h1>
          <p className="text-sm mt-0.5" style={{ color: S.textMuted }}>
            View-only — {activeCases.length} active leave{activeCases.length !== 1 ? "s" : ""} in your reporting hierarchy
          </p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {[
            { icon: Users, label: "Active Leaves", value: activeCases.length, color: S.terracotta },
            {
              icon: CalendarDays,
              label: "Approved",
              value: cases.filter((c) => c.state === "APPROVED").length,
              color: "#16A34A",
            },
            {
              icon: Clock,
              label: "Pending HR Review",
              value: cases.filter((c) => ["INTAKE", "ELIGIBILITY_ANALYSIS", "HR_REVIEW_QUEUE"].includes(c.state)).length,
              color: "#D97706",
            },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="rounded-2xl p-5 flex items-center gap-4 shadow-sm" style={{ background: S.card, border: `1px solid ${S.border}` }}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}18` }}>
                <Icon className="w-5 h-5" style={{ color }} />
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: S.textDark }}>{value}</p>
                <p className="text-xs" style={{ color: S.textMuted }}>{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Calendar */}
        <div className="mb-6">
          <LeaveCalendar cases={activeCases} />
        </div>

        {/* Leave list */}
        <div className="rounded-2xl shadow-sm overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          <div className="px-5 py-4" style={{ borderBottom: `1px solid ${S.border}` }}>
            <h3 className="font-semibold text-sm" style={{ color: S.textDark }}>Team on Leave</h3>
          </div>
          {loading ? (
            <div className="py-10 text-center text-sm" style={{ color: S.textMuted }}>Loading…</div>
          ) : activeCases.length === 0 ? (
            <div className="py-10 text-center text-sm" style={{ color: S.textMuted }}>No active leaves in your team</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: S.bg, borderBottom: `1px solid ${S.border}` }}>
                  {["Employee", "Leave Type", "Start Date", "End Date", "Status"].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: S.textMuted }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeCases.map((c, i) => (
                  <tr key={c.id} style={i > 0 ? { borderTop: `1px solid ${S.border}` } : {}}>
                    <td className="px-5 py-3 font-medium" style={{ color: S.textDark }}>{c.employeeName}</td>
                    <td className="px-5 py-3">
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{
                          background: `${LEAVE_TYPE_COLORS[c.leaveType] ?? S.terracotta}20`,
                          color: LEAVE_TYPE_COLORS[c.leaveType] ?? S.terracotta,
                        }}
                      >
                        {c.leaveType?.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs" style={{ color: S.textMid }}>
                      {c.startDate ? format(parseISO(c.startDate), "MMM d, yyyy") : "—"}
                    </td>
                    <td className="px-5 py-3 text-xs" style={{ color: S.textMid }}>
                      {c.endDate ? format(parseISO(c.endDate), "MMM d, yyyy") : "Ongoing"}
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs font-medium" style={{ color: S.textMid }}>
                        {STATE_LABELS[c.state] ?? c.state}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
