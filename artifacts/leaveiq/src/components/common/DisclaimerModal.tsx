import React from "react";
import { createPortal } from "react-dom";
import { ShieldCheck, X } from "lucide-react";

interface DisclaimerModalProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export function DisclaimerModal({ onConfirm, onCancel }: DisclaimerModalProps) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0"
        style={{ background: "rgba(61,32,16,0.45)" }}
        onClick={onCancel}
      />
      <div
        className="relative w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: "#FCFAF6", border: "1px solid #E6DECF" }}
      >
        <div
          className="px-6 py-5 flex items-center justify-between"
          style={{ background: "#F5EFE2", borderBottom: "1px solid #E2C49A" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "#B68B5E" }}
            >
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <p className="font-display font-bold text-base" style={{ color: "#18263A" }}>
              Decision Support Only
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg hover:bg-black/5 transition-colors"
            aria-label="Cancel"
          >
            <X className="w-4 h-4" style={{ color: "#7E6638" }} />
          </button>
        </div>

        <div className="px-6 py-5">
          <p className="text-sm leading-relaxed" style={{ color: "#2A3A4C" }}>
            Guildlight Leave provides AI-assisted decision support to help HR professionals
            analyze leave cases. The system&apos;s output is a recommendation only.
          </p>
          <p className="text-sm leading-relaxed mt-3" style={{ color: "#2A3A4C" }}>
            <strong>A human decision is always required.</strong> Guildlight Leave never
            independently approves or denies a leave request. You remain fully
            responsible for the final determination.
          </p>
        </div>

        <div
          className="px-6 py-4 flex items-center justify-end gap-3"
          style={{ borderTop: "1px solid #E2C49A" }}
        >
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            style={{ color: "#7E6638", background: "#EDE7D9" }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-white transition-all shadow-md hover:shadow-lg"
            style={{ background: "linear-gradient(135deg, #C9A455 0%, #8E6A45 100%)" }}
          >
            Continue
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
