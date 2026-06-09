import React from "react";
import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { PiqAuthProvider, usePiqAuth } from "@/lib/piqAuth";
import { isOrgSubdomain } from "@/lib/subdomain";

import Landing from "@/pages/Landing";
import OrgLanding from "@/pages/OrgLanding";
import Interest from "@/pages/Interest";
import ProductSelector from "@/pages/ProductSelector";
import HubDashboard from "@/pages/HubDashboard";
import Dashboard from "@/pages/Dashboard";
import ManagerDashboard from "@/pages/ManagerDashboard";
import Cases from "@/pages/Cases";
import CaseDetail from "@/pages/CaseDetail";
import EmployeePortal from "@/pages/EmployeePortal";
import EmployeePortalCase from "@/pages/EmployeePortalCase";
import Login from "@/pages/Login";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import Register from "@/pages/Register";
import Users from "@/pages/Users";
import AccountSettings from "@/pages/AccountSettings";
import SuperAdmin from "@/pages/SuperAdmin";
import HrisSettings from "@/pages/HrisSettings";
import Calendar from "@/pages/Calendar";
import GuildlightGrowDashboard from "@/pages/GuildlightGrowDashboard";
import NotFound from "@/pages/not-found";

// Guildlight Grow pages
import PiqLogin from "@/pages/performiq/Login";
import PiqDashboard from "@/pages/performiq/Dashboard";
import PiqCaseList from "@/pages/performiq/CaseList";
import PiqCaseDetail from "@/pages/performiq/CaseDetail";
import NewCase from "@/pages/performiq/NewCase";
import PiqEmployees from "@/pages/performiq/Employees";
import PiqEmployeeProfile from "@/pages/performiq/EmployeeProfile";
import PiqAdminSettings from "@/pages/performiq/AdminSettings";
import PiqAnalytics from "@/pages/performiq/Analytics";
import SignDocument from "@/pages/performiq/SignDocument";
import Analytics from "@/pages/Analytics";
import AdaCases from "@/pages/AdaCases";
import AdaCase from "@/pages/AdaCase";
import AdminAudit from "@/pages/AdminAudit";
import Employees from "@/pages/Employees";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) return null;
  if (!user) return <Redirect to={`/leave/login?redirect=${encodeURIComponent(location)}`} />;
  return <Component />;
}

function SuperAdminRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) return null;
  if (!user) return <Redirect to={`/leave/login?redirect=${encodeURIComponent(location)}`} />;
  if (!user.isSuperAdmin) return <Redirect to="/leave/dashboard" />;
  return <Component />;
}

function GuestRoute({ component: Component }: { component: React.ComponentType }) {
  const { user } = useAuth();
  if (user?.isSuperAdmin) return <Redirect to="/leave/superadmin" />;
  if (user?.hasLeaveIq && user?.hasPerformIq) return <Redirect to="/hub" />;
  if (user?.hasPerformIq) return <Redirect to="/grow/dashboard" />;
  if (user) return <Redirect to="/leave/dashboard" />;
  return <Component />;
}

function PiqProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = usePiqAuth();
  const [location] = useLocation();
  if (isLoading) return null;
  if (!user) return <Redirect to={`/grow/login?redirect=${encodeURIComponent(location)}`} />;
  return <Component />;
}

function PiqGuestRoute({ component: Component }: { component: React.ComponentType }) {
  const { user } = usePiqAuth();
  if (user) return <Redirect to="/grow/dashboard" />;
  return <Component />;
}

// NavRedirect — used for backward-compat route redirects; reads window.location.search at render time
function NavRedirect({ to }: { to: string }) {
  const [, navigate] = useLocation();
  React.useEffect(() => { navigate(to, { replace: true }); }, [to, navigate]);
  return null;
}

