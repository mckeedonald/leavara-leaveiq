import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  FolderOpen,
  Users,
  Settings,
  LogOut,
  CalendarDays,
  TrendingUp,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePiqAuth, usePiqRole } from "@/lib/piqAuth";

const S = {
  sidebar: "#18263A",
  sidebarBorder: "#2A3A4C",
  activeItemBg: "rgba(255,255,255,0.20)",
  textOnDark: "#FFFFFF",
  textMuted: "rgba(255,255,255,0.72)",
  userCardBg: "rgba(0,0,0,0.14)",
  userCardBorder: "rgba(255,255,255,0.18)",
  headerBg: "#FFFFFF",
  headerBorder: "#E6DECF",
};

interface PiqLayoutProps {
  children: React.ReactNode;
}

export function PiqLayout({ children }: PiqLayoutProps) {
  const [location, navigate] = useLocation();
  const { user, logout } = usePiqAuth();
  const { isHr, isHrAdmin } = usePiqRole();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate("/grow/login");
  }

  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/grow/dashboard", show: true },
    { icon: FolderOpen, label: "Cases", href: "/grow/cases", show: true },
    { icon: TrendingUp, label: "Analytics", href: "/grow/analytics", show: true },
    { icon: Users, label: "Employees", href: "/grow/employees", show: isHr },
    { icon: Settings, label: "Admin Settings", href: "/grow/admin/settings", show: isHrAdmin },
  ].filter((i) => i.show);

  const initials = user
    ? user.fullName
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "?";

  const roleLabels: Record<string, string> = {
    manager: "Manager",
    supervisor: "Supervisor",
    hr_user: "HR Specialist",
    hr_admin: "HR Admin",
    system_admin: "System Admin",
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row" style={{ background: "#F7F4EE" }}>
      {/* Mobile top bar */}
      <div
        className="navy-rail md:hidden flex items-center justify-between px-4 py-3 sticky top-0 z-50"
        style={{ borderBottom: `1px solid ${S.sidebarBorder}` }}
      >
        <div className="flex items-center gap-2">
          <img src="/guildlight-logo.png" alt="Guildlight" className="h-8 w-8 object-contain" />
          <span className="font-display font-bold text-lg tracking-tight" style={{ color: S.textOnDark }}>
            Guildlight <span style={{ color: "#E4CBA0" }}>Grow</span>
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
          className="navy-rail md:hidden fixed inset-0 z-40 flex flex-col pt-[52px]"
        >
          <nav className="flex-1 px-4 space-y-1 mt-4 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = location === item.href || location.startsWith(item.href + "/") ||
                (item.href === "/grow/admin/settings" && location.startsWith("/grow/admin/"));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileNavOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 font-medium text-sm",
                    isActive && "nav-pill-bronze shadow-sm"
                  )}
                  style={
                    isActive
                      ? { color: "#18263A" }
                      : { color: S.textMuted }
                  }
                >
                  <item.icon className="w-5 h-5 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
            <Link
              href="/hub"
              onClick={() => setMobileNavOpen(false)}
              className="flex items-center gap-3 px-3 py-3 rounded-xl font-medium text-sm mt-2 border-t hover:opacity-80"
              style={{ color: S.textMuted, borderColor: S.sidebarBorder, paddingLeft: "calc(0.75rem + 3px)" }}
            >
              <TrendingUp className="w-5 h-5 shrink-0" />
              Switch Product
            </Link>
          </nav>
          <div className="p-4">
            <button
              onClick={() => { handleLogout(); setMobileNavOpen(false); }}
              className="w-full flex items-center justify-center gap-2 text-sm font-medium py-3 rounded-xl border transition-opacity hover:opacity-80"
              style={{ color: S.textMuted, borderColor: S.sidebarBorder }}
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Sidebar — desktop only */}
      <aside
        className="navy-rail hidden md:flex w-64 flex-col shrink-0 md:h-screen sticky top-0 z-50"
        style={{ borderRight: `1px solid ${S.sidebarBorder}` }}
      >
        {/* Brand */}
        <div className="p-5 flex items-center gap-3" style={{ borderBottom: `1px solid ${S.sidebarBorder}` }}>
          <img src="/guildlight-logo.png" alt="Guildlight" className="h-9 w-9 object-contain shrink-0" />
          <div>
            <h1 className="font-display font-bold text-xl tracking-tight" style={{ color: S.textOnDark }}>
              Guildlight <span style={{ color: "#E4CBA0" }}>Grow</span>
            </h1>
            <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: S.textMuted }}>
              Performance Management
            </p>
          </div>
        </div>

        {/* Switch product link */}
        <Link
          href="/hub"
          className="flex items-center gap-2 px-5 py-2.5 text-xs font-medium transition-opacity hover:opacity-80"
          style={{ color: S.textMuted, borderBottom: `1px solid ${S.sidebarBorder}` }}
        >
          <TrendingUp className="w-3 h-3" />
          Switch Product
        </Link>

        {/* Nav */}
        <nav className="flex-1 px-4 space-y-1 mt-4 pb-4">
          {navItems.map((item) => {
            const isActive = location === item.href || location.startsWith(item.href + "/") ||
              (item.href === "/grow/admin/settings" && location.startsWith("/grow/admin/"));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 font-medium text-sm",
                  isActive && "nav-pill-bronze shadow-sm"
                )}
                style={
                  isActive
                    ? { color: "#18263A" }
                    : { color: S.textMuted }
                }
              >
                <item.icon className="w-5 h-5 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User card */}
        <div className="p-4 mt-auto">
          <div className="rounded-2xl p-4 border" style={{ background: S.userCardBg, borderColor: S.userCardBorder }}>
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-md shrink-0"
                style={{ background: "rgba(255,255,255,0.25)" }}
              >
                {initials}
              </div>
              <div className="overflow-hidden flex-1">
                <p className="text-sm font-semibold truncate" style={{ color: S.textOnDark }}>
                  {user?.fullName ?? "—"}
                </p>
                <p className="text-xs truncate" style={{ color: S.textMuted }}>
                  {user ? roleLabels[user.role] ?? user.role : ""}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 text-xs font-medium py-2 rounded-lg transition-opacity hover:opacity-80"
              style={{ color: S.textMuted }}
            >
              <LogOut className="w-3 h-3" /> Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Header */}
        <header
          className="h-16 sticky top-0 z-40 flex items-center justify-between px-6 shrink-0 shadow-sm"
          style={{ background: S.headerBg, borderBottom: `1px solid ${S.headerBorder}` }}
        >
          <div />
          <div className="flex items-center gap-2 text-sm" style={{ color: "#5D6875" }}>
            <span className="w-2 h-2 rounded-full" style={{ background: "#B68B5E" }} />
            <span className="font-medium">Guildlight Grow</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
