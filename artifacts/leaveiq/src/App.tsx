import React from "react";
import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { isOrgSubdomain } from "@/lib/subdomain";

import Landing from "@/pages/Landing";
import OrgLanding from "@/pages/OrgLanding";
import Interest from "@/pages/Interest";
import Dashboard from "@/pages/Dashboard";
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
import PerformIQDashboard from "@/pages/PerformIQDashboard";
import NotFound from "@/pages/not-found";

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
  if (!user) return <Redirect to={`/leaveiq/login?redirect=${encodeURIComponent(location)}`} />;
  return <Component />;
}

function SuperAdminRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) return null;
  if (!user) return <Redirect to={`/leaveiq/login?redirect=${encodeURIComponent(location)}`} />;
  if (!user.isSuperAdmin) return <Redirect to="/leaveiq/dashboard" />;
  return <Component />;
}

function GuestRoute({ component: Component }: { component: React.ComponentType }) {
  const { user } = useAuth();
  if (user?.isSuperAdmin) return <Redirect to="/leaveiq/superadmin" />;
  if (user) return <Redirect to="/leaveiq/dashboard" />;
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

      {/* LeaveIQ employee routes */}
      <Route path="/leaveiq/request" component={EmployeePortal} />
      <Route path="/leaveiq/portal" component={EmployeePortalCase} />

      {/* LeaveIQ HR routes */}
      <Route path="/leaveiq/login" component={() => <GuestRoute component={Login} />} />
      <Route path="/leaveiq/forgot-password" component={() => <GuestRoute component={ForgotPassword} />} />
      <Route path="/leaveiq/reset-password" component={ResetPassword} />
      <Route path="/leaveiq/register" component={Register} />
      <Route path="/leaveiq/dashboard" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/leaveiq/cases" component={() => <ProtectedRoute component={Cases} />} />
      <Route path="/leaveiq/cases/:caseId" component={() => <ProtectedRoute component={CaseDetail} />} />
      <Route path="/leaveiq/users" component={() => <ProtectedRoute component={Users} />} />
      <Route path="/leaveiq/account" component={() => <ProtectedRoute component={AccountSettings} />} />
      <Route path="/leaveiq/calendar" component={() => <ProtectedRoute component={Calendar} />} />
      <Route path="/leaveiq/hris-settings" component={() => <ProtectedRoute component={HrisSettings} />} />
      <Route path="/leaveiq/superadmin" component={() => <SuperAdminRoute component={SuperAdmin} />} />

      {/* PerformIQ routes */}
      <Route path="/performiq/login" component={() => <GuestRoute component={Login} />} />
      <Route path="/performiq/dashboard" component={() => <ProtectedRoute component={PerformIQDashboard} />} />

      {/* Backward-compat redirects — keep old paths alive */}
      <Route path="/request" component={() => <NavRedirect to="/leaveiq/request" />} />
      <Route path="/portal" component={() => <NavRedirect to={`/leaveiq/portal${window.location.search}`} />} />
      <Route path="/login" component={() => <NavRedirect to="/leaveiq/login" />} />
      <Route path="/forgot-password" component={() => <NavRedirect to="/leaveiq/forgot-password" />} />
      <Route path="/reset-password" component={() => <NavRedirect to={`/leaveiq/reset-password${window.location.search}`} />} />
      <Route path="/register" component={() => <NavRedirect to={`/leaveiq/register${window.location.search}`} />} />
      <Route path="/dashboard" component={() => <NavRedirect to="/leaveiq/dashboard" />} />
      <Route path="/cases" component={() => <NavRedirect to="/leaveiq/cases" />} />
      <Route path="/cases/:caseId">{(params: { caseId: string }) => <NavRedirect to={`/leaveiq/cases/${params.caseId}`} />}</Route>
      <Route path="/users" component={() => <NavRedirect to="/leaveiq/users" />} />
      <Route path="/account" component={() => <NavRedirect to="/leaveiq/account" />} />
      <Route path="/calendar" component={() => <NavRedirect to="/leaveiq/calendar" />} />
      <Route path="/hris-settings" component={() => <NavRedirect to="/leaveiq/hris-settings" />} />
      <Route path="/superadmin" component={() => <NavRedirect to="/leaveiq/superadmin" />} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