function Router() {
  return (
    <Switch>
      {/* Root */}
      <Route path="/" component={isOrgSubdomain ? OrgLanding : Landing} />

      {/* Public interest / get-started form */}
      <Route path="/interest" component={Interest} />

      {/* Guildlight Leave employee routes */}
      <Route path="/leave/request" component={EmployeePortal} />
      <Route path="/leave/portal" component={EmployeePortalCase} />

      {/* Hub — unified landing for orgs with both products */}
      <Route path="/hub" component={() => <ProtectedRoute component={HubDashboard} />} />

      {/* Legacy product selector → hub */}
      <Route path="/product-select" component={() => <Redirect to="/hub" />} />

      {/* Guildlight Leave HR routes */}
      <Route path="/leave/login" component={() => <GuestRoute component={Login} />} />
      <Route path="/leave/forgot-password" component={() => <GuestRoute component={ForgotPassword} />} />
      <Route path="/leave/reset-password" component={ResetPassword} />
      <Route path="/leave/register" component={Register} />
      <Route path="/leave/dashboard" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/leave/manager" component={() => <ProtectedRoute component={ManagerDashboard} />} />
      <Route path="/leave/cases" component={() => <ProtectedRoute component={Cases} />} />
      <Route path="/leave/cases/:caseId" component={() => <ProtectedRoute component={CaseDetail} />} />
      <Route path="/leave/users" component={() => <ProtectedRoute component={Users} />} />
      <Route path="/leave/account" component={() => <ProtectedRoute component={AccountSettings} />} />
      <Route path="/leave/calendar" component={() => <ProtectedRoute component={Calendar} />} />
      <Route path="/leave/hris-settings" component={() => <ProtectedRoute component={HrisSettings} />} />
      <Route path="/leave/analytics" component={() => <ProtectedRoute component={Analytics} />} />
      <Route path="/leave/audit" component={() => <ProtectedRoute component={AdminAudit} />} />
      <Route path="/leave/employees" component={() => <ProtectedRoute component={Employees} />} />
      <Route path="/leave/ada-cases" component={() => <ProtectedRoute component={AdaCases} />} />
      <Route path="/leave/ada-cases/:caseId" component={() => <ProtectedRoute component={AdaCase} />} />
      <Route path="/leave/superadmin" component={() => <SuperAdminRoute component={SuperAdmin} />} />

      {/* Guildlight Grow public routes — no auth required */}
      <Route path="/grow/sign" component={SignDocument} />

      {/* Guildlight Grow routes — login redirects to unified portal */}
      <Route path="/grow/login" component={() => <Redirect to="/leave/login" />} />
      <Route path="/grow/dashboard" component={() => <PiqProtectedRoute component={PiqDashboard} />} />
      <Route path="/grow/analytics" component={() => <PiqProtectedRoute component={PiqAnalytics} />} />
      <Route path="/grow/cases/new" component={() => <PiqProtectedRoute component={NewCase} />} />
      <Route path="/grow/cases/:caseId" component={() => <PiqProtectedRoute component={PiqCaseDetail} />} />
      <Route path="/grow/cases" component={() => <PiqProtectedRoute component={PiqCaseList} />} />
      <Route path="/grow/employees/:employeeId" component={() => <PiqProtectedRoute component={PiqEmployeeProfile} />} />
      <Route path="/grow/employees" component={() => <PiqProtectedRoute component={PiqEmployees} />} />
      <Route path="/grow/admin/settings" component={() => <PiqProtectedRoute component={PiqAdminSettings} />} />
      <Route path="/grow/admin/policies" component={() => <Redirect to="/grow/admin/settings" />} />
      <Route path="/grow/admin/document-types" component={() => <Redirect to="/grow/admin/settings" />} />
      <Route path="/grow/admin/users" component={() => <Redirect to="/grow/admin/settings" />} />

      {/* Backward-compat redirects — keep old paths alive */}
      <Route path="/request" component={() => <NavRedirect to="/leave/request" />} />
      <Route path="/portal" component={() => <NavRedirect to={`/leave/portal${window.location.search}`} />} />
      <Route path="/login" component={() => <NavRedirect to="/leave/login" />} />
      <Route path="/forgot-password" component={() => <NavRedirect to="/leave/forgot-password" />} />
      <Route path="/reset-password" component={() => <NavRedirect to={`/leave/reset-password${window.location.search}`} />} />
      <Route path="/register" component={() => <NavRedirect to={`/leave/register${window.location.search}`} />} />
      <Route path="/dashboard" component={() => <NavRedirect to="/leave/dashboard" />} />
      <Route path="/cases" component={() => <NavRedirect to="/leave/cases" />} />
      <Route path="/cases/:caseId">{(params: { caseId: string }) => <NavRedirect to={`/leave/cases/${params.caseId}`} />}</Route>
      <Route path="/users" component={() => <NavRedirect to="/leave/users" />} />
      <Route path="/account" component={() => <NavRedirect to="/leave/account" />} />
      <Route path="/calendar" component={() => <NavRedirect to="/leave/calendar" />} />
      <Route path="/hris-settings" component={() => <NavRedirect to="/leave/hris-settings" />} />
      <Route path="/superadmin" component={() => <NavRedirect to="/leave/superadmin" />} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <PiqAuthProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
          </PiqAuthProvider>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
