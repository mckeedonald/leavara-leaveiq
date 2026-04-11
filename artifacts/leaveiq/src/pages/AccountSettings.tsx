import React, { useState, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth, apiFetch } from "@/lib/auth";
import { User, Lock, Shield, CheckCircle, Eye, EyeOff, Building2, Upload, Image, X } from "lucide-react";
import { cn } from "@/lib/utils";

function SectionCard({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-border rounded-2xl shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-border flex items-start gap-3">
        <div className="p-2 bg-primary/8 rounded-xl">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="font-semibold text-foreground text-base">{title}</h2>
          <p className="text-muted-foreground text-sm mt-0.5">{description}</p>
        </div>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function SuccessBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm border" style={{ background: "#FDF6F0", borderColor: "#C97E5966", color: "#9E5D38" }}>
      <CheckCircle className="w-4 h-4 shrink-0" />
      {message}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
      {message}
    </div>
  );
}

function PasswordInput({
  value,
  onChange,
  placeholder,
  id,
  show,
  onToggle,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  id: string;
  show: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="relative">
      <input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-2.5 pr-10 rounded-xl border border-input bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

export default function AccountSettings() {
  const { user, updateUser } = useAuth();

  // --- Profile state ---
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [position, setPosition] = useState(user?.position ?? "");
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // --- Password state ---
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // --- Logo upload state (admin only) ---
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoLoading, setLogoLoading] = useState(false);
  const [logoSuccess, setLogoSuccess] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [logoDragging, setLogoDragging] = useState(false);
  const logoFileRef = useRef<HTMLInputElement>(null);

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(false);
    setProfileLoading(true);
    try {
      const data = await apiFetch<{ user: { firstName: string; lastName: string; position: string } }>(
        "/api/auth/me",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ firstName, lastName, position }),
        },
      );
      updateUser(data.user);
      setProfileSuccess(true);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setProfileLoading(false);
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters");
      return;
    }

    setPasswordLoading(true);
    try {
      await apiFetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setPasswordLoading(false);
    }
  }

  async function handleLogoUpload(file: File) {
    setLogoError(null);
    setLogoSuccess(false);
    setLogoLoading(true);
    try {
      const formData = new FormData();
      formData.append("logo", file);
      const token = localStorage.getItem("leaveiq_token");
      const res = await fetch("/api/orgs/logo", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const result = await res.json();
      if (!res.ok) throw new Error((result as { error?: string }).error ?? "Upload failed");
      setLogoSuccess(true);
      setLogoPreview(URL.createObjectURL(file));
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : "Failed to upload logo");
    } finally {
      setLogoLoading(false);
    }
  }

  const roleBadge =
    user?.role === "admin" ? (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border" style={{ background: "#F5E8DF", borderColor: "#C97E5966", color: "#9E5D38" }}>
        <Shield className="w-3 h-3" />
        Administrator
      </span>
    ) : (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-stone-100 border border-stone-200 text-[#A47864]">
        <User className="w-3 h-3" />
        HR User
      </span>
    );

  return (
    <AppLayout>
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Account Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your profile and security preferences.
          </p>
        </div>

        {/* Profile section */}
        <SectionCard
          title="Profile Information"
          description="Update your name and job title as they appear in LeaveIQ."
          icon={User}
        >
          {/* Read-only account info */}
          <div className="grid grid-cols-2 gap-4 mb-5 p-4 bg-muted/30 rounded-xl border border-border">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Email</p>
              <p className="text-sm text-foreground font-medium">{user?.email}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Role</p>
              {roleBadge}
            </div>
          </div>

          <form onSubmit={handleProfileSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-foreground mb-1.5">
                  First name
                </label>
                <input
                  id="firstName"
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => { setFirstName(e.target.value); setProfileSuccess(false); }}
                  className="w-full px-4 py-2.5 rounded-xl border border-input bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
                />
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-foreground mb-1.5">
                  Last name
                </label>
                <input
                  id="lastName"
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => { setLastName(e.target.value); setProfileSuccess(false); }}
                  className="w-full px-4 py-2.5 rounded-xl border border-input bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
                />
              </div>
            </div>
            <div>
              <label htmlFor="position" className="block text-sm font-medium text-foreground mb-1.5">
                Position / Title
              </label>
              <input
                id="position"
                type="text"
                required
                value={position}
                onChange={(e) => { setPosition(e.target.value); setProfileSuccess(false); }}
                className="w-full px-4 py-2.5 rounded-xl border border-input bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
              />
            </div>

            {profileSuccess && <SuccessBanner message="Profile updated successfully." />}
            {profileError && <ErrorBanner message={profileError} />}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={profileLoading}
                className={cn(
                  "px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors",
                  "bg-primary hover:bg-primary/90 text-white disabled:opacity-60 disabled:cursor-not-allowed",
                )}
              >
                {profileLoading ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </form>
        </SectionCard>

        {/* Change password section */}
        <SectionCard
          title="Change Password"
          description="Use a strong password that you don't use anywhere else."
          icon={Lock}
        >
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label htmlFor="currentPassword" className="block text-sm font-medium text-foreground mb-1.5">
                Current password
              </label>
              <PasswordInput
                id="currentPassword"
                value={currentPassword}
                onChange={(v) => { setCurrentPassword(v); setPasswordSuccess(false); }}
                placeholder="Enter your current password"
                show={showPasswords}
                onToggle={() => setShowPasswords((v) => !v)}
              />
            </div>
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-foreground mb-1.5">
                New password
              </label>
              <PasswordInput
                id="newPassword"
                value={newPassword}
                onChange={(v) => { setNewPassword(v); setPasswordSuccess(false); }}
                placeholder="Min. 8 characters"
                show={showPasswords}
                onToggle={() => setShowPasswords((v) => !v)}
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground mb-1.5">
                Confirm new password
              </label>
              <PasswordInput
                id="confirmPassword"
                value={confirmPassword}
                onChange={(v) => { setConfirmPassword(v); setPasswordSuccess(false); }}
                placeholder="Repeat your new password"
                show={showPasswords}
                onToggle={() => setShowPasswords((v) => !v)}
              />
            </div>

            {/* Password strength hint */}
            {newPassword.length > 0 && (
              <div className="space-y-1.5">
                {[
                  { label: "At least 8 characters", ok: newPassword.length >= 8 },
                  { label: "Contains a number", ok: /\d/.test(newPassword) },
                  { label: "Contains a letter", ok: /[a-zA-Z]/.test(newPassword) },
                ].map(({ label, ok }) => (
                  <div key={label} className="flex items-center gap-2 text-xs">
                    <span style={ok ? { color: "#C97E59" } : undefined} className={ok ? "" : "text-muted-foreground"}>
                      {ok ? "✓" : "○"}
                    </span>
                    <span style={ok ? { color: "#9E5D38" } : undefined} className={ok ? "" : "text-muted-foreground"}>{label}</span>
                  </div>
                ))}
              </div>
            )}

            {passwordSuccess && <SuccessBanner message="Password changed successfully." />}
            {passwordError && <ErrorBanner message={passwordError} />}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={passwordLoading || !currentPassword || !newPassword || !confirmPassword}
                className={cn(
                  "px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors",
                  "bg-primary hover:bg-primary/90 text-white disabled:opacity-60 disabled:cursor-not-allowed",
                )}
              >
                {passwordLoading ? "Updating…" : "Update Password"}
              </button>
            </div>
          </form>
        </SectionCard>

        {/* Organization Logo (admin only) */}
        {user?.role === "admin" && (
          <SectionCard
            title="Organization Logo"
            description="Upload your organization's logo. It will appear on the employee portal, case page, and HR sidebar."
            icon={Building2}
          >
            <div className="space-y-4">
              {/* Drop zone */}
              <div
                className={cn(
                  "relative border-2 border-dashed rounded-2xl transition-all cursor-pointer flex flex-col items-center justify-center gap-3 py-10 px-6 text-center",
                  logoDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"
                )}
                onClick={() => logoFileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setLogoDragging(true); }}
                onDragLeave={() => setLogoDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setLogoDragging(false);
                  const file = e.dataTransfer.files[0];
                  if (file) handleLogoUpload(file);
                }}
              >
                <input
                  ref={logoFileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleLogoUpload(file);
                    e.target.value = "";
                  }}
                />

                {logoPreview ? (
                  <div className="flex flex-col items-center gap-3">
                    <img
                      src={logoPreview}
                      alt="Organization logo preview"
                      className="max-h-[80px] max-w-[180px] object-contain rounded-lg"
                    />
                    <p className="text-xs text-muted-foreground">Click to replace</p>
                  </div>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "#F5E8DF" }}>
                      {logoLoading ? (
                        <Upload className="w-6 h-6 animate-bounce" style={{ color: "#C97E59" }} />
                      ) : (
                        <Image className="w-6 h-6" style={{ color: "#C97E59" }} />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {logoLoading ? "Uploading…" : "Click to upload or drag & drop"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        PNG, JPG, SVG, GIF, WebP — max 5 MB
                      </p>
                    </div>
                  </>
                )}
              </div>

              {logoSuccess && (
                <SuccessBanner message="Logo uploaded successfully. It will appear across the portal." />
              )}
              {logoError && <ErrorBanner message={logoError} />}

              {logoPreview && (
                <button
                  type="button"
                  onClick={() => { setLogoPreview(null); setLogoSuccess(false); setLogoError(null); }}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-3 h-3" /> Clear preview
                </button>
              )}
            </div>
          </SectionCard>
        )}

        {/* Session info */}
        <SectionCard
          title="Session"
          description="Information about your current login session."
          icon={Shield}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between py-3 border-b border-border">
              <div>
                <p className="text-sm font-medium text-foreground">Session duration</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Sessions expire after 8 hours of inactivity
                </p>
              </div>
              <span className="text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-full">
                8 hours
              </span>
            </div>
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-foreground">Signed in as</p>
                <p className="text-xs text-muted-foreground mt-0.5">{user?.email}</p>
              </div>
              <span className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border" style={{ color: "#9E5D38", background: "#FDF6F0", borderColor: "#C97E5966" }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#C97E59" }} />
                Active
              </span>
            </div>
          </div>
        </SectionCard>
      </div>
    </AppLayout>
  );
}
