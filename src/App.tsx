import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import { ErrorBoundary } from './components/ErrorBoundary';
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
import Chat from './pages/Chat';
import ChatDetail from './pages/ChatDetail';
import Admin from './pages/Admin';
import SeedAdmin from './pages/SeedAdmin';
import { AdminGuard } from './components/AdminGuard';

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
              <Route path="/chat" element={<Chat />} />
              <Route path="/chat/:id" element={<ChatDetail />} />
              <Route path="/admin" element={<AdminGuard><Admin /></AdminGuard>} />
              <Route path="/seed-admin" element={<SeedAdmin />} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  );
}
