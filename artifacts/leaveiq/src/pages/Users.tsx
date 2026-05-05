import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { UserPlus, Mail, Shield, User, ToggleLeft, ToggleRight, Loader2, Plus, AlertTriangle, CheckCircle2, X } from "lucide-react";
import { useAuth, apiFetch } from "@/lib/auth";

const API_BASE = "";

interface HrUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  position: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

function RoleBadge({ role }: { role: string }) {
  const isAdmin = role === "hr_admin" || role === "admin";
  const isManager = role === "manager";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${
      isAdmin
        ? "bg-[#F5E8DF] text-[#9E5D38] border-[#C97E5966]"
        : isManager
        ? "bg-blue-50 text-blue-700 border-blue-200"
        : "bg-stone-100 text-[#A47864] border-stone-200"
    }`}>
      {isAdmin ? <Shield className="w-3 h-3" /> : <User className="w-3 h-3" />}
      {isAdmin ? "HR Admin" : isManager ? "Manager" : "HR User"}
    </span>
  );
}

export default function Users() {
  const { token, user: me } = useAuth();
  const qc = useQueryClient();

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"hr_admin" | "hr_user" | "manager">("hr_user");
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);

  // Direct add user
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({ fullName: "", email: "", role: "manager" });
  const [addUserLoading, setAddUserLoading] = useState(false);
  const [addUserError, setAddUserError] = useState<string | null>(null);
  const [createdUser, setCreatedUser] = useState<{ name: string; email: string; tempPassword: string } | null>(null);

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

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    setAddUserError(null);
    setAddUserLoading(true);
    try {
      const result = await apiFetch<{ id: string; fullName: string; email: string; role: string; isActive: boolean; createdAt: string; tempPassword: string }>(
        "/api/auth/users",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newUser),
        }
      );
      setCreatedUser({ name: result.fullName, email: result.email, tempPassword: result.tempPassword });
      setNewUser({ fullName: "", email: "", role: "manager" });
      setShowAddUser(false);
      qc.invalidateQueries({ queryKey: ["hr-users"] });
    } catch (err) {
      setAddUserError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setAddUserLoading(false);
    }
  }

  if (me?.role !== "hr_admin" && me?.role !== "admin") {
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
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Team Members</h1>
            <p className="text-muted-foreground text-sm mt-1">Manage team members and access.</p>
          </div>
          <button
            onClick={() => { setShowAddUser((v) => !v); setAddUserError(null); }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-colors"
            style={{ background: "#C97E59" }}
          >
            <Plus className="w-4 h-4" /> Add User
          </button>
        </div>

        {/* Temp password reveal after creation */}
        {createdUser && (
          <div className="rounded-2xl border p-5 bg-green-50 border-green-200">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-sm mb-1 text-green-800">
                  ✓ User created — share these credentials with {createdUser.name}
                </p>
                <p className="text-xs text-green-700 mb-2">Email: <strong>{createdUser.email}</strong></p>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-green-700">Temporary password:</span>
                  <code className="text-sm font-mono font-bold px-2 py-0.5 rounded-lg bg-green-100 text-green-900">
                    {createdUser.tempPassword}
                  </code>
                </div>
                <p className="text-xs mt-2 text-green-600">This password is shown once. The user should change it after first login.</p>
              </div>
              <button onClick={() => setCreatedUser(null)} className="p-1 rounded-lg hover:bg-green-200 transition-colors">
                <X className="w-4 h-4 text-green-700" />
              </button>
            </div>
          </div>
        )}

        {/* Add User form */}
        {showAddUser && (
          <div className="bg-white border border-border rounded-2xl p-6 shadow-sm">
            <h2 className="text-base font-semibold mb-4">Add Team Member</h2>
            <form onSubmit={handleAddUser} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={newUser.fullName}
                    onChange={(e) => setNewUser((p) => ({ ...p, fullName: e.target.value }))}
                    placeholder="Jane Smith"
                    className="w-full px-3 py-2 rounded-xl border border-input bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={newUser.email}
                    onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))}
                    placeholder="jane@company.com"
                    className="w-full px-3 py-2 rounded-xl border border-input bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Role *</label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser((p) => ({ ...p, role: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-input bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  >
                    <option value="manager">Manager</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="hr_user">HR Specialist</option>
                    <option value="hr_admin">HR Admin</option>
                  </select>
                </div>
              </div>
              {addUserError && (
                <div className="flex items-center gap-2 text-xs rounded-xl px-3 py-2 border bg-red-50 border-red-200 text-red-700">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  {addUserError}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setShowAddUser(false); setAddUserError(null); }}
                  className="px-4 py-2 rounded-xl text-sm border border-input text-muted-foreground hover:bg-muted/30 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addUserLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition-colors"
                  style={{ background: "#C97E59" }}
                >
                  {addUserLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  Create User
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Invite by email form */}
        <div className="bg-white border border-border rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Mail className="w-5 h-5 text-primary" />
            <h2 className="text-base font-semibold">Invite via Email Link</h2>
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
              onChange={(e) => setInviteRole(e.target.value as "hr_admin" | "hr_user" | "manager")}
              className="px-4 py-2.5 rounded-xl border border-input bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
            >
              <option value="hr_user">HR User</option>
              <option value="hr_admin">HR Admin</option>
              <option value="manager">Manager</option>
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
              <CheckCircle2 className="w-4 h-4" />
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
