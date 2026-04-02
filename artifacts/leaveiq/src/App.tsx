import React from "react";
import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";

import Landing from "@/pages/Landing";
import Interest from "@/pages/Interest";
import Dashboard from "@/pages/Dashboard";
import Cases from "@/pages/Cases";
import CaseDetail from "@/pages/CaseDetail";
import EmployeePortal from "@/pages/EmployeePortal";
import Login from "@/pages/Login";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import Register from "@/pages/Register";
import Users from "@/pages/Users";
import AccountSettings from "@/pages/AccountSettings";
import SuperAdmin from "@/pages/SuperAdmin";
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
  if (!user) return <Redirect to={`/login?redirect=${encodeURIComponent(location)}`} />;
  return <Component />;
}

function SuperAdminRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) return null;
  if (!user) return <Redirect to={`/login?redirect=${encodeURIComponent(location)}`} />;
  if (!user.isSuperAdmin) return <Redirect to="/dashboard" />;
  return <Component />;
}

function GuestRoute({ component: Component }: { component: React.ComponentType }) {
  const { user } = useAuth();
  if (user?.isSuperAdmin) return <Redirect to="/superadmin" />;
  if (user) return <Redirect to="/dashboard" />;
  return <Component />;
}

function Router() {
  return (
    <Switch>
      {/* Public landing page */}
      <Route path="/" component={Landing} />

      {/* Public interest / get-started form */}
      <Route path="/interest" component={Interest} />

      {/* Public auth routes */}
      <Route path="/login" component={() => <GuestRoute component={Login} />} />
      <Route path="/forgot-password" component={() => <GuestRoute component={ForgotPassword} />} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/register" component={Register} />

      {/* Employee portal — public (no HR account required) */}
      <Route path="/request" component={EmployeePortal} />

      {/* Protected HR routes */}
      <Route path="/dashboard" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/cases" component={() => <ProtectedRoute component={Cases} />} />
      <Route path="/cases/:caseId" component={() => <ProtectedRoute component={CaseDetail} />} />
      <Route path="/users" component={() => <ProtectedRoute component={Users} />} />
      <Route path="/account" component={() => <ProtectedRoute component={AccountSettings} />} />

      {/* Super admin route */}
      <Route path="/superadmin" component={() => <SuperAdminRoute component={SuperAdmin} />} />

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
