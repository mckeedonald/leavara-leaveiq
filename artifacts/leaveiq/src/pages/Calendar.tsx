import React, { useState, useMemo } from "react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { apiFetch } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, CalendarDays, Loader2, AlertTriangle } from "lucide-react";
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

const PROGRAM_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  own_health:           { bg: "#DBEAFE", text: "#1E40AF", border: "#BFDBFE" },
  care_family:          { bg: "#D1FAE5", text: "#065F46", border: "#A7F3D0" },
  pregnancy_disability: { bg: "#EDE9FE", text: "#5B21B6", border: "#DDD6FE" },
  bonding:              { bg: "#FEF3C7", text: "#92400E", border: "#FDE68A" },
  personal:             { bg: "#FFE4D6", text: "#9E5D38", border: "#FDBA74" },
};

const REASON_LABELS: Record<string, string> = {
  own_health: "Own Health",
  care_family: "Family Care",
  pregnancy_disability: "Pregnancy Disability",
  bonding: "Bonding",
  personal: "Personal",
};

function employeeName(c: CalendarCase): string {
  return [c.employeeFirstName, c.employeeLastName].filter(Boolean).join(" ") || c.caseNumber;
}

export default function Calendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const startStr = format(monthStart, "yyyy-MM-dd");
  const endStr = format(monthEnd, "yyyy-MM-dd");

  const { data, isLoading, error } = useQuery({
    queryKey: ["cases-calendar", startStr, endStr],
    queryFn: () => apiFetch<{ cases: CalendarCase[] }>(`/api/cases/calendar?start=${startStr}&end=${endStr}`),
  });

  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const totalDays = days.length;

  // Group cases by employee for stacking
  const employeeCases = useMemo(() => {
    const cases = data?.cases ?? [];
    // Sort by start date
    return [...cases].sort((a, b) => a.requestedStart.localeCompare(b.requestedStart));
  }, [data]);

  function getBarStyle(c: CalendarCase) {
    const colors = PROGRAM_COLORS[c.leaveReasonCategory] ?? PROGRAM_COLORS.personal;

    const start = dateMax([parseISO(c.requestedStart), monthStart]);
    const end = c.requestedEnd ? dateMin([parseISO(c.requestedEnd), monthEnd]) : monthEnd;

    const startOffset = differenceInDays(start, monthStart);
    const duration = differenceInDays(end, start) + 1;

    const leftPct = (startOffset / totalDays) * 100;
    const widthPct = (duration / totalDays) * 100;

    return { leftPct, widthPct, colors };
  }

  return (
    <AppLayout>
      <div className="animate-in opacity-0">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div>
            <h2 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
              <CalendarDays className="w-7 h-7 text-primary" />
              Leave Calendar
            </h2>
            <p className="text-muted-foreground mt-1">Visualize active and approved leaves across your organization</p>
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

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mb-6">
          {Object.entries(REASON_LABELS).map(([key, label]) => {
            const c = PROGRAM_COLORS[key];
            return (
              <div key={key} className="flex items-center gap-1.5 text-xs font-medium">
                <span className="w-3 h-3 rounded-sm" style={{ background: c.bg, border: `1.5px solid ${c.border}` }} />
                {label}
              </div>
            );
          })}
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mr-3" />
            Loading calendar…
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Failed to load calendar data.
          </div>
        )}

        {!isLoading && !error && (
          <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
            {/* Day header */}
            <div className="border-b bg-slate-50">
              <div className="flex" style={{ paddingLeft: "180px" }}>
                {days.map((day) => (
                  <div
                    key={day.toISOString()}
                    className="flex-1 text-center py-2 text-xs font-semibold border-l first:border-l-0"
                    style={{
                      color: isSameMonth(day, currentMonth) ? "#5C3D28" : "#D4C9BB",
                      borderColor: "#E5E0D8",
                    }}
                  >
                    <span className="hidden sm:block">{format(day, "d")}</span>
                    <span className="sm:hidden">{format(day, "d").slice(0, 1)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Employee rows */}
            {employeeCases.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <CalendarDays className="w-12 h-12 mb-3 opacity-20" />
                <p className="text-sm font-medium">No active leaves in {format(currentMonth, "MMMM yyyy")}</p>
                <p className="text-xs mt-1">Cases will appear here once they have a start date set.</p>
              </div>
            ) : (
              employeeCases.map((c) => {
                const { leftPct, widthPct, colors } = getBarStyle(c);
                const name = employeeName(c);
                return (
                  <div
                    key={c.caseId}
                    className="flex items-center border-t hover:bg-slate-50/50 transition-colors"
                    style={{ minHeight: "52px", borderColor: "#E5E0D8" }}
                  >
                    {/* Employee name */}
                    <div
                      className="shrink-0 px-4 py-2 text-sm font-medium truncate border-r"
                      style={{ width: "180px", borderColor: "#E5E0D8", color: "#3D2010" }}
                      title={name}
                    >
                      <p className="truncate">{name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {REASON_LABELS[c.leaveReasonCategory] ?? c.leaveReasonCategory}
                      </p>
                    </div>

                    {/* Bar track */}
                    <div className="flex-1 relative h-10 mx-1">
                      <Link href={`/cases/${c.caseId}`}>
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
                          <span
                            className="text-xs font-semibold truncate"
                            style={{ color: colors.text }}
                          >
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
          </div>
        )}
      </div>
    </AppLayout>
  );
}
