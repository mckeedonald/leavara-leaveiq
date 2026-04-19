import { useState, useEffect } from "react";
import { isOrgSubdomain, getOrgSlug } from "./subdomain";

export interface OrgBranding {
  slug: string | null;
  orgName: string | null;
  logoUrl: string | null;
  isLoading: boolean;
  products: ("leaveiq" | "performiq")[];
}

interface OrgApiResponse {
  name?: string;
  logoUrl?: string;
  products?: string[];
}

export function useOrgBranding(): OrgBranding {
  const [slug] = useState<string | null>(() => getOrgSlug());
  const [orgName, setOrgName] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [products, setProducts] = useState<("leaveiq" | "performiq")[]>(["leaveiq"]);
  const [isLoading, setIsLoading] = useState(!!slug);

  useEffect(() => {
    if (!slug) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    fetch(`/api/portal/org/${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: OrgApiResponse | null) => {
        if (data) {
          setOrgName(data.name ?? null);
          setLogoUrl(data.logoUrl ?? null);
          const rawProducts = data.products ?? ["leaveiq"];
          setProducts(
            rawProducts.filter(
              (p): p is "leaveiq" | "performiq" =>
                p === "leaveiq" || p === "performiq"
            )
          );
        }
      })
      .catch(() => {}) // non-critical — just don't show logo
      .finally(() => setIsLoading(false));
  }, [slug]);

  return { slug, orgName, logoUrl, isLoading, products };
}

export { isOrgSubdomain, getOrgSlug };
