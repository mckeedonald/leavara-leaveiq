import React from "react";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

interface EmployeeLayoutProps {
  children: React.ReactNode;
  showBack?: boolean;
}

export function EmployeeLayout({ children, showBack = false }: EmployeeLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#F0EEE9" }}>
      {/* Header */}
      <header
        className="h-16 backdrop-blur-md flex items-center px-6 gap-4 sticky top-0 z-50 shadow-sm"
        style={{ background: "rgba(255,255,255,0.88)", borderBottom: "1px solid #D4C9BB" }}
      >
        {showBack && (
          <Link
            href="/"
            className="p-2 rounded-full transition-colors"
            style={{ color: "#8C7058" }}
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
        )}
        <div className="flex items-center gap-3">
          <img src="/leavara-logo.png" alt="Leavara" className="h-8 w-8 object-contain" />
          <div>
            <h1 className="font-bold text-lg leading-none" style={{ color: "#3D2010" }}>Leavara LeaveIQ</h1>
            <p className="text-[10px] uppercase tracking-wider font-semibold leading-none mt-0.5" style={{ color: "#EAA292" }}>Employee Portal</p>
          </div>
        </div>
        <div className="ml-auto">
          <Link
            href="/login"
            className="text-sm font-medium transition-opacity hover:opacity-80"
            style={{ color: "#C97E59" }}
          >
            HR Sign In →
          </Link>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex flex-col">
        {children}
      </div>
    </div>
  );
}
