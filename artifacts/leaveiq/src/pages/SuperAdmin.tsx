import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  Building2, Users, Files, Plus, ToggleLeft, ToggleRight,
  RefreshCcw, Trash2, ChevronRight, Search, CheckCircle2,
  XCircle, AlertCircle, ArrowLeft, UserPlus, Eye, EyeOff,
  ShieldAlert, MapPin, BookOpen, Upload, FileText, Globe, Loader2
} from "lucide-react";
import { apiFetch } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const S = {
  bg: "#F0EEE9",
  card: "#FFFFFF",
  border: "#D4C9BB",
  terracotta: "#C97E59",
  darkTerra: "#9E5D38",
  mocha: "#A47864",
  amber: "#E8872A",
  textDark: "#3D2010",
  textMid: "#7A5540",
  textMuted: "#A07860",
  red: "#DC2626",
  green: "#16A34A",
  headerBg: "#C97E59",
};

type Tab = "organizations" | "cases" | "users";

interface Organization {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  hasLeaveIq: boolean;
  hasPerformIq: boolean;
  userCount: number;
  caseCount: number;
  createdAt: string;
}

interface SuperCase {
  id: string;
  caseNumber: string;
  employeeName: string;
  leaveType: string;
  state: string;
  organizationId: string;
  deletedAt: string | null;
  deletedReason: string | null;
  createdAt: string;
}

interface SuperUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  position: string;
  role: "admin" | "user";
  isActive: boolean;
  isSuperAdmin: boolean;
  createdAt: string;
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number | string; color: string }) {
  return (
    <div className="rounded-2xl p-5 flex items-center gap-4 shadow-sm" style={{ background: S.card, border: `1px solid ${S.border}` }}>
      <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}18` }}>
        <Icon className="w-6 h-6" style={{ color }} />
      </div>
      <div>
        <p className="text-2xl font-bold" style={{ color: S.textDark }}>{value}</p>
        <p className="text-sm" style={{ color: S.textMuted }}>{label}</p>
      </div>
    </div>
  );
}

function OrgRow({
  org,
  onSelect,
  onToggle,
}: {
  org: Organization;
  onSelect: (org: Organization) => void;
  onToggle: (id: string, current: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-black/5 transition-colors cursor-pointer group" onClick={() => onSelect(org)}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${S.terracotta}18` }}>
        <Building2 className="w-5 h-5" style={{ color: S.terracotta }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate" style={{ color: S.textDark }}>{org.name}</p>
        <p className="text-xs" style={{ color: S.textMuted }}>slug: {org.slug} · {org.userCount} users · {org.caseCount} cases</p>
      </div>
      <div className="flex items-center gap-3">
        <span
          className="text-xs px-2 py-0.5 rounded-full font-medium"
          style={{
            background: org.isActive ? "#D4F4DC" : "#FEE2E2",
            color: org.isActive ? "#166534" : "#991B1B",
          }}
        >
          {org.isActive ? "Active" : "Inactive"}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(org.id, org.isActive); }}
          className="p-1 rounded-lg hover:bg-black/10 transition-colors"
          title={org.isActive ? "Deactivate org" : "Activate org"}
        >
          {org.isActive
            ? <ToggleRight className="w-5 h-5" style={{ color: S.terracotta }} />
            : <ToggleLeft className="w-5 h-5" style={{ color: S.textMuted }} />}
        </button>
        <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: S.textMuted }} />
      </div>
    </div>
  );
}

function CreateOrgModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState("");
  const { toast } = useToast();

  const autoSlug = (v: string) => v.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch("/api/superadmin/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug }),
      }),
    onSuccess: () => {
      toast({ title: "Organization created" });
      onCreated();
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="rounded-2xl w-full max-w-md p-6 shadow-2xl" style={{ background: S.card }}>
        <h3 className="text-lg font-bold mb-4" style={{ color: S.textDark }}>New Organization</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide mb-1 block" style={{ color: S.textMuted }}>Company Name</label>
            <input
              className="w-full px-3 py-2 rounded-xl text-sm outline-none focus:ring-2"
              style={{ border: `1px solid ${S.border}`, color: S.textDark, background: S.bg }}
              value={name}
              onChange={(e) => { setName(e.target.value); setSlug(autoSlug(e.target.value)); }}
              placeholder="Acme Corp"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide mb-1 block" style={{ color: S.textMuted }}>Slug (URL identifier)</label>
            <input
              className="w-full px-3 py-2 rounded-xl text-sm outline-none focus:ring-2 font-mono"
              style={{ border: `1px solid ${S.border}`, color: S.textDark, background: S.bg }}
              value={slug}
              onChange={(e) => setSlug(autoSlug(e.target.value))}
              placeholder="acme-corp"
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl text-sm font-medium" style={{ border: `1px solid ${S.border}`, color: S.textMid }}>Cancel</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!name || !slug || mutation.isPending}
            className="flex-1 py-2 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ background: S.terracotta }}
          >
            {mutation.isPending ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateUserModal({ orgId, orgName, onClose, onCreated }: { orgId: string; orgName: string; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ email: "", firstName: "", lastName: "", position: "", role: "admin", password: "" });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/superadmin/organizations/${orgId}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      }),
    onSuccess: () => {
      toast({ title: "User created successfully" });
      onCreated();
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="rounded-2xl w-full max-w-md p-6 shadow-2xl" style={{ background: S.card }}>
        <h3 className="text-lg font-bold mb-1" style={{ color: S.textDark }}>Add User to {orgName}</h3>
        <p className="text-xs mb-4" style={{ color: S.textMuted }}>Create an HR user account for this organization.</p>
        <div className="space-y-3">
          {[
            { key: "email", label: "Email", placeholder: "hr@company.com", type: "email" },
            { key: "firstName", label: "First Name", placeholder: "Jane", type: "text" },
            { key: "lastName", label: "Last Name", placeholder: "Smith", type: "text" },
            { key: "position", label: "Position", placeholder: "HR Manager", type: "text" },
          ].map(({ key, label, placeholder, type }) => (
            <div key={key}>
              <label className="text-xs font-semibold uppercase tracking-wide mb-1 block" style={{ color: S.textMuted }}>{label}</label>
              <input
                type={type}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none focus:ring-2"
                style={{ border: `1px solid ${S.border}`, color: S.textDark, background: S.bg }}
                value={(form as Record<string, string>)[key]}
                onChange={f(key)}
                placeholder={placeholder}
              />
            </div>
          ))}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide mb-1 block" style={{ color: S.textMuted }}>Role</label>
            <select
              className="w-full px-3 py-2 rounded-xl text-sm outline-none"
              style={{ border: `1px solid ${S.border}`, color: S.textDark, background: S.bg }}
              value={form.role}
              onChange={f("role")}
            >
              <option value="hr_admin">HR Admin</option>
              <option value="hr_user">HR User</option>
              <option value="manager">Manager</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide mb-1 block" style={{ color: S.textMuted }}>Temporary Password</label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                className="w-full px-3 py-2 pr-10 rounded-xl text-sm outline-none focus:ring-2"
                style={{ border: `1px solid ${S.border}`, color: S.textDark, background: S.bg }}
                value={form.password}
                onChange={f("password")}
                placeholder="Min 8 characters"
              />
              <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl text-sm font-medium" style={{ border: `1px solid ${S.border}`, color: S.textMid }}>Cancel</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!form.email || !form.firstName || !form.lastName || !form.position || form.password.length < 8 || mutation.isPending}
            className="flex-1 py-2 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ background: S.terracotta }}
          >
            {mutation.isPending ? "Creating…" : "Create User"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface OrgLocation { id: string; state: string; city: string | null; county: string | null; }
interface RagDoc { id: string; name: string; sourceType: string; updatedAt: string; }
interface RegulatoryDoc { name: string; sourceType: string; updatedAt: string; }

function KnowledgeBaseTab({ org }: { org: Organization }) {
  const { toast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [locForm, setLocForm] = useState({ state: "", city: "", county: "" });
  const [uploading, setUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const { data: locsData, refetch: refetchLocs } = useQuery({
    queryKey: ["org-locations", org.id],
    queryFn: () => apiFetch<{ locations: OrgLocation[] }>(`/api/superadmin/organizations/${org.id}/locations`),
  });
  const { data: docsData, refetch: refetchDocs } = useQuery({
    queryKey: ["org-documents", org.id],
    queryFn: () => apiFetch<{ documents: RagDoc[] }>(`/api/superadmin/organizations/${org.id}/documents`),
  });
  const { data: regData, refetch: refetchReg } = useQuery({
    queryKey: ["regulatory-status"],
    queryFn: () => apiFetch<{ regulatoryDocs: RegulatoryDoc[] }>("/api/superadmin/regulatory/status"),
  });

  const addLocation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/superadmin/organizations/${org.id}/locations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(locForm),
      }),
    onSuccess: () => { setLocForm({ state: "", city: "", county: "" }); refetchLocs(); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteLocation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/superadmin/organizations/${org.id}/locations/${id}`, { method: "DELETE" }),
    onSuccess: () => refetchLocs(),
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteDoc = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/superadmin/organizations/${org.id}/documents/${id}`, { method: "DELETE" }),
    onSuccess: () => refetchDocs(),
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const refreshReg = useMutation({
    mutationFn: () =>
      apiFetch("/api/superadmin/regulatory/refresh", { method: "POST" }),
    onSuccess: () => {
      toast({ title: "Refresh started", description: "Regulatory documents are being updated in the background." });
      setTimeout(() => refetchReg(), 5000);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const ALLOWED_TYPES = ["application/pdf", "text/plain", "text/markdown"];
  const ALLOWED_EXTS = [".pdf", ".txt", ".md"];

  function isAllowedFile(file: File): boolean {
    const name = file.name.toLowerCase();
    return ALLOWED_TYPES.includes(file.type) || ALLOWED_EXTS.some((ext) => name.endsWith(ext));
  }

  async function uploadFile(file: File) {
    if (!isAllowedFile(file)) {
      toast({ title: "Invalid file type", description: "Only PDF, TXT, or MD files are supported.", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum file size is 10 MB.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const token = localStorage.getItem("leaveiq_token");
      const res = await fetch(`/api/superadmin/organizations/${org.id}/documents`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload failed" })) as { error?: string };
        throw new Error(err.error ?? "Upload failed");
      }
      toast({ title: "Document uploaded", description: `${file.name} has been processed and indexed.` });
      refetchDocs();
    } catch (err: unknown) {
      toast({ title: "Upload failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (uploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
  }

  const locations = locsData?.locations ?? [];
  const documents = docsData?.documents ?? [];
  const regDocs = regData?.regulatoryDocs ?? [];

  return (
    <div className="space-y-6">
      {/* Locations */}
      <div className="rounded-2xl p-5" style={{ background: S.card, border: `1px solid ${S.border}` }}>
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="w-4 h-4" style={{ color: S.terracotta }} />
          <h4 className="font-semibold text-sm" style={{ color: S.textDark }}>Operating Locations</h4>
        </div>
        <p className="text-xs mb-3" style={{ color: S.textMuted }}>
          Add the states, cities, and counties where this organization operates. This ensures the AI references the correct local leave laws.
        </p>
        <div className="flex gap-2 flex-wrap mb-3">
          {[
            { key: "state", placeholder: "State *", width: "w-28" },
            { key: "city", placeholder: "City", width: "w-28" },
            { key: "county", placeholder: "County", width: "w-28" },
          ].map(({ key, placeholder, width }) => (
            <input
              key={key}
              className={`${width} px-3 py-1.5 rounded-xl text-xs outline-none`}
              style={{ border: `1px solid ${S.border}`, color: S.textDark, background: S.bg }}
              placeholder={placeholder}
              value={(locForm as Record<string, string>)[key]}
              onChange={(e) => setLocForm((p) => ({ ...p, [key]: e.target.value }))}
            />
          ))}
          <button
            onClick={() => addLocation.mutate()}
            disabled={!locForm.state.trim() || addLocation.isPending}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white disabled:opacity-50 flex items-center gap-1"
            style={{ background: S.terracotta }}
          >
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>
        {locations.length === 0 ? (
          <p className="text-xs text-center py-4 rounded-xl" style={{ color: S.textMuted, border: `1px dashed ${S.border}` }}>
            No locations added yet
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {locations.map((loc) => (
              <div key={loc.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: `${S.terracotta}15`, color: S.darkTerra, border: `1px solid ${S.terracotta}30` }}>
                <Globe className="w-3 h-3" />
                {[loc.state, loc.city, loc.county].filter(Boolean).join(", ")}
                <button onClick={() => deleteLocation.mutate(loc.id)} className="ml-1 hover:opacity-70" title="Remove">
                  <XCircle className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Company Documents */}
      <div className="rounded-2xl p-5" style={{ background: S.card, border: `1px solid ${S.border}` }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" style={{ color: S.terracotta }} />
            <h4 className="font-semibold text-sm" style={{ color: S.textDark }}>Company Policy Documents</h4>
          </div>
          <div>
            <input ref={fileInputRef} type="file" accept=".pdf,.txt,.md" className="hidden" onChange={handleFileUpload} />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white disabled:opacity-50"
              style={{ background: S.terracotta }}
            >
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {uploading ? "Processing…" : "Upload Document"}
            </button>
          </div>
        </div>
        <p className="text-xs mb-3" style={{ color: S.textMuted }}>
          Upload employee handbooks, leave policies, or any company-specific documents (PDF or TXT). The AI will reference these when drafting notices.
        </p>
        <div
          className="rounded-xl transition-all"
          onDragOver={handleDragOver}
          onDragEnter={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={isDragOver ? { outline: `2px dashed ${S.terracotta}`, background: `${S.terracotta}08` } : {}}
        >
          {documents.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-8 rounded-xl text-center cursor-pointer transition-colors"
              style={{
                border: isDragOver ? `2px dashed ${S.terracotta}` : `2px dashed ${S.border}`,
                color: isDragOver ? S.terracotta : S.textMuted,
                background: isDragOver ? `${S.terracotta}08` : "transparent",
              }}
              onClick={() => !uploading && fileInputRef.current?.click()}
            >
              {uploading ? (
                <>
                  <Loader2 className="w-8 h-8 mb-2 animate-spin" style={{ color: S.terracotta }} />
                  <p className="text-xs font-medium">Processing document…</p>
                </>
              ) : (
                <>
                  <Upload className="w-8 h-8 mb-2 opacity-40" />
                  <p className="text-xs font-medium">{isDragOver ? "Drop to upload" : "Drop a file here or click Upload Document"}</p>
                  <p className="text-xs mt-1 opacity-70">PDF, TXT, or MD — max 10 MB</p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: S.bg, border: `1px solid ${S.border}` }}>
                  <FileText className="w-4 h-4 shrink-0" style={{ color: S.mocha }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate" style={{ color: S.textDark }}>{doc.name}</p>
                    <p className="text-xs" style={{ color: S.textMuted }}>Indexed {new Date(doc.updatedAt).toLocaleDateString()}</p>
                  </div>
                  <button onClick={() => deleteDoc.mutate(doc.id)} className="p-1 rounded-lg hover:bg-red-50 transition-colors" title="Remove document">
                    <Trash2 className="w-4 h-4" style={{ color: S.red }} />
                  </button>
                </div>
              ))}
              <div
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl mt-1 cursor-pointer transition-colors"
                style={{
                  border: isDragOver ? `2px dashed ${S.terracotta}` : `2px dashed ${S.border}`,
                  color: isDragOver ? S.terracotta : S.textMuted,
                  background: isDragOver ? `${S.terracotta}08` : "transparent",
                }}
                onClick={() => !uploading && fileInputRef.current?.click()}
              >
                {uploading
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Upload className="w-3.5 h-3.5 opacity-50" />}
                <p className="text-xs">{uploading ? "Processing…" : isDragOver ? "Drop to add another document" : "Drop or click to add another document"}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Regulatory Sources */}
      <div className="rounded-2xl p-5" style={{ background: S.card, border: `1px solid ${S.border}` }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Files className="w-4 h-4" style={{ color: S.terracotta }} />
            <h4 className="font-semibold text-sm" style={{ color: S.textDark }}>Regulatory Law Sources</h4>
          </div>
          <button
            onClick={() => refreshReg.mutate()}
            disabled={refreshReg.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold disabled:opacity-50"
            style={{ background: S.bg, border: `1px solid ${S.border}`, color: S.textMid }}
          >
            <RefreshCcw className={`w-3.5 h-3.5 ${refreshReg.isPending ? "animate-spin" : ""}`} />
            Refresh Now
          </button>
        </div>
        <p className="text-xs mb-3" style={{ color: S.textMuted }}>
          Federal FMLA (eCFR), California CFRA, PDL, and PFL regulations are automatically fetched and updated daily at 3 AM.
        </p>
        {regDocs.length === 0 ? (
          <p className="text-xs text-center py-3" style={{ color: S.textMuted }}>No regulatory documents indexed yet — click Refresh Now to seed them.</p>
        ) : (
          <div className="space-y-1.5">
            {regDocs.map((doc) => (
              <div key={doc.name} className="flex items-center justify-between px-3 py-2 rounded-xl" style={{ background: S.bg, border: `1px solid ${S.border}` }}>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: S.green }} />
                  <p className="text-xs font-medium" style={{ color: S.textDark }}>{doc.name}</p>
                </div>
                <p className="text-xs" style={{ color: S.textMuted }}>Updated {new Date(doc.updatedAt).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function OrgDetailPanel({
  org,
  onBack,
  onToggleUser,
  onOrgUpdate,
}: {
  org: Organization;
  onBack: () => void;
  onToggleUser: () => void;
  onOrgUpdate: (updated: Organization) => void;
}) {
  const [activeTab, setActiveTab] = useState<"users" | "products" | "knowledge">("users");
  const [showCreateUser, setShowCreateUser] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["superadmin-org-users", org.id],
    queryFn: () => apiFetch<{ users: SuperUser[] }>(`/api/superadmin/organizations/${org.id}/users`),
  });

  const toggleUser = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      apiFetch(`/api/superadmin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      }),
    onSuccess: () => { refetch(); onToggleUser(); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const changeRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      apiFetch(`/api/superadmin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      }),
    onSuccess: () => refetch(),
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleProduct = useMutation({
    mutationFn: (body: { hasLeaveIq?: boolean; hasPerformIq?: boolean }) =>
      apiFetch<{ organization: Organization }>(`/api/superadmin/organizations/${org.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: (data) => { onOrgUpdate(data.organization); qc.invalidateQueries({ queryKey: ["superadmin-orgs"] }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const TABS = [
    { id: "users" as const, label: "Users", icon: Users },
    { id: "products" as const, label: "Products", icon: Building2 },
    { id: "knowledge" as const, label: "Knowledge Base", icon: BookOpen },
  ];

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-2 text-sm mb-4 hover:opacity-70 transition-opacity" style={{ color: S.terracotta }}>
        <ArrowLeft className="w-4 h-4" /> Back to Organizations
      </button>

      <div className="rounded-2xl p-5 mb-4 shadow-sm" style={{ background: S.card, border: `1px solid ${S.border}` }}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl font-bold" style={{ color: S.textDark }}>{org.name}</h3>
            <p className="text-sm font-mono mt-0.5" style={{ color: S.textMuted }}>slug: {org.slug}</p>
          </div>
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium mt-1"
            style={{ background: org.isActive ? "#D4F4DC" : "#FEE2E2", color: org.isActive ? "#166534" : "#991B1B" }}
          >
            {org.isActive ? "Active" : "Inactive"}
          </span>
        </div>
        <div className="flex gap-4 mt-3 pt-3" style={{ borderTop: `1px solid ${S.border}` }}>
          <span className="text-xs" style={{ color: S.textMuted }}><strong style={{ color: S.textMid }}>{org.userCount}</strong> users</span>
          <span className="text-xs" style={{ color: S.textMuted }}><strong style={{ color: S.textMid }}>{org.caseCount}</strong> active cases</span>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 mb-4 p-1 rounded-xl" style={{ background: S.bg, border: `1px solid ${S.border}` }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all"
            style={activeTab === id
              ? { background: S.card, color: S.terracotta, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }
              : { color: S.textMuted }
            }
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === "users" && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-sm" style={{ color: S.textDark }}>Users</h4>
            <button
              onClick={() => setShowCreateUser(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white"
              style={{ background: S.terracotta }}
            >
              <UserPlus className="w-3.5 h-3.5" /> Add User
            </button>
          </div>
          {isLoading ? (
            <div className="py-8 text-center text-sm" style={{ color: S.textMuted }}>Loading users…</div>
          ) : (data?.users ?? []).length === 0 ? (
            <div className="py-8 text-center text-sm rounded-2xl" style={{ color: S.textMuted, border: `1px dashed ${S.border}` }}>
              No users yet for this organization
            </div>
          ) : (
            <div className="space-y-2">
              {(data?.users ?? []).map((u) => (
                <div key={u.id} className="flex items-center gap-3 px-4 py-3 rounded-xl shadow-sm" style={{ background: S.card, border: `1px solid ${S.border}` }}>
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ background: `linear-gradient(135deg, ${S.amber}, ${S.terracotta})` }}
                  >
                    {u.firstName[0]}{u.lastName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: S.textDark }}>{u.firstName} {u.lastName}</p>
                    <p className="text-xs truncate" style={{ color: S.textMuted }}>{u.email} · {u.position}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      className="text-xs rounded-lg px-2 py-1 outline-none"
                      style={{ border: `1px solid ${S.border}`, color: S.textMid, background: S.bg }}
                      value={u.role}
                      onChange={(e) => changeRole.mutate({ userId: u.id, role: e.target.value })}
                    >
                      <option value="hr_admin">HR Admin</option>
                      <option value="hr_user">HR User</option>
                      <option value="manager">Manager</option>
                    </select>
                    <button
                      onClick={() => toggleUser.mutate({ userId: u.id, isActive: u.isActive })}
                      className="p-1 rounded-lg hover:bg-black/10 transition-colors"
                      title={u.isActive ? "Deactivate" : "Activate"}
                    >
                      {u.isActive
                        ? <ToggleRight className="w-5 h-5" style={{ color: S.terracotta }} />
                        : <ToggleLeft className="w-5 h-5" style={{ color: S.textMuted }} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {showCreateUser && (
            <CreateUserModal
              orgId={org.id}
              orgName={org.name}
              onClose={() => setShowCreateUser(false)}
              onCreated={() => { refetch(); qc.invalidateQueries({ queryKey: ["superadmin-orgs"] }); }}
            />
          )}
        </div>
      )}

      {activeTab === "products" && (
        <div className="space-y-3">
          {[
            {
              key: "hasLeaveIq" as const,
              label: "LeaveIQ",
              description: "Leave management, FMLA tracking, AI-assisted notices, and HR case workflow.",
              color: S.terracotta,
              enabled: org.hasLeaveIq,
            },
            {
              key: "hasPerformIq" as const,
              label: "PerformIQ",
              description: "Performance management, disciplinary documents, coaching workflows, and e-signatures.",
              color: "#2E7B7B",
              enabled: org.hasPerformIq,
            },
          ].map(({ key, label, description, color, enabled }) => (
            <div key={key} className="rounded-2xl p-5 flex items-start gap-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}18` }}>
                <Building2 className="w-5 h-5" style={{ color }} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-sm" style={{ color: S.textDark }}>{label}</p>
                  <button
                    onClick={() => toggleProduct.mutate({ [key]: !enabled })}
                    disabled={toggleProduct.isPending}
                    className="p-1 rounded-lg hover:bg-black/10 transition-colors disabled:opacity-50"
                    title={enabled ? `Disable ${label}` : `Enable ${label}`}
                  >
                    {enabled
                      ? <ToggleRight className="w-6 h-6" style={{ color }} />
                      : <ToggleLeft className="w-6 h-6" style={{ color: S.textMuted }} />}
                  </button>
                </div>
                <p className="text-xs mt-1" style={{ color: S.textMuted }}>{description}</p>
                <div className="mt-2">
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: enabled ? "#D4F4DC" : "#FEE2E2", color: enabled ? "#166534" : "#991B1B" }}
                  >
                    {enabled ? "Enabled" : "Disabled"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "knowledge" && <KnowledgeBaseTab org={org} />}

    </div>
  );
}

function OrganizationsTab() {
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<Organization | null>(null);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["superadmin-orgs"],
    queryFn: () => apiFetch<{ organizations: Organization[] }>("/api/superadmin/organizations"),
  });

  const toggleOrg = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiFetch(`/api/superadmin/organizations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      }),
    onSuccess: () => refetch(),
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const orgs = (data?.organizations ?? []).filter((o) =>
    o.name.toLowerCase().includes(search.toLowerCase()) || o.slug.includes(search.toLowerCase())
  );

  if (selected) {
    return (
      <OrgDetailPanel
        org={selected}
        onBack={() => setSelected(null)}
        onToggleUser={() => qc.invalidateQueries({ queryKey: ["superadmin-orgs"] })}
        onOrgUpdate={(updated) => setSelected(updated)}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: S.textMuted }} />
          <input
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl outline-none"
            style={{ background: S.card, border: `1px solid ${S.border}`, color: S.textDark }}
            placeholder="Search organizations…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: S.terracotta }}
        >
          <Plus className="w-4 h-4" /> New Organization
        </button>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-sm" style={{ color: S.textMuted }}>Loading organizations…</div>
      ) : orgs.length === 0 ? (
        <div className="py-12 text-center text-sm rounded-2xl" style={{ border: `1px dashed ${S.border}`, color: S.textMuted }}>
          No organizations found
        </div>
      ) : (
        <div className="rounded-2xl shadow-sm overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          {orgs.map((org, i) => (
            <div key={org.id} style={i > 0 ? { borderTop: `1px solid ${S.border}` } : {}}>
              <OrgRow
                org={org}
                onSelect={setSelected}
                onToggle={(id, cur) => toggleOrg.mutate({ id, isActive: cur })}
              />
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateOrgModal
          onClose={() => setShowCreate(false)}
          onCreated={() => refetch()}
        />
      )}
    </div>
  );
}

const STATE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  INTAKE: { bg: "#F4F0EB", text: "#7A5540", label: "Intake" },
  ELIGIBILITY_ANALYSIS: { bg: "#FEF3C7", text: "#92400E", label: "Eligibility" },
  HR_REVIEW_QUEUE: { bg: "#FEF3C7", text: "#92400E", label: "HR Review" },
  NOTICE_DRAFTED: { bg: "#FFEDD5", text: "#7C2D12", label: "Notice Drafted" },
  APPROVED: { bg: "#D4F4DC", text: "#166534", label: "Approved" },
  DENIED: { bg: "#FEE2E2", text: "#991B1B", label: "Denied" },
  CLOSED: { bg: "#F4F0EB", text: "#7A5540", label: "Closed" },
  CANCELLED: { bg: "#FEE2E2", text: "#991B1B", label: "Cancelled" },
};

function CasesTab({ organizations }: { organizations: Organization[] }) {
  const [orgFilter, setOrgFilter] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["superadmin-cases", orgFilter, showDeleted],
    queryFn: () => {
      const params = new URLSearchParams();
      if (orgFilter) params.set("orgId", orgFilter);
      params.set("includeDeleted", String(showDeleted));
      return apiFetch<{ cases: SuperCase[] }>(`/api/superadmin/cases?${params}`);
    },
  });

  const restore = useMutation({
    mutationFn: (caseId: string) =>
      apiFetch(`/api/superadmin/cases/${caseId}/restore`, { method: "POST" }),
    onSuccess: () => {
      toast({ title: "Case restored successfully" });
      refetch();
      qc.invalidateQueries({ queryKey: ["superadmin-orgs"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const cases = data?.cases ?? [];
  const orgName = (id: string | null) => id ? (organizations.find((o) => o.id === id)?.name ?? id.slice(0, 8)) : "No Org";

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <select
          className="px-3 py-2 text-sm rounded-xl outline-none"
          style={{ background: S.card, border: `1px solid ${S.border}`, color: S.textDark }}
          value={orgFilter}
          onChange={(e) => setOrgFilter(e.target.value)}
        >
          <option value="">All Organizations</option>
          {organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <button
          onClick={() => setShowDeleted((v) => !v)}
          className={cn("flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors")}
          style={showDeleted
            ? { background: "#DC2626", color: "#FFFFFF" }
            : { background: S.card, border: `1px solid ${S.border}`, color: S.textMid }
          }
        >
          <Trash2 className="w-4 h-4" /> {showDeleted ? "Showing Deleted" : "Show Deleted Cases"}
        </button>
        <button onClick={() => refetch()} className="p-2 rounded-xl hover:bg-black/5" style={{ color: S.textMuted }}>
          <RefreshCcw className="w-4 h-4" />
        </button>
      </div>

      {showDeleted && (
        <div className="mb-4 px-4 py-3 rounded-xl flex items-start gap-3" style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
          <p className="text-xs text-red-700">Showing soft-deleted cases. Use "Restore" to bring a case back to active status.</p>
        </div>
      )}

      {isLoading ? (
        <div className="py-12 text-center text-sm" style={{ color: S.textMuted }}>Loading cases…</div>
      ) : cases.length === 0 ? (
        <div className="py-12 text-center text-sm rounded-2xl" style={{ border: `1px dashed ${S.border}`, color: S.textMuted }}>
          {showDeleted ? "No deleted cases found" : "No cases found"}
        </div>
      ) : (
        <div className="rounded-2xl shadow-sm overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: `1px solid ${S.border}`, background: S.bg }}>
                {["Case #", "Employee", "Organization", "Type", "Status", showDeleted ? "Reason" : "Created", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: S.textMuted }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cases.map((c, i) => {
                const stateInfo = STATE_COLORS[c.state] ?? { bg: "#F4F0EB", text: "#7A5540", label: c.state };
                return (
                  <tr key={c.id} style={i > 0 ? { borderTop: `1px solid ${S.border}` } : {}}>
                    <td className="px-4 py-3 font-mono text-xs font-semibold" style={{ color: S.textDark }}>{c.caseNumber}</td>
                    <td className="px-4 py-3 text-sm" style={{ color: S.textDark }}>{c.employeeName}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: S.textMuted }}>{orgName(c.organizationId)}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: S.textMid }}>{c.leaveType?.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: stateInfo.bg, color: stateInfo.text }}>
                        {stateInfo.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: S.textMuted }}>
                      {showDeleted
                        ? (c.deletedReason ?? "—")
                        : new Date(c.createdAt).toLocaleDateString("en-US")}
                    </td>
                    <td className="px-4 py-3">
                      {showDeleted && (
                        <button
                          onClick={() => restore.mutate(c.id)}
                          disabled={restore.isPending}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-white transition-opacity disabled:opacity-50"
                          style={{ background: S.terracotta }}
                        >
                          <RefreshCcw className="w-3 h-3" /> Restore
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function UsersTab({ organizations }: { organizations: Organization[] }) {
  const [orgFilter, setOrgFilter] = useState(organizations[0]?.id ?? "");
  const [showCreateUser, setShowCreateUser] = useState(false);
  const { toast } = useToast();

  const selectedOrg = organizations.find((o) => o.id === orgFilter);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["superadmin-org-users", orgFilter],
    queryFn: () =>
      orgFilter
        ? apiFetch<{ users: SuperUser[] }>(`/api/superadmin/organizations/${orgFilter}/users`)
        : Promise.resolve({ users: [] }),
    enabled: !!orgFilter,
  });

  const toggleUser = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      apiFetch(`/api/superadmin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      }),
    onSuccess: () => refetch(),
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const changeRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      apiFetch(`/api/superadmin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      }),
    onSuccess: () => refetch(),
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const users = data?.users ?? [];

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <select
          className="px-3 py-2 text-sm rounded-xl outline-none flex-1 max-w-xs"
          style={{ background: S.card, border: `1px solid ${S.border}`, color: S.textDark }}
          value={orgFilter}
          onChange={(e) => setOrgFilter(e.target.value)}
        >
          <option value="">Select organization…</option>
          {organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        {orgFilter && (
          <button
            onClick={() => setShowCreateUser(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: S.terracotta }}
          >
            <UserPlus className="w-4 h-4" /> Add User
          </button>
        )}
      </div>

      {!orgFilter ? (
        <div className="py-12 text-center text-sm rounded-2xl" style={{ border: `1px dashed ${S.border}`, color: S.textMuted }}>
          Select an organization to view its users
        </div>
      ) : isLoading ? (
        <div className="py-12 text-center text-sm" style={{ color: S.textMuted }}>Loading users…</div>
      ) : users.length === 0 ? (
        <div className="py-12 text-center text-sm rounded-2xl" style={{ border: `1px dashed ${S.border}`, color: S.textMuted }}>
          No users in this organization yet
        </div>
      ) : (
        <div className="rounded-2xl shadow-sm overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: `1px solid ${S.border}`, background: S.bg }}>
                {["User", "Email", "Position", "Role", "Status", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: S.textMuted }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={u.id} style={i > 0 ? { borderTop: `1px solid ${S.border}` } : {}}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ background: `linear-gradient(135deg, ${S.amber}, ${S.terracotta})` }}
                      >
                        {u.firstName[0]}{u.lastName[0]}
                      </div>
                      <span className="font-medium" style={{ color: S.textDark }}>{u.firstName} {u.lastName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: S.textMuted }}>{u.email}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: S.textMid }}>{u.position}</td>
                  <td className="px-4 py-3">
                    <select
                      className="text-xs rounded-lg px-2 py-1 outline-none"
                      style={{ border: `1px solid ${S.border}`, color: S.textMid, background: S.bg }}
                      value={u.role}
                      onChange={(e) => changeRole.mutate({ userId: u.id, role: e.target.value })}
                    >
                      <option value="hr_admin">HR Admin</option>
                      <option value="hr_user">HR User</option>
                      <option value="manager">Manager</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{
                        background: u.isActive ? "#D4F4DC" : "#FEE2E2",
                        color: u.isActive ? "#166534" : "#991B1B",
                      }}
                    >
                      {u.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleUser.mutate({ userId: u.id, isActive: u.isActive })}
                      className="p-1 rounded-lg hover:bg-black/10 transition-colors"
                      title={u.isActive ? "Deactivate" : "Activate"}
                    >
                      {u.isActive
                        ? <ToggleRight className="w-5 h-5" style={{ color: S.terracotta }} />
                        : <ToggleLeft className="w-5 h-5" style={{ color: S.textMuted }} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreateUser && selectedOrg && (
        <CreateUserModal
          orgId={selectedOrg.id}
          orgName={selectedOrg.name}
          onClose={() => setShowCreateUser(false)}
          onCreated={() => refetch()}
        />
      )}
    </div>
  );
}

export default function SuperAdmin() {
  const [activeTab, setActiveTab] = useState<Tab>("organizations");

  const { data: orgsData } = useQuery({
    queryKey: ["superadmin-orgs"],
    queryFn: () => apiFetch<{ organizations: Organization[] }>("/api/superadmin/organizations"),
  });

  const organizations = orgsData?.organizations ?? [];

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "organizations", label: "Organizations", icon: Building2 },
    { id: "cases", label: "Cases", icon: Files },
    { id: "users", label: "Users", icon: Users },
  ];

  return (
    <AppLayout>
    <div>
      {/* Super Admin Header */}
      <div className="px-6 py-5 mb-6 rounded-2xl shadow-sm" style={{ background: `linear-gradient(135deg, #7A3D18, #C97E59)` }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.18)" }}>
            <ShieldAlert className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Super Admin</h1>
            <p className="text-sm text-white/70">Leavara platform administration — all tenants</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-5">
          <div className="rounded-xl px-4 py-3 text-white" style={{ background: "rgba(255,255,255,0.12)" }}>
            <p className="text-2xl font-bold">{organizations.length}</p>
            <p className="text-xs text-white/70 mt-0.5">Organizations</p>
          </div>
          <div className="rounded-xl px-4 py-3 text-white" style={{ background: "rgba(255,255,255,0.12)" }}>
            <p className="text-2xl font-bold">{organizations.reduce((s, o) => s + (o.userCount ?? 0), 0)}</p>
            <p className="text-xs text-white/70 mt-0.5">Total Users</p>
          </div>
          <div className="rounded-xl px-4 py-3 text-white" style={{ background: "rgba(255,255,255,0.12)" }}>
            <p className="text-2xl font-bold">{organizations.reduce((s, o) => s + (o.caseCount ?? 0), 0)}</p>
            <p className="text-xs text-white/70 mt-0.5">Active Cases</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-2xl mb-6" style={{ background: S.card, border: `1px solid ${S.border}` }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={activeTab === t.id
              ? { background: S.terracotta, color: "#FFFFFF" }
              : { color: S.textMid }}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === "organizations" && <OrganizationsTab />}
        {activeTab === "cases" && <CasesTab organizations={organizations} />}
        {activeTab === "users" && <UsersTab organizations={organizations} />}
      </div>
    </div>
    </AppLayout>
  );
}
