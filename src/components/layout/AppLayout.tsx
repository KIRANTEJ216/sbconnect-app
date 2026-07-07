import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { AnimatePresence, motion } from 'framer-motion';

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-canvas flex">
      <div className="w-64 bg-surface border-r border-border hidden lg:flex flex-col p-6 space-y-6">
        <div className="skeleton h-10 w-40" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton h-10 w-full" />
          ))}
        </div>
      </div>
      <div className="flex-1 p-8 space-y-6">
        <div className="skeleton h-8 w-60" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-28 w-full rounded-[2.5rem]" />
          ))}
        </div>
        <div className="skeleton h-64 w-full rounded-[2.5rem]" />
      </div>
    </div>
  );
}

export function AppLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingSkeleton />;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-[100dvh] flex">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopBar />
        <main className="flex-1 p-8 overflow-auto bg-canvas">
          <AnimatePresence mode="wait">
            <motion.div key={location.pathname}>
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
