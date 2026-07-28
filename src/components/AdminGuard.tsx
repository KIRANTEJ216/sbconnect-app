import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { isAdmin } from '../lib/admin';

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuth();

  if (loading) return null;

  if (!profile || !isAdmin(profile.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
