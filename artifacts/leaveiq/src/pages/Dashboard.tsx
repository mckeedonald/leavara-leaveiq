import React, { useState } from "react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useListCases, LeaveState } from "@workspace/api-client-react";
import { StatusBadge, ReasonBadge } from "@/components/ui/StatusBadge";
import { formatDate, cn } from "@/lib/utils";
import { Plus, Users, Clock, AlertCircle, CheckCircle2, ChevronRight, Loader2, Files } from "lucide-react";
import { CreateCaseModal } from "@/components/cases/CreateCaseModal";

export default function Dashboard() {
  const { data: casesData, isLoading, error } = useListCases();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const cases = casesData?.cases || [];
  
  const stats = {
    total: cases.length,
    pendingHr: cases.filter(c => c.state === LeaveState.HR_REVIEW_QUEUE).length,
    inAnalysis: cases.filter(c => c.state === LeaveState.ELIGIBILITY_ANALYSIS).length,
    closed: cases.filter(c => c.state === LeaveState.CLOSED).length,
  };

  const caseTrend = (() => {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const thisMonthCount = cases.filter(c => new Date(c.createdAt) >= thisMonthStart).length;
    const lastMonthCount = cases.filter(c => {
      const d = new Date(c.createdAt);
      return d >= lastMonthStart && d < thisMonthStart;
    }).length;

    if (lastMonthCount === 0) {
      return thisMonthCount > 0
        ? { label: "New this month", direction: "up" as const }
        : { label: null, direction: "neutral" as const };
    }

    const pct = Math.round(((thisMonthCount - lastMonthCount) / lastMonthCount) * 100);

    if (pct === 0) return { label: "No change", direction: "neutral" as const };
    if (pct > 0) return { label: `+${pct}% this month`, direction: "up" as const };
    return { label: `${pct}% this month`, direction: "down" as const };
  })();

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4 animate-in opacity-0 stagger-1">
        <div>
          <h2 className="text-3xl font-display font-bold text-foreground">Dashboard</h2>
          <p className="text-muted-foreground mt-1">Overview of all active leave cases</p>
        </div>
        <button 
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-2.5 rounded-xl font-medium shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Case
        </button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 animate-in opacity-0 stagger-2">
        <MetricCard 
          title="Total Cases" 
          value={stats.total} 
          icon={<Users className="w-5 h-5 text-[#C97E59]" />} 
          trend={caseTrend.label ?? undefined}
        />
        <MetricCard 
          title="Pending HR Review" 
          value={stats.pendingHr} 
          icon={<AlertCircle className="w-5 h-5 text-amber-500" />} 
          highlight={stats.pendingHr > 0}
        />
        <MetricCard 
          title="In Analysis" 
          value={stats.inAnalysis} 
          icon={<Clock className="w-5 h-5 text-amber-500" />} 
        />
        <MetricCard 
          title="Recently Closed" 
          value={stats.closed} 
          icon={<CheckCircle2 className="w-5 h-5 text-[#A47864]" />} 
        />
      </div>

      {/* Recent Cases Table */}
      <div className="bg-card border shadow-sm rounded-2xl overflow-hidden animate-in opacity-0 stagger-3">
        <div className="p-5 border-b flex justify-between items-center bg-slate-50/50">
          <h3 className="font-bold text-lg font-display">Recent Cases</h3>
          <Link href="/cases" className="text-sm font-medium text-primary hover:text-primary/80 flex items-center gap-1 transition-colors">
            View All <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary/50" />
            <p>Loading cases...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-destructive">
            <p>Failed to load cases. Please try again later.</p>
          </div>
        ) : cases.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <Files className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">No cases found</h3>
            <p className="text-muted-foreground mt-1 max-w-sm">There are currently no active leave cases in the system. Create a new case to get started.</p>
            <button 
              onClick={() => setIsCreateModalOpen(true)}
              className="mt-6 text-primary font-medium hover:underline"
            >
              + Create your first case
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/30 text-muted-foreground text-xs uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-6 py-4">Case Number</th>
                  <th className="px-6 py-4">Employee</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Reason</th>
                  <th className="px-6 py-4">Start Date</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {cases.slice(0, 10).map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30 transition-colors group cursor-pointer">
                    <td className="px-6 py-4 font-medium text-foreground">
                      <Link href={`/cases/${c.id}`} className="hover:underline hover:text-primary">
                        {c.caseNumber}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{c.employeeNumber}</td>
                    <td className="px-6 py-4"><StatusBadge state={c.state} /></td>
                    <td className="px-6 py-4"><ReasonBadge reason={c.leaveReasonCategory} /></td>
                    <td className="px-6 py-4 text-muted-foreground">{formatDate(c.requestedStart)}</td>
                    <td className="px-6 py-4 text-right">
                      <Link 
                        href={`/cases/${c.id}`}
                        className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      >
                        Review
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateCaseModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
    </AppLayout>
  );
}

function MetricCard({ title, value, icon, trend, trendDirection = "neutral", highlight }: { title: string; value: number | string; icon: React.ReactNode; trend?: string; trendDirection?: "up" | "down" | "neutral"; highlight?: boolean }) {
  const trendStyle =
    trendDirection === "up"
      ? { color: "#166534", background: "#dcfce7" }
      : trendDirection === "down"
      ? { color: "#991b1b", background: "#fee2e2" }
      : { color: "#9E5D38", background: "#F5E8DF" };

  return (
    <div className={cn(
      "bg-card p-6 rounded-2xl border shadow-sm transition-all hover:shadow-md",
      highlight ? "ring-2 ring-amber-400 border-amber-200 bg-amber-50/10" : ""
    )}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <div className="p-2 bg-muted/50 rounded-xl">{icon}</div>
      </div>
      <div className="flex items-baseline gap-2">
        <h4 className="text-3xl font-display font-bold">{value}</h4>
        {trend && <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={trendStyle}>{trend}</span>}
      </div>
    </div>
  );
}
