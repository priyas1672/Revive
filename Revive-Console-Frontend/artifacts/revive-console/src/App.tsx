
import { type ReactNode, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { AppShell } from '@/components/revive-ui';
import { AuthPage, ConfigPage, OverviewPage, PaymentsPage, RoiPage, SimulationPage, VoicePage, WhatsAppPage, WorkbenchPage } from '@/pages/revive-pages';
import { getAuthToken, clearAuthToken, apiRequest } from '@/services/api';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

// --- NEW: guard that redirects to /login if no token exists ---
function ProtectedRoute({ children }: { children: ReactNode }) {
  const [, navigate] = useLocation();
  const token = getAuthToken();

  useEffect(() => {
    if (!token) {
      navigate('/login');
    }
  }, [token, navigate]);

  if (!token) {
    return null;
  }

  return <>{children}</>;
}

// --- NEW: logout bar with merchant welcome message ---
function LogoutBar() {
  const [, navigate] = useLocation();
  const [merchantName, setMerchantName] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<{ success: boolean; merchant: { name: string; businessName: string } }>('/api/auth/me')
      .then((result) => setMerchantName(result.merchant?.name || result.merchant?.businessName || null))
      .catch(() => setMerchantName(null));
  }, []);

  const handleLogout = () => {
    clearAuthToken();
    navigate('/login');
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px' }}>
      
      <span style={{ fontWeight: 600, fontSize: 18 }}>{merchantName ? `Welcome, ${merchantName}` : ''}</span>
      <button className="button button-secondary" onClick={handleLogout} data-testid="button-logout">
        Log out
      </button>
    </div>
  );
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/login"><AuthPage mode="login" /></Route>
        <Route path="/signup"><AuthPage mode="signup" /></Route>

        <Route path="/">
          <ProtectedRoute>
            <AppShell><LogoutBar /><OverviewPage /></AppShell>
          </ProtectedRoute>
        </Route>
        <Route path="/recovery">
          <ProtectedRoute>
            <AppShell><LogoutBar /><WorkbenchPage kind="recovery" /></AppShell>
          </ProtectedRoute>
        </Route>
        <Route path="/promises">
          <ProtectedRoute>
            <AppShell><LogoutBar /><WorkbenchPage kind="promises" /></AppShell>
          </ProtectedRoute>
        </Route>
        <Route path="/communication">
          <ProtectedRoute>
            <AppShell><LogoutBar /><WorkbenchPage kind="communication" /></AppShell>
          </ProtectedRoute>
        </Route>
        <Route path="/payments">
          <ProtectedRoute>
            <AppShell><LogoutBar /><PaymentsPage /></AppShell>
          </ProtectedRoute>
        </Route>
        <Route path="/roi">
          <ProtectedRoute>
            <AppShell><LogoutBar /><RoiPage /></AppShell>
          </ProtectedRoute>
        </Route>
        <Route path="/recovery-config">
          <ProtectedRoute>
            <AppShell><LogoutBar /><ConfigPage /></AppShell>
          </ProtectedRoute>
        </Route>
        <Route path="/simulation">
          <ProtectedRoute>
            <AppShell><LogoutBar /><SimulationPage /></AppShell>
          </ProtectedRoute>
        </Route>
        <Route path="/voice">
          <ProtectedRoute>
            <AppShell><LogoutBar /><VoicePage /></AppShell>
          </ProtectedRoute>
        </Route>
        <Route path="/whatsapp">
          <ProtectedRoute>
            <AppShell><LogoutBar /><WhatsAppPage /></AppShell>
          </ProtectedRoute>
        </Route>

        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
