import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { trackError } from './lib/errorTracker';
import Login from './pages/Login';
import Register from './pages/Register';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import CreateProfile from './pages/CreateProfile';
import Profile from './pages/Profile';
import Profiles from './pages/Profiles';
import Requests from './pages/Requests';
import CreateRequest from './pages/CreateRequest';
import RequestDetail from './pages/RequestDetail';
import Admin from './pages/Admin';
import AdminAccess from './pages/AdminAccess';
import Attendance from './pages/Attendance';
import AttendanceScan from './pages/AttendanceScan';
import Payments from './pages/Payments';
import SeedAdmin from './pages/SeedAdmin';
import MyIssues from './pages/MyIssues';
import { AdminGuard } from './components/AdminGuard';

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
  const location = useLocation();
  return (
    <ErrorBoundary key={location.pathname}>
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
