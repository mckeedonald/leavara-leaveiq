import React, { useState } from "react";
import { Link, useSearch } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useListCases, LeaveState } from "@workspace/api-client-react";
import { ReasonBadge, DisplayStatusBadge } from "@/components/ui/StatusBadge";
import { formatDate } from "@/lib/utils";
import { Search, Loader2, Filter, Plus } from "lucide-react";
import { CreateCaseModal } from "@/components/cases/CreateCaseModal";

export default function Cases() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const initialState = params.get("state") ?? "ALL";
  const [filterState, setFilterState] = useState<string>(initialState);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const { data, isLoading } = useListCases(filterState !== "ALL" ? { state: filterState } : undefined);
  const cases = data?.cases || [];

  return (
    <AppLayout>
      <div className="mb-8 animate-in opacity-0 stagger-1">
        <h2 className="text-3xl font-display font-bold text-foreground">All Cases</h2>
        <p className="text-muted-foreground mt-1">Manage and track employee leave requests</p>
      </div>

      <div className="bg-card border shadow-sm rounded-2xl overflow-hidden animate-in opacity-0 stagger-2">
        {/* Toolbar */}
        <div className="p-4 border-b flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50/50">
          <div className="relative w-full sm:max-w-xs">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Filter by case number..." 
              className="w-full pl-9 pr-4 py-2 text-sm bg-white border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            />
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select 
              value={filterState}
              onChange={(e) => setFilterState(e.target.value)}
              className="w-full sm:w-auto py-2 px-3 text-sm bg-white border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none cursor-pointer"
            >
              <option value="ALL">All States</option>
              {Object.values(LeaveState).map(state => (
                <option key={state} value={state}>{state.replace(/_/g, ' ')}</option>
              ))}
            </select>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-xl font-medium shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2 whitespace-nowrap text-sm"
            >
              <Plus className="w-4 h-4" />
              New Case
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="p-20 flex flex-col items-center justify-center text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
            <p>Loading cases...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/30 text-muted-foreground text-xs uppercase tracking-wider font-semibold border-b">
                <tr>
                  <th className="px-6 py-4">Case #</th>
                  <th className="px-6 py-4">Employee</th>
                  <th className="px-6 py-4">Reason</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Requested Dates</th>
                  <th className="px-6 py-4">Last Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {cases.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                      No cases found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  cases.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/30 transition-colors group">
                      <td className="px-6 py-4 font-medium">
                        <Link href={`/cases/${c.id}`} className="text-primary hover:underline font-semibold">
                          {c.caseNumber}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground font-medium">{c.employeeNumber}</td>
                      <td className="px-6 py-4"><ReasonBadge reason={c.leaveReasonCategory} /></td>
                      <td className="px-6 py-4">
                        <DisplayStatusBadge displayStatus={(c as any).displayStatus} state={c.state} />
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {formatDate(c.requestedStart)}
                        {c.requestedEnd ? ` - ${formatDate(c.requestedEnd)}` : ' (Ongoing)'}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {formatDate(c.updatedAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateCaseModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
    </AppLayout>
  );
}
