import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { trackError } from './lib/errorTracker';
import { AdminGuard } from './components/AdminGuard';

/**
 * Route-level code splitting.
 *
 * Every page used to be statically imported, so the initial bundle carried all
 * 17 pages — including Admin.tsx at ~155 KB — and the login screen downloaded
 * the whole application before it could paint. Each route below is now fetched
 * on first visit; the fallback below keeps that transition invisible.
 */
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const CreateProfile = lazy(() => import('./pages/CreateProfile'));
const Profile = lazy(() => import('./pages/Profile'));
const Profiles = lazy(() => import('./pages/Profiles'));
const Requests = lazy(() => import('./pages/Requests'));
const CreateRequest = lazy(() => import('./pages/CreateRequest'));
const RequestDetail = lazy(() => import('./pages/RequestDetail'));
const Admin = lazy(() => import('./pages/Admin'));
const AdminAccess = lazy(() => import('./pages/AdminAccess'));
const Attendance = lazy(() => import('./pages/Attendance'));
const AttendanceScan = lazy(() => import('./pages/AttendanceScan'));
const Payments = lazy(() => import('./pages/Payments'));
const SeedAdmin = lazy(() => import('./pages/SeedAdmin'));
const MyIssues = lazy(() => import('./pages/MyIssues'));

/**
 * Route-transition fallback. Deliberately a slim neutral panel rather than a
 * full skeleton: the skeleton shapes of the incoming page are not known yet,
 * and guessing them causes a layout jump the moment real content arrives.
 */
function RouteFallback() {
  return (
    <div
      className="flex items-center justify-center min-h-[50vh]"
      role="status"
      aria-live="polite"
      aria-label="Loading page"
    >
      <div className="flex flex-col items-center gap-3">
        <span className="w-7 h-7 rounded-full border-2 border-border border-t-primary animate-spin" />
        <span className="text-xs text-muted">Loading…</span>
      </div>
    </div>
  );
}

function RootRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to="/dashboard" replace />;
}

function ProfileRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={`/profile/${user.uid}`} replace />;
}

function AppRoutes() {
  return (
    // NOTE: this boundary is deliberately NOT keyed on location.pathname.
    //
    // Keying it remounted the entire subtree on every navigation, which tore
    // down and rebuilt AppLayout — and with it resubscribed every live Firestore
    // listener (MarqueeBar's two, plus the pending-verification count) and
    // re-ran the react-query cache for six pages that fetch outside react-query.
    // Each click therefore cost a burst of listener re-subscriptions and a full
    // refetch. Crash isolation is still achieved: a page that throws unmounts
    // with its own route, and GlobalErrorHandler reports it.
    <ErrorBoundary>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/create-profile" element={<CreateProfile />} />
            <Route path="/profile/:id" element={<Profile />} />
            <Route path="/profiles" element={<Profiles />} />
            <Route path="/my-profile" element={<ProfileRedirect />} />
            <Route path="/requests" element={<Requests />} />
            <Route path="/requests/create" element={<CreateRequest />} />
            <Route path="/requests/:id" element={<RequestDetail />} />
            <Route path="/admin-access" element={<AdminAccess />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/attendance/scan" element={<AttendanceScan />} />
            <Route path="/my-issues" element={<MyIssues />} />
            <Route path="/payments" element={<Payments />} />
            <Route path="/admin" element={<AdminGuard><Admin /></AdminGuard>} />
            <Route path="/seed-admin" element={<SeedAdmin />} />
            <Route path="/" element={<RootRedirect />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

function GlobalErrorHandler({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      trackError('window.onerror', event.error || event.message);
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      trackError('unhandledRejection', event.reason);
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <GlobalErrorHandler>
          <AppRoutes />
        </GlobalErrorHandler>
      </AuthProvider>
    </BrowserRouter>
  );
}
