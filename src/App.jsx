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
import JobBuilder from '@/pages/JobBuilder';
import JobDetail from '@/pages/JobDetail';
import Schedules from '@/pages/Schedules';
import Costs from '@/pages/Costs';
import AuditLogs from '@/pages/AuditLogs';
import Settings from '@/pages/Settings';
import ApiDocs from '@/pages/ApiDocs';
import ConnectionInfo from '@/pages/ConnectionInfo';
import Projects from '@/pages/Projects';
import TestResults from '@/pages/TestResults';
import AiJobBuilder from '@/pages/AiJobBuilder';
import Templates from '@/pages/Templates';
import Analytics from '@/pages/Analytics';
import Billing from '@/pages/Billing';
import TeamPage from '@/pages/TeamPage';
import ErrorsPage from '@/pages/ErrorsPage';
import ShareView from '@/pages/ShareView';
import ConnectionWizard from '@/pages/ConnectionWizard';
import AiChat from '@/pages/AiChat';

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
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/connection-wizard" element={<ConnectionWizard />} />
          <Route path="/ai-chat" element={<AiChat />} />
          <Route path="/connection-info" element={<ConnectionInfo />} />
          <Route path="/sessions" element={<Sessions />} />
          <Route path="/sessions/:id" element={<SessionDetail />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/jobs/new" element={<JobBuilder />} />
          <Route path="/jobs/ai-builder" element={<AiJobBuilder />} />
          <Route path="/jobs/:id" element={<JobDetail />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/schedules" element={<Schedules />} />
          <Route path="/costs" element={<Costs />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/errors" element={<ErrorsPage />} />
          <Route path="/billing" element={<Billing />} />
          <Route path="/team" element={<TeamPage />} />
          <Route path="/audit-logs" element={<AuditLogs />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/api-docs" element={<ApiDocs />} />
          <Route path="/test-results" element={<TestResults />} />
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App