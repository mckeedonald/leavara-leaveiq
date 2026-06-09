import React from "react";
import { Link } from "wouter";
import { FileText, LogIn, Building2 } from "lucide-react";
import { useOrgBranding } from "@/lib/useOrgBranding";

export default function OrgLanding() {
  const { orgName, logoUrl, isLoading, products } = useOrgBranding();

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ background: "#F4F1EA" }}
    >
      {products.length === 2 ? (
        /* ── Two-product layout ─────────────────────────────────────── */
        <div className="w-full max-w-2xl flex flex-col items-center gap-8">
          <OrgHeader orgName={orgName} logoUrl={logoUrl} isLoading={isLoading} />

          {/* Product info cards — display only, no per-card sign-in */}
          <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-6">
            <ProductInfoCard
              title="Guildlight Leave"
              subtitle="Leave Management"
              accentColor="#C39A4A"
              primaryLabel="Request Leave"
              primaryHref="/leave/request"
            />
            <ProductInfoCard
              title="Guildlight Grow"
              subtitle="Performance Management"
              accentColor="#7C9273"
              primaryLabel={null}
              primaryHref={null}
            />
          </div>

          {/* Single sign-in button for the whole org */}
          <Link href="/leave/login">
            <a
              className="flex items-center justify-center gap-3 px-10 py-4 rounded-2xl font-semibold text-base transition-all hover:opacity-90 active:scale-[0.98] shadow-md"
              style={{ background: "#C39A4A", color: "#FFFFFF" }}
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
          style={{ background: "#FFFFFF", border: "1px solid #E0D8C5" }}
        >
          <div className="h-2 w-full" style={{ background: "linear-gradient(90deg, #C39A4A, #D9B87A)" }} />

          <div className="px-10 py-12 flex flex-col items-center gap-8">
            <OrgHeader orgName={orgName} logoUrl={logoUrl} isLoading={isLoading} />

            <div className="text-center">
              <p className="text-base font-medium" style={{ color: "#B39A6A" }}>
                {products[0] === "performiq" ? "Performance Management Portal" : "Leave Management Portal"}
              </p>
            </div>

            <div className="w-full h-px" style={{ background: "#E8E2D5" }} />

            <div className="w-full flex flex-col gap-3">
              {products[0] !== "performiq" && (
                <Link href="/leave/request">
                  <a
                    className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl font-semibold text-base transition-all hover:opacity-90 active:scale-[0.98] shadow-sm"
                    style={{ background: "#C39A4A", color: "#FFFFFF" }}
                  >
                    <FileText className="w-5 h-5" />
                    Request Leave
                  </a>
                </Link>
              )}

              <Link href="/leave/login">
                <a
                  className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl font-semibold text-base transition-all hover:bg-[#F4EEDF] active:scale-[0.98] border"
                  style={{ background: "#FFFFFF", color: "#1B2430", borderColor: "#C97E5966" }}
                >
                  <LogIn className="w-5 h-5" style={{ color: "#C39A4A" }} />
                  HR Sign In
                </a>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-10 flex items-center gap-2.5 opacity-60">
        <img src="/guildlight-logo.png" alt="Guildlight" className="h-5 w-5 object-contain" />
        <span className="text-sm font-medium" style={{ color: "#6E5A2E" }}>
          Powered by Guildlight
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
        <div className="w-20 h-20 rounded-2xl animate-pulse" style={{ background: "#F4F1EA" }} />
      ) : logoUrl ? (
        <img src={logoUrl} alt={orgName ?? "Organization"} className="max-h-[120px] max-w-[200px] object-contain" />
      ) : (
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center shadow-sm"
          style={{ background: "#F4EEDF", border: "1px solid #C97E5933" }}
        >
          <Building2 className="w-10 h-10" style={{ color: "#C39A4A" }} />
        </div>
      )}

      {isLoading ? (
        <div className="h-8 w-48 rounded-xl animate-pulse" style={{ background: "#F4F1EA" }} />
      ) : (
        <h1 className="text-3xl font-bold text-center leading-tight" style={{ color: "#1B2430" }}>
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
      style={{ background: "#FFFFFF", border: "1px solid #E0D8C5" }}
    >
      <div className="h-2 w-full" style={{ background: accentColor }} />

      <div className="px-8 py-8 flex flex-col items-center gap-5 flex-1">
        <div className="text-center">
          <h2 className="text-2xl font-bold" style={{ color: "#1B2430" }}>{title}</h2>
          <p className="text-sm font-medium mt-1" style={{ color: "#B39A6A" }}>{subtitle}</p>
        </div>

        <div className="w-full h-px" style={{ background: "#E8E2D5" }} />

        {primaryLabel && primaryHref && (
          <div className="w-full mt-auto">
            <Link href={primaryHref}>
              <a
                className="w-full flex items-center justify-center gap-3 px-5 py-3.5 rounded-2xl font-semibold text-sm transition-all hover:opacity-90 active:scale-[0.98] shadow-sm"
                style={{ background: "#C39A4A", color: "#FFFFFF" }}
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
