import React, { useState } from "react";
import { useTransitionCase, getGetCaseQueryKey, TransitionRequestEvent } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { X, Loader2 } from "lucide-react";

export function TransitionCaseModal({ isOpen, onClose, caseId, event }: { isOpen: boolean; onClose: () => void; caseId: string; event: TransitionRequestEvent }) {
  const queryClient = useQueryClient();
  const transitionCase = useTransitionCase();
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const titles = {
    [TransitionRequestEvent.ROUTE_HR_REVIEW]: "Route to HR Review",
    [TransitionRequestEvent.DRAFT_NOTICE]: "Draft Notice",
    [TransitionRequestEvent.CANCEL]: "Cancel Case",
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);
    
    const data = {
      event,
      actor: "HR System", // in real app, logged in user
      notes: (fd.get("notes") as string) || null,
    };

    transitionCase.mutate({ caseId, data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCaseQueryKey(caseId) });
        onClose();
      },
      onError: (err: any) => {
        setError(err.message || "Transition failed");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-lg rounded-2xl shadow-2xl border flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
        <div className="p-6 border-b flex justify-between items-center bg-slate-50/50">
          <h2 className="text-xl font-display font-bold">{titles[event]}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:bg-slate-200 p-2 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          {error && <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg border border-destructive/20">{error}</div>}
          
          <div className="space-y-1">
            <label className="text-sm font-semibold">Notes (Optional)</label>
            <textarea name="notes" rows={4} className="w-full border rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none" placeholder="Add any context for this transition..." />
          </div>

          <div className="mt-6 flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={onClose} className="px-5 py-2.5 font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={transitionCase.isPending} className="px-5 py-2.5 font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center gap-2">
              {transitionCase.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Confirm
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
