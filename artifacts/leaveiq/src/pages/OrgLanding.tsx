import React from "react";
import { Link } from "wouter";
import { FileText, LogIn, Building2 } from "lucide-react";
import { useOrgBranding } from "@/lib/useOrgBranding";

export default function OrgLanding() {
  const { orgName, logoUrl, isLoading, products } = useOrgBranding();

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ background: "#F0EEE9" }}
    >
      {products.length === 2 ? (
        /* ── Two-product layout ─────────────────────────────────────── */
        <div className="w-full max-w-2xl flex flex-col items-center gap-8">
          <OrgHeader orgName={orgName} logoUrl={logoUrl} isLoading={isLoading} />

          {/* Product info cards — display only, no per-card sign-in */}
          <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-6">
            <ProductInfoCard
              title="LeaveIQ"
              subtitle="Leave Management"
              accentColor="#C97E59"
              primaryLabel="Request Leave"
              primaryHref="/leaveiq/request"
            />
            <ProductInfoCard
              title="PerformIQ"
              subtitle="Performance Management"
              accentColor="#2E7B7B"
              primaryLabel={null}
              primaryHref={null}
            />
          </div>

          {/* Single sign-in button for the whole org */}
          <Link href="/leaveiq/login">
            <a
              className="flex items-center justify-center gap-3 px-10 py-4 rounded-2xl font-semibold text-base transition-all hover:opacity-90 active:scale-[0.98] shadow-md"
              style={{ background: "#C97E59", color: "#FFFFFF" }}
            >
              <LogIn className="w-5 h-5" />
              HR Sign In
            </a>
          </Link>
        </div>
      ) : (
        /* ── Single-product landing ─────────────────────────────────── */
        <div
          className="w-full max-w-md rounded-3xl shadow-xl overflow-hidden"
          style={{ background: "#FFFFFF", border: "1px solid #D4C9BB" }}
        >
          <div className="h-2 w-full" style={{ background: "linear-gradient(90deg, #C97E59, #EAA292)" }} />

          <div className="px-10 py-12 flex flex-col items-center gap-8">
            <OrgHeader orgName={orgName} logoUrl={logoUrl} isLoading={isLoading} />

            <div className="text-center">
              <p className="text-base font-medium" style={{ color: "#A47864" }}>
                {products[0] === "performiq" ? "Performance Management Portal" : "Leave Management Portal"}
              </p>
            </div>

            <div className="w-full h-px" style={{ background: "#E8E2DA" }} />

            <div className="w-full flex flex-col gap-3">
              {products[0] !== "performiq" && (
                <Link href="/leaveiq/request">
                  <a
                    className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl font-semibold text-base transition-all hover:opacity-90 active:scale-[0.98] shadow-sm"
                    style={{ background: "#C97E59", color: "#FFFFFF" }}
                  >
                    <FileText className="w-5 h-5" />
                    Request Leave
                  </a>
                </Link>
              )}

              <Link href="/leaveiq/login">
                <a
                  className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl font-semibold text-base transition-all hover:bg-[#F5E8DF] active:scale-[0.98] border"
                  style={{ background: "#FFFFFF", color: "#3D2010", borderColor: "#C97E5966" }}
                >
                  <LogIn className="w-5 h-5" style={{ color: "#C97E59" }} />
                  HR Sign In
                </a>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-10 flex items-center gap-2.5 opacity-60">
        <img src="/leavara-logo.png" alt="Leavara" className="h-5 w-5 object-contain" />
        <span className="text-sm font-medium" style={{ color: "#7A5540" }}>
          Powered by Leavara
        </span>
      </div>
    </div>
  );
}

/* ── Sub-components ───────────────────────────────────────────────────── */

function OrgHeader({
  orgName,
  logoUrl,
  isLoading,
}: {
  orgName: string | null;
  logoUrl: string | null;
  isLoading: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-4">
      {isLoading ? (
        <div className="w-20 h-20 rounded-2xl animate-pulse" style={{ background: "#F0EEE9" }} />
      ) : logoUrl ? (
        <img src={logoUrl} alt={orgName ?? "Organization"} className="max-h-[120px] max-w-[200px] object-contain" />
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
  );
}

function ProductInfoCard({
  title,
  subtitle,
  accentColor,
  primaryLabel,
  primaryHref,
}: {
  title: string;
  subtitle: string;
  accentColor: string;
  primaryLabel: string | null;
  primaryHref: string | null;
}) {
  return (
    <div
      className="rounded-3xl shadow-xl overflow-hidden flex flex-col"
      style={{ background: "#FFFFFF", border: "1px solid #D4C9BB" }}
    >
      <div className="h-2 w-full" style={{ background: accentColor }} />

      <div className="px-8 py-8 flex flex-col items-center gap-5 flex-1">
        <div className="text-center">
          <h2 className="text-2xl font-bold" style={{ color: "#3D2010" }}>{title}</h2>
          <p className="text-sm font-medium mt-1" style={{ color: "#A47864" }}>{subtitle}</p>
        </div>

        <div className="w-full h-px" style={{ background: "#E8E2DA" }} />

        {primaryLabel && primaryHref && (
          <div className="w-full mt-auto">
            <Link href={primaryHref}>
              <a
                className="w-full flex items-center justify-center gap-3 px-5 py-3.5 rounded-2xl font-semibold text-sm transition-all hover:opacity-90 active:scale-[0.98] shadow-sm"
                style={{ background: "#C97E59", color: "#FFFFFF" }}
              >
                <FileText className="w-4 h-4" />
                {primaryLabel}
              </a>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
