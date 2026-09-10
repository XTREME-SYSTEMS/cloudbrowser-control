import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import AppError from '@/components/AppError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import Dashboard from '@/pages/Dashboard';
import Sessions from '@/pages/Sessions';
import SessionDetail from '@/pages/SessionDetail';
import Jobs from '@/pages/Jobs';
import JobDetail from '@/pages/JobDetail';
import Settings from '@/pages/Settings';
import ApiDocs from '@/pages/ApiDocs';
import Billing from '@/pages/Billing';
import ShareView from '@/pages/ShareView';
import AiChat from '@/pages/AiChat';
import CloneStudio from '@/pages/CloneStudio';
import BatchClone from '@/pages/BatchClone';
import GapPlayground from '@/pages/GapPlayground';
import GapMap from '@/pages/GapMap';
import SandboxedClone from '@/pages/SandboxedClone';
import SkipTracing from '@/pages/SkipTracing';
import ThemeProvider from '@/components/ThemeProvider';
import Landing from '@/pages/Landing';
import Pricing from '@/pages/Pricing';
import SaaSOnboarding from '@/pages/SaaSOnboarding';
import McpCreator from '@/pages/McpCreator';
import SandboxManager from '@/pages/SandboxManager';
import AgentBuilder from '@/pages/AgentBuilder';
import ThankYou from '@/pages/ThankYou';
import AdminPortal from '@/pages/AdminPortal';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    } else {
      // Unknown errors (e.g., missing app ID, failed to load app settings)
      // Show an error screen instead of falling through to render routes,
      // which would cause API calls with a null/invalid app ID.
      return <AppError message={authError.message} />;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/share/:token" element={<ShareView />} />
      <Route path="/landing" element={<Landing />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/ThankYou" element={<ThankYou />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<Layout />}>
          <Route path="/" element={<AdminPortal />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/welcome" element={<SaaSOnboarding />} />
          <Route path="/sessions" element={<Sessions />} />
          <Route path="/sessions/:id" element={<SessionDetail />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/jobs/:id" element={<JobDetail />} />
          <Route path="/agent-builder" element={<AgentBuilder />} />
          <Route path="/sandboxes" element={<SandboxManager />} />
          <Route path="/clone-studio" element={<CloneStudio />} />
          <Route path="/batch-clone" element={<BatchClone />} />
          <Route path="/gap-playground" element={<GapPlayground />} />
          <Route path="/gap-map" element={<GapMap />} />
          <Route path="/sandboxed-clone" element={<SandboxedClone />} />
          <Route path="/skip-tracing" element={<SkipTracing />} />
          <Route path="/mcp-creator" element={<McpCreator />} />
          <Route path="/billing" element={<Billing />} />
          <Route path="/api-docs" element={<ApiDocs />} />
          <Route path="/ai-chat" element={<AiChat />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <ThemeProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
      </ThemeProvider>
    </AuthProvider>
  )
}

export default App