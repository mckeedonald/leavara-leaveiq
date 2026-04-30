import React, { useState, useMemo } from "react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { apiFetch } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, CalendarDays, Loader2, AlertTriangle, ShieldCheck } from "lucide-react";
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  addMonths,
  subMonths,
  isSameMonth,
  differenceInDays,
  parseISO,
  max as dateMax,
  min as dateMin,
} from "date-fns";
import { cn } from "@/lib/utils";

// ── Leave calendar types ───────────────────────────────────────────────────────
interface CalendarCase {
  caseId: string;
  caseNumber: string;
  employeeFirstName: string | null;
  employeeLastName: string | null;
  leaveReasonCategory: string;
  requestedStart: string;
  requestedEnd: string | null;
  state: string;
  intermittent: boolean;
}

// ── Accommodation calendar types ───────────────────────────────────────────────
interface CalendarAccommodation {
  id: string;
  caseId: string;
  caseNumber: string;
  description: string;
  category?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  isOngoing: boolean;
  calendarLabel?: string | null;
  isActive: boolean;
}

// ── Color palettes ─────────────────────────────────────────────────────────────
const PROGRAM_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  own_health:           { bg: "#DBEAFE", text: "#1E40AF", border: "#BFDBFE" },
  care_family:          { bg: "#D1FAE5", text: "#065F46", border: "#A7F3D0" },
  pregnancy_disability: { bg: "#EDE9FE", text: "#5B21B6", border: "#DDD6FE" },
  bonding:              { bg: "#FEF3C7", text: "#92400E", border: "#FDE68A" },
  personal:             { bg: "#FFE4D6", text: "#9E5D38", border: "#FDBA74" },
  military:             { bg: "#F1F5F9", text: "#334155", border: "#CBD5E1" },
  bereavement:          { bg: "#F5F3FF", text: "#5B21B6", border: "#DDD6FE" },
  jury_duty:            { bg: "#FEF9C3", text: "#713F12", border: "#FDE68A" },
  other:                { bg: "#F0FDFA", text: "#065F46", border: "#99F6E4" },
};

const REASON_LABELS: Record<string, string> = {
  own_health: "Own Health",
  care_family: "Family Care",
  pregnancy_disability: "Pregnancy Disability",
  bonding: "Bonding",
  personal: "Personal",
  military: "Military",
  bereavement: "Bereavement",
  jury_duty: "Jury Duty",
  other: "Other Leave",
};

// Purple shades for accommodations
const ADA_LEAVE_COLORS     = { bg: "#EDE9FE", text: "#5B21B6", border: "#DDD6FE" };
const ADA_ONGOING_COLORS   = { bg: "#F5F3FF", text: "#7C3AED", border: "#C4B5FD" };

// ── Helpers ────────────────────────────────────────────────────────────────────
function employeeName(c: CalendarCase): string {
  return [c.employeeFirstName, c.employeeLastName].filter(Boolean).join(" ") || c.caseNumber;
}

function getBarOffsets(
  startIso: string,
  endIso: string | null,
  monthStart: Date,
  monthEnd: Date,
  totalDays: number
) {
  const start = dateMax([parseISO(startIso), monthStart]);
  const end = endIso ? dateMin([parseISO(endIso), monthEnd]) : monthEnd;
  const startOffset = differenceInDays(start, monthStart);
  const duration = differenceInDays(end, start) + 1;
  const leftPct = (startOffset / totalDays) * 100;
  const widthPct = (duration / totalDays) * 100;
  return { leftPct, widthPct };
}

// ── Calendar grid component ────────────────────────────────────────────────────
function CalendarGrid({ days, children }: { days: Date[]; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
      {/* Day header */}
      <div className="border-b bg-slate-50">
        <div className="flex" style={{ paddingLeft: "200px" }}>
          {days.map((day) => (
            <div
              key={day.toISOString()}
              className="flex-1 text-center py-2 text-xs font-semibold border-l first:border-l-0"
              style={{ color: "#5C3D28", borderColor: "#E5E0D8" }}
            >
              <span className="hidden sm:block">{format(day, "d")}</span>
              <span className="sm:hidden">{format(day, "d")}</span>
            </div>
          ))}
        </div>
      </div>
      {children}
    </div>
  );
}

