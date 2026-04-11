import React, { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { apiFetch } from "@/lib/auth";
import { Loader2, CheckCircle2, AlertTriangle, Link2, RefreshCw, Trash2, Building2 } from "lucide-react";

type Provider = "bamboohr" | "workday" | "adp" | "rippling";

interface HrisConnection {
  id: string;
  provider: Provider;
  lastSyncAt: string | null;
  createdAt: string;
}

const PROVIDERS = [
  { value: "bamboohr" as Provider, label: "BambooHR" },
  { value: "workday" as Provider, label: "Workday" },
  { value: "adp" as Provider, label: "ADP Workforce Now" },
  { value: "rippling" as Provider, label: "Rippling" },
];

const CREDENTIAL_FIELDS: Record<Provider, { name: string; label: string; type?: string; placeholder?: string }[]> = {
  bamboohr: [
    { name: "subdomain", label: "Company Subdomain", placeholder: "yourcompany (from yourcompany.bamboohr.com)" },
    { name: "apiKey", label: "API Key", type: "password", placeholder: "BambooHR API key" },
  ],
  workday: [
    { name: "tenantUrl", label: "Tenant URL", placeholder: "https://services1.myworkday.com/..." },
    { name: "clientId", label: "Client ID", placeholder: "OAuth2 client ID" },
    { name: "clientSecret", label: "Client Secret", type: "password", placeholder: "OAuth2 client secret" },
  ],
  adp: [
    { name: "clientId", label: "Client ID", placeholder: "ADP client ID" },
    { name: "clientSecret", label: "Client Secret", type: "password", placeholder: "ADP client secret" },
  ],
  rippling: [
    { name: "apiKey", label: "API Key", type: "password", placeholder: "Rippling API key" },
  ],
};

export default function HrisSettings() {
  const [connection, setConnection] = useState<HrisConnection | null>(null);
  const [isLoadingConn, setIsLoadingConn] = useState(true);
  const [provider, setProvider] = useState<Provider>("bamboohr");
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [syncCount, setSyncCount] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadConnection();
  }, []);

  async function loadConnection() {
    setIsLoadingConn(true);
    try {
      const data = await apiFetch<HrisConnection>("/api/hris/connection");
      setConnection(data);
      setProvider(data.provider);
    } catch {
      setConnection(null);
    } finally {
      setIsLoadingConn(false);
    }
  }

  function handleCredentialChange(name: string, value: string) {
    setCredentials((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setError("");
    setSuccess("");
    try {
      const data = await apiFetch<HrisConnection>("/api/hris/connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, credentials }),
      });
      setConnection(data);
      setCredentials({});
      setSuccess("Connection saved and verified successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save connection.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSync() {
    setIsSyncing(true);
    setError("");
    setSuccess("");
    setSyncCount(null);
    try {
      const data = await apiFetch<{ synced: number }>("/api/hris/sync", { method: "POST" });
      setSyncCount(data.synced);
      setSuccess(`Sync complete — ${data.synced} employee records updated.`);
      await loadConnection();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed.");
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Remove this HRIS connection? Cached employee data will remain but will no longer sync.")) return;
    setIsDeleting(true);
    setError("");
    try {
      await apiFetch("/api/hris/connection", { method: "DELETE" });
      setConnection(null);
      setCredentials({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove connection.");
    } finally {
      setIsDeleting(false);
    }
  }

  const fields = CREDENTIAL_FIELDS[provider];

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto animate-in opacity-0">
        <div className="mb-8">
          <h2 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <Building2 className="w-7 h-7 text-primary" />
            HRIS Integration
          </h2>
          <p className="text-muted-foreground mt-1">
            Connect your HR information system to auto-populate employee data when creating cases.
          </p>
        </div>

        {isLoadingConn ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mr-3" />
            Loading connection status…
          </div>
        ) : (
          <>
            {/* Current connection status */}
            {connection && (
              <div className="rounded-2xl border bg-card p-6 mb-6 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Link2 className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">
                      {PROVIDERS.find((p) => p.value === connection.provider)?.label ?? connection.provider}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {connection.lastSyncAt
                        ? `Last synced ${new Date(connection.lastSyncAt).toLocaleString()}`
                        : "Never synced"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSync}
                    disabled={isSyncing}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
                  >
                    {isSyncing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    Sync Now
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-60"
                  >
                    {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    Remove
                  </button>
                </div>
              </div>
            )}

            {/* Alerts */}
            {error && (
              <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 mb-4">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                {error}
              </div>
            )}
            {success && (
              <div className="flex items-start gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-4">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                {success}
              </div>
            )}

            {/* Connection form */}
            <form onSubmit={handleSave} className="rounded-2xl border bg-card p-6 space-y-6">
              <h3 className="font-display font-bold text-lg">
                {connection ? "Update Connection" : "Connect an HRIS"}
              </h3>

              {/* Provider selector */}
              <div className="space-y-2">
                <label className="text-sm font-semibold">Provider</label>
                <div className="grid grid-cols-2 gap-3">
                  {PROVIDERS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => { setProvider(p.value); setCredentials({}); }}
                      className="flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-all text-left"
                      style={
                        provider === p.value
                          ? { borderColor: "#C97E59", background: "#FDF6F0", color: "#9E5D38" }
                          : { borderColor: "#D4C9BB", background: "#FAFAF8", color: "#5C3D28" }
                      }
                    >
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: provider === p.value ? "#C97E59" : "#D4C9BB" }} />
                      {p.label}
                    </button>
                  ))}
                </div>
                {(provider === "workday" || provider === "adp" || provider === "rippling") && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mt-2">
                    ⚠️ {PROVIDERS.find((p2) => p2.value === provider)?.label} integration is coming soon. Save the connection to register interest.
                  </p>
                )}
              </div>

              {/* Credential fields */}
              {fields.map((field) => (
                <div key={field.name} className="space-y-1">
                  <label className="text-sm font-semibold">{field.label}</label>
                  <input
                    type={field.type ?? "text"}
                    value={credentials[field.name] ?? ""}
                    onChange={(e) => handleCredentialChange(field.name, e.target.value)}
                    placeholder={field.placeholder}
                    className="w-full border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    style={{ borderColor: "#D4C9BB" }}
                  />
                </div>
              ))}

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isSaving || fields.some((f) => !credentials[f.name]?.trim())}
                  className="flex items-center gap-2 px-6 py-2.5 font-medium text-sm rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-50 shadow-md"
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isSaving ? "Testing & Saving…" : connection ? "Update Connection" : "Save & Test Connection"}
                </button>
              </div>
            </form>

            {syncCount !== null && (
              <p className="text-center text-sm text-muted-foreground mt-4">
                ✅ {syncCount} employee records are now cached and available for case creation.
              </p>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
