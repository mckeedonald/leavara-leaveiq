import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  FolderOpen,
  Users,
  Settings,
  LogOut,
  ChevronDown,
  CalendarDays,
  TrendingUp,
  BookOpen,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePiqAuth, usePiqRole } from "@/lib/piqAuth";

const S = {
  sidebar: "#2E7B7B",
  sidebarBorder: "#1F5858",
  activeItemBg: "rgba(255,255,255,0.20)",
  textOnDark: "#FFFFFF",
  textMuted: "rgba(255,255,255,0.72)",
  userCardBg: "rgba(0,0,0,0.14)",
  userCardBorder: "rgba(255,255,255,0.18)",
  headerBg: "#FFFFFF",
  headerBorder: "#D4C9BB",
};

interface PiqLayoutProps {
  children: React.ReactNode;
}

export function PiqLayout({ children }: PiqLayoutProps) {
  const [location, navigate] = useLocation();
  const { user, logout } = usePiqAuth();
  const { isHr, isHrAdmin } = usePiqRole();

  function handleLogout() {
    logout();
    navigate("/performiq/login");
  }

  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/performiq/dashboard", show: true },
    { icon: FolderOpen, label: "Cases", href: "/performiq/cases", show: true },
    { icon: TrendingUp, label: "Analytics", href: "/performiq/analytics", show: true },
    { icon: Users, label: "Employees", href: "/performiq/employees", show: isHr },
    { icon: BookOpen, label: "Policies", href: "/performiq/admin/policies", show: isHrAdmin },
    { icon: FileText, label: "Document Types", href: "/performiq/admin/document-types", show: isHrAdmin },
    { icon: Settings, label: "Team Settings", href: "/performiq/admin/users", show: isHrAdmin },
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
    <div className="min-h-screen flex flex-col md:flex-row" style={{ background: "#F4F6FB" }}>
      {/* Sidebar */}
      <aside
        className="w-full md:w-64 flex flex-col shrink-0 md:h-screen sticky top-0 z-50"
        style={{ background: S.sidebar, borderRight: `1px solid ${S.sidebarBorder}` }}
      >
        {/* Brand */}
        <div className="p-5 flex items-center gap-3" style={{ borderBottom: `1px solid ${S.sidebarBorder}` }}>
          <img src="/leavara-logo.png" alt="Leavara" className="h-9 w-9 object-contain shrink-0" />
          <div>
            <h1 className="font-display font-bold text-xl tracking-tight" style={{ color: S.textOnDark }}>
              Perform<span style={{ color: "#A8D9D9" }}>IQ</span>
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
            const isActive = location === item.href || location.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn("flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 font-medium text-sm")}
                style={
                  isActive
                    ? { background: S.activeItemBg, color: S.textOnDark, borderLeft: "3px solid rgba(255,255,255,0.9)" }
                    : { color: S.textMuted, paddingLeft: "calc(0.75rem + 3px)" }
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
          <div className="flex items-center gap-2 text-sm" style={{ color: "#8C7058" }}>
            <span className="w-2 h-2 rounded-full" style={{ background: "#2E7B7B" }} />
            <span className="font-medium">PerformIQ</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
