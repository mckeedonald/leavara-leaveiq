import React, { useState } from "react";
import { useRecordHrDecision, getGetCaseQueryKey, HrDecisionType } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { X, Loader2 } from "lucide-react";

export function RecordDecisionModal({ isOpen, onClose, caseId }: { isOpen: boolean; onClose: () => void; caseId: string }) {
  const queryClient = useQueryClient();
  const recordDecision = useRecordHrDecision();
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);
    
    const data = {
      decisionType: fd.get("decisionType") as HrDecisionType,
      decidedBy: "Jane Doe (HR)", // Demo
      decisionNotes: (fd.get("decisionNotes") as string) || null,
    };

    recordDecision.mutate({ caseId, data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCaseQueryKey(caseId) });
        onClose();
      },
      onError: (err: any) => {
        setError(err.message || "Failed to record decision");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-lg rounded-2xl shadow-2xl border flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
        <div className="p-6 border-b flex justify-between items-center bg-slate-50/50">
          <h2 className="text-xl font-display font-bold">Record HR Decision</h2>
          <button onClick={onClose} className="text-muted-foreground hover:bg-slate-200 p-2 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div className="bg-amber-50 text-amber-800 p-3 rounded-xl border border-amber-200 text-sm mb-2">
            <strong>Authoritative Action:</strong> This decision will be permanently recorded in the audit log and dictate the final outcome of the case.
          </div>

          {error && <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg border border-destructive/20">{error}</div>}
          
          <div className="space-y-1">
            <label className="text-sm font-semibold">Decision <span className="text-destructive">*</span></label>
            <select required name="decisionType" className="w-full border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-white">
              {Object.entries(HrDecisionType).map(([key, val]) => (
                <option key={key} value={val}>{key.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-semibold">Decision Rationale/Notes <span className="text-destructive">*</span></label>
            <textarea required name="decisionNotes" rows={4} className="w-full border rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none" placeholder="Provide justification for this decision..." />
          </div>

          <div className="mt-6 flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={onClose} className="px-5 py-2.5 font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={recordDecision.isPending} className="px-5 py-2.5 font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center gap-2">
              {recordDecision.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Decision
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
