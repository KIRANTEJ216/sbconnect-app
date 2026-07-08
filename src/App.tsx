import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AdminGuard } from './components/AdminGuard';

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

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ErrorBoundary>
          <Suspense fallback={null}>
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
              <Route path="/payments" element={<Payments />} />
              <Route path="/admin" element={<AdminGuard><Admin /></AdminGuard>} />
              <Route path="/seed-admin" element={<SeedAdmin />} />
              <Route path="/" element={<RootRedirect />} />
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
          </Suspense>
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  );
}
