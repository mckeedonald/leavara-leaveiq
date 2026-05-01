import React, { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Files,
  Settings,
  LogOut,
  Search,
  MessageSquare,
  Users,
  ShieldAlert,
  CalendarDays,
  Building2,
  TrendingUp,
  ShieldCheck,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { NotificationsDropdown } from "./NotificationsDropdown";

const S = {
  sidebar: "#C97E59",
  sidebarBorder: "#B56A44",
  activeItem: "#FFFFFF",
  activeItemBg: "rgba(255,255,255,0.22)",
  activeItemBorder: "#FFFFFF",
  textOnDark: "#FFFFFF",
  textMutedDark: "rgba(255,255,255,0.78)",
  logoBadgeBg: "rgba(255,255,255,0.18)",
  logoBadgeBorder: "rgba(255,255,255,0.30)",
  userCardBg: "rgba(0,0,0,0.12)",
  userCardBorder: "rgba(255,255,255,0.20)",
  avatarFrom: "#7A3D18",
  avatarTo: "#EAA292",
  adminBadge: "#FFE4D6",

  headerBg: "#FFFFFF",
  headerBorder: "#D4C9BB",
  searchBg: "#F7F4F0",
};

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [location, navigate] = useLocation();
  const { user, logout, updateUser } = useAuth();
  const [orgLogoUrl, setOrgLogoUrl] = useState<string | null>(null);
  const [hasPerformIq, setHasPerformIq] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("leavara_token") ?? localStorage.getItem("leaveiq_token");
    if (!token) return;
    fetch("/api/orgs/me", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.logoUrl) setOrgLogoUrl(data.logoUrl);
        if (data?.hasPerformIq) {
          setHasPerformIq(true);
          // Patch stale cached user object so PiqProtectedRoute works without re-login
          if (user && !user.hasPerformIq) updateUser({ hasPerformIq: true });
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isSuperAdmin = user?.isSuperAdmin ?? false;
  const isManager = user?.role === "manager";
  const isHrAdmin = user?.role === "hr_admin";

  const navItems = isSuperAdmin
    ? [
        { icon: ShieldAlert, label: "Super Admin", href: "/leaveiq/superadmin", show: true },
      ]
    : isManager
    ? [
        { icon: CalendarDays, label: "Team Leave", href: "/leaveiq/manager", show: true },
      ]
    : [
        { icon: LayoutDashboard, label: "Dashboard", href: "/leaveiq/dashboard", show: true },
        { icon: Files, label: "All Cases", href: "/leaveiq/cases", show: true },
        { icon: ShieldCheck, label: "ADA Cases", href: "/leaveiq/ada-cases", show: true },
        { icon: TrendingUp, label: "Analytics", href: "/leaveiq/analytics", show: true },
        { icon: CalendarDays, label: "Leave Calendar", href: "/leaveiq/calendar", show: true },
        { icon: MessageSquare, label: "Employee Portal", href: "/leaveiq/request", show: true },
        { icon: Users, label: "Users", href: "/leaveiq/users", show: isHrAdmin },
        { icon: Building2, label: "HRIS Integration", href: "/leaveiq/hris-settings", show: isHrAdmin },
      ];

  const initials = user
    ? `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase()
    : "?";

  function handleLogout() {
    logout();
    navigate("/leaveiq/login");
  }

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Mobile top bar */}
      <div
        className="md:hidden flex items-center justify-between px-4 py-3 sticky top-0 z-50"
        style={{ background: S.sidebar, borderBottom: `1px solid ${S.sidebarBorder}` }}
      >
        <div className="flex items-center gap-2">
          <img src="/leavara-logo.png" alt="Leavara" className="h-8 w-8 object-contain" />
          <span className="font-display font-bold text-lg tracking-tight" style={{ color: S.textOnDark }}>
            Leave<span style={{ color: "#FFD4B8" }}>IQ</span>
          </span>
        </div>
        <button
          onClick={() => setMobileNavOpen((o) => !o)}
          className="p-2 rounded-lg"
          style={{ color: S.textOnDark }}
        >
          {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile nav overlay */}
      {mobileNavOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 flex flex-col pt-[52px]"
          style={{ background: S.sidebar }}
        >
          <nav className="flex-1 px-4 space-y-1 mt-4 overflow-y-auto">
            {navItems.filter((item) => item.show).map((item) => {
              const isActive = location === item.href || location.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileNavOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 font-medium text-sm",
                    isActive ? "shadow-sm" : "hover:opacity-90"
                  )}
                  style={
                    isActive
                      ? { background: S.activeItemBg, color: S.textOnDark, borderLeft: `3px solid ${S.activeItem}` }
                      : { color: S.textMutedDark, paddingLeft: "calc(0.75rem + 3px)" }
                  }
                >
                  <item.icon className="w-5 h-5" style={{ color: isActive ? S.activeItem : S.textMutedDark }} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="p-4">
            <button
              onClick={() => { handleLogout(); setMobileNavOpen(false); }}
              className="w-full flex items-center justify-center gap-2 text-sm font-medium py-3 rounded-xl border transition-opacity hover:opacity-80"
              style={{ color: S.textMutedDark, borderColor: S.sidebarBorder }}
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Sidebar — desktop only */}
      <aside
        className="hidden md:flex w-64 flex-col shrink-0 md:h-screen sticky top-0 z-50"
        style={{ background: S.sidebar, borderRight: `1px solid ${S.sidebarBorder}` }}
      >
        {/* Logo */}
        <div className="p-5 flex items-center gap-3" style={{ borderBottom: `1px solid ${S.sidebarBorder}` }}>
          <img src="/leavara-logo.png" alt="Leavara" className="h-9 w-9 object-contain shrink-0" />
          <div>
            <h1 className="font-display font-bold text-xl tracking-tight" style={{ color: S.textOnDark }}>
              Leave<span style={{ color: "#FFD4B8" }}>IQ</span>
            </h1>
            <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: S.textMutedDark }}>Leave Management</p>
          </div>
        </div>

        {/* Switch product link — shown when org has PerformIQ */}
        {hasPerformIq && (
          <Link
            href="/hub"
            className="flex items-center gap-2 px-5 py-2.5 text-xs font-medium transition-opacity hover:opacity-80"
            style={{ color: S.textMutedDark, borderBottom: `1px solid ${S.sidebarBorder}` }}
          >
            <TrendingUp className="w-3 h-3" />
            Switch Product
          </Link>
        )}
        {orgLogoUrl && (
          <div className="px-6 py-3 flex items-center" style={{ borderBottom: `1px solid ${S.sidebarBorder}` }}>
            <img src={orgLogoUrl} alt="Organization Logo" className="h-8 max-h-8 max-w-[140px] object-contain" />
          </div>
        )}

        <nav className="flex-1 px-4 space-y-1 mt-4">
          {navItems
            .filter((item) => item.show)
            .map((item) => {
              const isActive = location === item.href || location.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 font-medium text-sm",
                    isActive ? "shadow-sm" : "hover:opacity-90"
                  )}
                  style={
                    isActive
                      ? { background: S.activeItemBg, color: S.textOnDark, borderLeft: `3px solid ${S.activeItem}` }
                      : { color: S.textMutedDark, paddingLeft: "calc(0.75rem + 3px)" }
                  }
                >
                  <item.icon
                    className="w-5 h-5"
                    style={{ color: isActive ? S.activeItem : S.textMutedDark }}
                  />
                  {item.label}
                </Link>
              );
            })}
        </nav>

        {/* User card */}
        <div className="p-4 mt-auto">
          <div className="rounded-2xl p-4 border" style={{ background: S.userCardBg, borderColor: S.userCardBorder }}>
            <Link href="/leaveiq/account" className="flex items-center gap-3 mb-3 group cursor-pointer">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-md shrink-0"
                style={{ background: `linear-gradient(135deg, ${S.avatarFrom}, ${S.avatarTo})` }}
              >
                {initials}
              </div>
              <div className="overflow-hidden flex-1">
                <p className="text-sm font-semibold truncate transition-opacity group-hover:opacity-80" style={{ color: S.textOnDark }}>
                  {user ? `${user.firstName} ${user.lastName}` : "—"}
                </p>
                <p className="text-xs truncate" style={{ color: S.textMutedDark }}>
                  {user?.position ?? ""}
                  {user?.role === "hr_admin" && (
                    <span className="ml-1" style={{ color: S.adminBadge }}>· HR Admin</span>
                  )}
                  {user?.role === "manager" && (
                    <span className="ml-1" style={{ color: S.adminBadge }}>· Manager</span>
                  )}
                </p>
              </div>
              <Settings className="w-3.5 h-3.5 shrink-0 transition-opacity group-hover:opacity-80" style={{ color: S.textMutedDark }} />
            </Link>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 text-xs font-medium py-2 rounded-lg transition-opacity hover:opacity-80"
              style={{ color: S.textMutedDark }}
            >
              <LogOut className="w-3 h-3" /> Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Header */}
        <header
          className="h-16 sticky top-0 z-40 flex items-center justify-between px-6 shrink-0 shadow-sm"
          style={{ background: S.headerBg, borderBottom: `1px solid ${S.headerBorder}` }}
        >
          <div className="flex items-center gap-4 flex-1">
            <div className="relative max-w-md w-full hidden sm:block">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#8C7058" }} />
              <input
                type="text"
                placeholder="Search cases by employee or case number..."
                className="w-full pl-9 pr-4 py-2 text-sm rounded-full outline-none transition-all focus:ring-2"
                style={{ background: S.searchBg, border: "1px solid #D4C9BB", color: "#3D2010", "--tw-ring-color": "#C97E5933" } as React.CSSProperties}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <NotificationsDropdown />
            <Link
              href="/leaveiq/account"
              className="p-2 rounded-full transition-colors inline-flex hover:bg-black/5"
              style={{ color: "#8C7058" }}
              title="Account Settings"
            >
              <Settings className="w-5 h-5" />
            </Link>
          </div>
        </header>

        {/* Scrollable Page Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 relative">
          {children}
        </div>
      </main>
    </div>
  );
}
