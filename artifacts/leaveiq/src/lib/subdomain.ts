export const RESERVED_SUBDOMAINS = new Set([
  "www", "app", "api", "mail", "smtp", "admin",
  "staging", "dev", "leaveiq", "performiq",
]);

export const isOrgSubdomain: boolean = (() => {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  const parts = h.split(".");
  if (parts.length < 3) return false;
  if (parts.slice(-2).join(".") !== "leavara.net") return false;
  const sub = parts.slice(0, -2).join(".");
  return !RESERVED_SUBDOMAINS.has(sub);
})();

export function getOrgSlug(): string | null {
  if (typeof window === "undefined") return null;
  const h = window.location.hostname;
  const parts = h.split(".");
  if (parts.length < 3) return null;
  if (parts.slice(-2).join(".") !== "leavara.net") return null;
  const sub = parts.slice(0, -2).join(".");
  if (RESERVED_SUBDOMAINS.has(sub)) return null;
  return sub;
}
