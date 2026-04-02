import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { UserPlus, Mail, Shield, User, ToggleLeft, ToggleRight, Loader2 } from "lucide-react";
import { useAuth, apiFetch } from "@/lib/auth";

const API_BASE = "";

interface HrUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  position: string;
  role: "admin" | "user";
  isActive: boolean;
  createdAt: string;
}

function RoleBadge({ role }: { role: "admin" | "user" }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${
      role === "admin"
        ? "bg-[#F5E8DF] text-[#9E5D38] border-[#C97E5966]"
        : "bg-stone-100 text-[#A47864] border-stone-200"
    }`}>
      {role === "admin" ? <Shield className="w-3 h-3" /> : <User className="w-3 h-3" />}
      {role === "admin" ? "Administrator" : "HR User"}
    </span>
  );
}

export default function Users() {
  const { token, user: me } = useAuth();
  const qc = useQueryClient();

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "user">("user");
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["hr-users"],
    queryFn: () =>
      apiFetch<{ users: HrUser[] }>("/api/auth/users"),
  });

  const toggleActive = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      fetch(`${API_BASE}/api/auth/users/${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token ?? ""}`,
        },
        body: JSON.stringify({ isActive }),
      }).then(async (res) => {
        if (!res.ok) {
          const d = (await res.json()) as { error?: string };
          throw new Error(d.error ?? "Failed to update user");
        }
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr-users"] }),
  });

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError(null);
    setInviteSuccess(false);
    setInviteLoading(true);
    try {
      await apiFetch("/api/auth/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      setInviteSuccess(true);
      setInviteEmail("");
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Failed to send invite");
    } finally {
      setInviteLoading(false);
    }
  }

  if (me?.role !== "admin") {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-48">
          <p className="text-muted-foreground">Administrator access required.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-8 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground">User Management</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Invite new users and manage existing accounts.
          </p>
        </div>

        {/* Invite form */}
        <div className="bg-white border border-border rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <UserPlus className="w-5 h-5 text-primary" />
            <h2 className="text-base font-semibold">Invite a New User</h2>
          </div>
          <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3 items-start">
            <div className="flex-1 min-w-0">
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => { setInviteEmail(e.target.value); setInviteSuccess(false); setInviteError(null); }}
                placeholder="colleague@company.com"
                className="w-full px-4 py-2.5 rounded-xl border border-input bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
              />
            </div>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as "admin" | "user")}
              className="px-4 py-2.5 rounded-xl border border-input bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
            >
              <option value="user">HR User</option>
              <option value="admin">Administrator</option>
            </select>
            <button
              type="submit"
              disabled={inviteLoading}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-60 text-white font-semibold rounded-xl text-sm transition-colors whitespace-nowrap"
            >
              {inviteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              Send Invite
            </button>
          </form>
          {inviteSuccess && (
            <p className="mt-3 text-sm flex items-center gap-1.5" style={{ color: "#9E5D38" }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Invitation sent to {inviteEmail || "the user"}
            </p>
          )}
          {inviteError && (
            <p className="mt-3 text-destructive text-sm">{inviteError}</p>
          )}
        </div>

        {/* Users table */}
        <div className="bg-white border border-border rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-base font-semibold">All Users</h2>
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="divide-y divide-border">
              {(data?.users ?? []).map((u) => (
                <div key={u.id} className="px-6 py-4 flex items-center gap-4">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0" style={{ background: "linear-gradient(135deg, #E8872A 0%, #C97E59 100%)" }}>
                    {u.firstName[0]}{u.lastName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground">
                      {u.firstName} {u.lastName}
                      {u.id === me?.id && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{u.email} · {u.position}</p>
                  </div>
                  <RoleBadge role={u.role} />
                  <button
                    onClick={() => {
                      if (u.id === me?.id) return;
                      toggleActive.mutate({ userId: u.id, isActive: !u.isActive });
                    }}
                    disabled={u.id === me?.id || toggleActive.isPending}
                    title={u.id === me?.id ? "Cannot deactivate yourself" : u.isActive ? "Deactivate" : "Activate"}
                    className="ml-2 text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {u.isActive ? (
                      <ToggleRight className="w-6 h-6" style={{ color: "#C97E59" }} />
                    ) : (
                      <ToggleLeft className="w-6 h-6 text-slate-400" />
                    )}
                  </button>
                  <span className={`text-xs font-medium ${u.isActive ? "" : "text-slate-400"}`} style={u.isActive ? { color: "#C97E59" } : undefined}>
                    {u.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
