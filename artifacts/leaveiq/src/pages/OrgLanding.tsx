import React from "react";
import { Link } from "wouter";
import { FileText, LogIn, Building2 } from "lucide-react";
import { useOrgBranding } from "@/lib/useOrgBranding";

function getIsSubdomain(): boolean {
  if (typeof window === "undefined") return false;
  const parts = window.location.hostname.split(".");
  return parts.length >= 3 && parts.slice(-2).join(".") === "leavara.net";
}

export default function OrgLanding() {
  const { orgName, logoUrl, slug, isLoading } = useOrgBranding();
  const isSubdomain = getIsSubdomain();
  const requestHref = isSubdomain ? "/request" : `/request${slug ? `?org=${encodeURIComponent(slug)}` : ""}`;

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ background: "#F0EEE9" }}
    >
      {/* Card */}
      <div
        className="w-full max-w-md rounded-3xl shadow-xl overflow-hidden"
        style={{ background: "#FFFFFF", border: "1px solid #D4C9BB" }}
      >
        {/* Top accent bar */}
        <div className="h-2 w-full" style={{ background: "linear-gradient(90deg, #C97E59, #EAA292)" }} />

        <div className="px-10 py-12 flex flex-col items-center gap-8">
          {/* Org logo / name */}
          <div className="flex flex-col items-center gap-4">
            {isLoading ? (
              <div className="w-20 h-20 rounded-2xl animate-pulse" style={{ background: "#F0EEE9" }} />
            ) : logoUrl ? (
              <img
                src={logoUrl}
                alt={orgName ?? "Organization"}
                className="max-h-[120px] max-w-[200px] object-contain"
              />
            ) : (
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center shadow-sm"
                style={{ background: "#F5E8DF", border: "1px solid #C97E5933" }}
              >
                <Building2 className="w-10 h-10" style={{ color: "#C97E59" }} />
              </div>
            )}

            {isLoading ? (
              <div className="h-8 w-48 rounded-xl animate-pulse" style={{ background: "#F0EEE9" }} />
            ) : (
              <h1 className="text-3xl font-bold text-center leading-tight" style={{ color: "#3D2010" }}>
                {orgName ?? "Organization Portal"}
              </h1>
            )}
          </div>

          {/* Subtitle */}
          <div className="text-center">
            <p className="text-base font-medium" style={{ color: "#A47864" }}>
              Leave Management Portal
            </p>
          </div>

          {/* Divider */}
          <div className="w-full h-px" style={{ background: "#E8E2DA" }} />

          {/* CTA buttons */}
          <div className="w-full flex flex-col gap-3">
            <Link href={requestHref}>
              <a
                className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl font-semibold text-base transition-all hover:opacity-90 active:scale-[0.98] shadow-sm"
                style={{
                  background: "#C97E59",
                  color: "#FFFFFF",
                }}
              >
                <FileText className="w-5 h-5" />
                Request Leave
              </a>
            </Link>

            <Link href="/login">
              <a
                className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl font-semibold text-base transition-all hover:bg-[#F5E8DF] active:scale-[0.98] border"
                style={{
                  background: "#FFFFFF",
                  color: "#3D2010",
                  borderColor: "#C97E5966",
                }}
              >
                <LogIn className="w-5 h-5" style={{ color: "#C97E59" }} />
                HR Sign In
              </a>
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-10 flex items-center gap-2.5 opacity-60">
        <img src="/leavara-logo.png" alt="Leavara" className="h-5 w-5 object-contain" />
        <span className="text-sm font-medium" style={{ color: "#7A5540" }}>
          Powered by Leavara LeaveIQ
        </span>
      </div>
    </div>
  );
}
