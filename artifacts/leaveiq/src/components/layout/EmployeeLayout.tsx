import React from "react";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

interface EmployeeLayoutProps {
  children: React.ReactNode;
  showBack?: boolean;
  orgLogoUrl?: string | null;
  orgName?: string | null;
}

export function EmployeeLayout({ children, showBack = false, orgLogoUrl, orgName }: EmployeeLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#F4F1EA" }}>
      {/* Header */}
      <header
        className="h-16 backdrop-blur-md flex items-center px-6 gap-4 sticky top-0 z-50 shadow-sm"
        style={{ background: "rgba(255,255,255,0.88)", borderBottom: "1px solid #E0D8C5" }}
      >
        {showBack && (
          <Link
            href="/"
            className="p-2 rounded-full transition-colors"
            style={{ color: "#5A6470" }}
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
        )}
        <div className="flex items-center gap-3">
          <img src="/guildlight-logo.png" alt="Guildlight" className="h-8 w-8 object-contain" />
          <div>
            <h1 className="font-bold text-lg leading-none" style={{ color: "#1B2430" }}>Guildlight Leave</h1>
            <p className="text-[10px] uppercase tracking-wider font-semibold leading-none mt-0.5" style={{ color: "#D9B87A" }}>Employee Portal</p>
          </div>
          {orgLogoUrl && (
            <>
              <span className="text-muted-foreground mx-2 text-lg">|</span>
              <img src={orgLogoUrl} alt={orgName ?? "Organization"} className="h-8 max-w-[120px] object-contain" />
            </>
          )}
        </div>
        <div className="ml-auto">
          <Link
            href="/login"
            className="text-sm font-medium transition-opacity hover:opacity-80"
            style={{ color: "#C39A4A" }}
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
