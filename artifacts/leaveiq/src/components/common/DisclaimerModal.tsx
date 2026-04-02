import React from "react";
import { ShieldCheck, X } from "lucide-react";

interface DisclaimerModalProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export function DisclaimerModal({ onConfirm, onCancel }: DisclaimerModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0"
        style={{ background: "rgba(61,32,16,0.45)" }}
        onClick={onCancel}
      />
      <div
        className="relative w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: "#FDFAF7", border: "1px solid #D4C9BB" }}
      >
        <div
          className="px-6 py-5 flex items-center justify-between"
          style={{ background: "#F5E8DF", borderBottom: "1px solid #E8C4A8" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "#C97E59" }}
            >
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <p className="font-display font-bold text-base" style={{ color: "#3D2010" }}>
              Decision Support Only
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg hover:bg-black/5 transition-colors"
            aria-label="Cancel"
          >
            <X className="w-4 h-4" style={{ color: "#8C6040" }} />
          </button>
        </div>

        <div className="px-6 py-5">
          <p className="text-sm leading-relaxed" style={{ color: "#5C3D28" }}>
            LeaveIQ provides AI-assisted decision support to help HR professionals
            analyze leave cases. The system&apos;s output is a recommendation only.
          </p>
          <p className="text-sm leading-relaxed mt-3" style={{ color: "#5C3D28" }}>
            <strong>A human decision is always required.</strong> LeaveIQ never
            independently approves or denies a leave request. You remain fully
            responsible for the final determination.
          </p>
        </div>

        <div
          className="px-6 py-4 flex items-center justify-end gap-3"
          style={{ borderTop: "1px solid #E8C4A8" }}
        >
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            style={{ color: "#8C6040", background: "#EDE6DF" }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-white transition-all shadow-md hover:shadow-lg"
            style={{ background: "linear-gradient(135deg, #D4895E 0%, #B85F30 100%)" }}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