// ── Leave Calendar tab ─────────────────────────────────────────────────────────
function LeaveCalendarTab({
  currentMonth,
  days,
  monthStart,
  monthEnd,
}: {
  currentMonth: Date;
  days: Date[];
  monthStart: Date;
  monthEnd: Date;
}) {
  const startStr = format(monthStart, "yyyy-MM-dd");
  const endStr = format(monthEnd, "yyyy-MM-dd");
  const totalDays = days.length;

  const { data, isLoading, error } = useQuery({
    queryKey: ["cases-calendar", startStr, endStr],
    queryFn: () => apiFetch<{ cases: CalendarCase[] }>(`/api/cases/calendar?start=${startStr}&end=${endStr}`),
  });

  const sorted = useMemo(
    () => [...(data?.cases ?? [])].sort((a, b) => a.requestedStart.localeCompare(b.requestedStart)),
    [data]
  );

  if (isLoading) return <CalendarLoading />;
  if (error) return <CalendarError />;

  return (
    <>
      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-6">
        {Object.entries(REASON_LABELS).map(([key, label]) => {
          const c = PROGRAM_COLORS[key] ?? PROGRAM_COLORS.personal;
          return (
            <div key={key} className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <span className="w-3 h-3 rounded-sm" style={{ background: c.bg, border: `1.5px solid ${c.border}` }} />
              {label}
            </div>
          );
        })}
      </div>

      <CalendarGrid days={days}>
        {sorted.length === 0 ? (
          <EmptyCalendar label={`No active leaves in ${format(currentMonth, "MMMM yyyy")}`} />
        ) : (
          sorted.map((c) => {
            const colors = PROGRAM_COLORS[c.leaveReasonCategory] ?? PROGRAM_COLORS.personal;
            const { leftPct, widthPct } = getBarOffsets(c.requestedStart, c.requestedEnd, monthStart, monthEnd, totalDays);
            const name = employeeName(c);
            return (
              <div
                key={c.caseId}
                className="flex items-center border-t hover:bg-slate-50/50 transition-colors"
                style={{ minHeight: "52px", borderColor: "#E5E0D8" }}
              >
                <div
                  className="shrink-0 px-4 py-2 text-sm font-medium truncate border-r"
                  style={{ width: "200px", borderColor: "#E5E0D8", color: "#3D2010" }}
                  title={name}
                >
                  <p className="truncate">{name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {REASON_LABELS[c.leaveReasonCategory] ?? c.leaveReasonCategory}
                  </p>
                </div>
                <div className="flex-1 relative h-10 mx-1">
                  <Link href={`/leaveiq/cases/${c.caseId}`}>
                    <div
                      className="absolute top-1 h-8 rounded-lg flex items-center px-2 overflow-hidden cursor-pointer transition-opacity hover:opacity-80"
                      style={{
                        left: `${leftPct}%`,
                        width: `${Math.max(widthPct, 2)}%`,
                        background: colors.bg,
                        border: `1.5px solid ${colors.border}`,
                      }}
                      title={`${c.caseNumber} · ${name}`}
                    >
                      <span className="text-xs font-semibold truncate" style={{ color: colors.text }}>
                        {c.caseNumber}
                      </span>
                      {c.intermittent && (
                        <span
                          className="ml-1 text-[9px] font-bold uppercase shrink-0 px-1 rounded"
                          style={{ background: colors.border, color: colors.text }}
                        >
                          INT
                        </span>
                      )}
                    </div>
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </CalendarGrid>
    </>
  );
}

// ── Accommodations Calendar tab ────────────────────────────────────────────────
function AccommodationsCalendarTab({
  currentMonth,
  days,
  monthStart,
  monthEnd,
}: {
  currentMonth: Date;
  days: Date[];
  monthStart: Date;
  monthEnd: Date;
}) {
  const startStr = format(monthStart, "yyyy-MM-dd");
  const endStr = format(monthEnd, "yyyy-MM-dd");
  const totalDays = days.length;

  const { data, isLoading, error } = useQuery({
    queryKey: ["ada-calendar", startStr, endStr],
    queryFn: () =>
      apiFetch<{ accommodations: CalendarAccommodation[] }>(
        `/api/ada/calendar?start=${startStr}&end=${endStr}`
      ),
  });

  const sorted = useMemo(
    () =>
      [...(data?.accommodations ?? [])].sort((a, b) =>
        (a.startDate ?? "").localeCompare(b.startDate ?? "")
      ),
    [data]
  );

  if (isLoading) return <CalendarLoading />;
  if (error) return <CalendarError />;

  return (
    <>
      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <span className="w-3 h-3 rounded-sm" style={{ background: ADA_ONGOING_COLORS.bg, border: `1.5px solid ${ADA_ONGOING_COLORS.border}` }} />
          Ongoing Accommodation
        </div>
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <span className="w-3 h-3 rounded-sm" style={{ background: ADA_LEAVE_COLORS.bg, border: `1.5px solid ${ADA_LEAVE_COLORS.border}` }} />
          Temporary Accommodation / ADA Leave
        </div>
      </div>

      <CalendarGrid days={days}>
        {sorted.length === 0 ? (
          <EmptyCalendar
            label={`No accommodations in ${format(currentMonth, "MMMM yyyy")}`}
            sub="Approved accommodations will appear here once recorded in an ADA case."
            icon={<ShieldCheck className="w-12 h-12 mb-3 opacity-20" style={{ color: "#7C3AED" }} />}
          />
        ) : (
          sorted.map((acc) => {
            const colors = acc.isOngoing ? ADA_ONGOING_COLORS : ADA_LEAVE_COLORS;
            const startIso = acc.startDate ?? format(monthStart, "yyyy-MM-dd");
            // Ongoing = extends to end of visible month
            const endIso = acc.isOngoing ? format(monthEnd, "yyyy-MM-dd") : (acc.endDate ?? format(monthEnd, "yyyy-MM-dd"));
            const { leftPct, widthPct } = getBarOffsets(startIso, endIso, monthStart, monthEnd, totalDays);
            const label = acc.calendarLabel ?? acc.description;

            return (
              <div
                key={acc.id}
                className="flex items-center border-t hover:bg-slate-50/50 transition-colors"
                style={{ minHeight: "52px", borderColor: "#E5E0D8" }}
              >
                <div
                  className="shrink-0 px-4 py-2 text-sm font-medium truncate border-r"
                  style={{ width: "200px", borderColor: "#E5E0D8", color: "#3D2010" }}
                  title={label}
                >
                  <p className="truncate">{label}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {acc.isOngoing ? "Ongoing" : "Temporary"}
                    {acc.category ? ` · ${acc.category}` : ""}
                  </p>
                </div>
                <div className="flex-1 relative h-10 mx-1">
                  <Link href={`/leaveiq/ada-cases/${acc.caseId}`}>
                    <div
                      className="absolute top-1 h-8 rounded-lg flex items-center px-2 overflow-hidden cursor-pointer transition-opacity hover:opacity-80"
                      style={{
                        left: `${leftPct}%`,
                        width: `${Math.max(widthPct, 2)}%`,
                        background: colors.bg,
                        border: `1.5px solid ${colors.border}`,
                        // Ongoing accommodations get a slightly bolder left edge
                        borderLeftWidth: acc.isOngoing ? "3px" : "1.5px",
                      }}
                      title={`${acc.caseNumber} · ${label}`}
                    >
                      <ShieldCheck className="w-3 h-3 shrink-0 mr-1" style={{ color: colors.text }} />
                      <span className="text-xs font-semibold truncate" style={{ color: colors.text }}>
                        {acc.caseNumber}
                      </span>
                      {acc.isOngoing && (
                        <span
                          className="ml-1 text-[9px] font-bold uppercase shrink-0 px-1 rounded"
                          style={{ background: colors.border, color: colors.text }}
                        >
                          ∞
                        </span>
                      )}
                    </div>
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </CalendarGrid>
    </>
  );
}

// ── Shared loading / error / empty states ──────────────────────────────────────
function CalendarLoading() {
  return (
    <div className="flex items-center justify-center py-20 text-muted-foreground">
      <Loader2 className="w-6 h-6 animate-spin mr-3" />
      Loading calendar…
    </div>
  );
}

function CalendarError() {
  return (
    <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">
      <AlertTriangle className="w-4 h-4 shrink-0" />
      Failed to load calendar data.
    </div>
  );
}

function EmptyCalendar({
  label,
  sub,
  icon,
}: {
  label: string;
  sub?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
      {icon ?? <CalendarDays className="w-12 h-12 mb-3 opacity-20" />}
      <p className="text-sm font-medium">{label}</p>
      {sub && <p className="text-xs mt-1 max-w-xs text-center">{sub}</p>}
    </div>
  );
}

// ── Main Calendar page ─────────────────────────────────────────────────────────
type CalendarTab = "leave" | "accommodations";

export default function Calendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [activeTab, setActiveTab] = useState<CalendarTab>("leave");

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  return (
    <AppLayout>
      <div className="animate-in opacity-0">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div>
            <h2 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
              <CalendarDays className="w-7 h-7 text-primary" />
              Leave Calendar
            </h2>
            <p className="text-muted-foreground mt-1">Visualize active leaves and approved accommodations</p>
          </div>
          {/* Month navigation */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
              className="p-2 rounded-xl border hover:bg-slate-100 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-semibold text-lg min-w-[160px] text-center">
              {format(currentMonth, "MMMM yyyy")}
            </span>
            <button
              onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
              className="p-2 rounded-xl border hover:bg-slate-100 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentMonth(new Date())}
              className="px-3 py-2 text-sm rounded-xl border hover:bg-slate-100 transition-colors font-medium"
            >
              Today
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 rounded-xl w-fit" style={{ background: "#F7F4F0", border: "1px solid #D4C9BB" }}>
          <button
            onClick={() => setActiveTab("leave")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
              activeTab === "leave"
                ? "shadow-sm text-white"
                : "text-muted-foreground hover:text-foreground"
            )}
            style={activeTab === "leave" ? { background: "#C97E59" } : {}}
          >
            <CalendarDays className="w-4 h-4" /> Leave
          </button>
          <button
            onClick={() => setActiveTab("accommodations")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
              activeTab === "accommodations"
                ? "shadow-sm text-white"
                : "text-muted-foreground hover:text-foreground"
            )}
            style={activeTab === "accommodations" ? { background: "#7C3AED" } : {}}
          >
            <ShieldCheck className="w-4 h-4" /> Accommodations
          </button>
        </div>

        {activeTab === "leave" ? (
          <LeaveCalendarTab
            currentMonth={currentMonth}
            days={days}
            monthStart={monthStart}
            monthEnd={monthEnd}
          />
        ) : (
          <AccommodationsCalendarTab
            currentMonth={currentMonth}
            days={days}
            monthStart={monthStart}
            monthEnd={monthEnd}
          />
        )}
      </div>
    </AppLayout>
  );
}
