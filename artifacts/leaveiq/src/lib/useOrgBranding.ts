import { useState, useEffect } from "react";

export interface OrgBranding {
  slug: string | null;
  orgName: string | null;
  logoUrl: string | null;
  isLoading: boolean;
}

const RESERVED_SUBDOMAINS = new Set(["www", "app", "api", "mail", "smtp", "admin", "staging", "dev"]);

function getOrgSlug(): string | null {
  if (typeof window === "undefined") return null;
  const hostname = window.location.hostname;
  const parts = hostname.split(".");
  // *.leavara.net (3+ parts, last two are leavara.net) — skip reserved subdomains
  if (parts.length >= 3 && parts.slice(-2).join(".") === "leavara.net") {
    const sub = parts.slice(0, -2).join(".");
    if (!RESERVED_SUBDOMAINS.has(sub)) return sub;
  }
  return new URLSearchParams(window.location.search).get("org");
}

export function useOrgBranding(): OrgBranding {
  const [slug] = useState<string | null>(() => getOrgSlug());
  const [orgName, setOrgName] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(!!slug);

  useEffect(() => {
    if (!slug) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    fetch(`/api/portal/org/${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setOrgName(data.name ?? null);
          setLogoUrl(data.logoUrl ?? null);
        }
      })
      .catch(() => {}) // non-critical — just don't show logo
      .finally(() => setIsLoading(false));
  }, [slug]);

  return { slug, orgName, logoUrl, isLoading };
}

export { getOrgSlug };
