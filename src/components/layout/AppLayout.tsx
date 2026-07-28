import { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { BottomNav } from './BottomNav';
import { MobileSidebar } from './MobileSidebar';
import { MarqueeBar } from '../MarqueeBar';
import ReportIssue from '../ReportIssue';

function LoadingSkeleton() {
  return (
    <div className="h-[100dvh] bg-canvas flex overflow-hidden">
      <div className="w-64 bg-surface border-r border-border hidden lg:flex flex-col p-6 space-y-6">
        <div className="skeleton h-10 w-40" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton h-10 w-full" />
          ))}
        </div>
      </div>
      <div className="flex-1 flex flex-col min-h-0">
        <div className="skeleton h-24 shrink-0" />
        <div className="flex-1 p-8 space-y-6 overflow-y-auto min-h-0">
          <div className="skeleton h-8 w-60" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-28 w-full rounded-[2.5rem]" />
            ))}
          </div>
          <div className="skeleton h-64 w-full rounded-[2.5rem]" />
        </div>
      </div>
    </div>
  );
}

export function AppLayout() {
  const { user, loading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (loading) return <LoadingSkeleton />;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="h-[100dvh] flex overflow-hidden">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:rounded-[0.75rem] focus:text-sm focus:font-medium focus:shadow-lg focus:outline-none">
        Skip to content
      </a>
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <MobileSidebar open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
        <TopBar onMenuToggle={() => setMobileMenuOpen((v) => !v)} />
        <MarqueeBar />
        <main id="main-content" className="flex-1 p-3 sm:p-5 lg:p-8 pb-20 lg:pb-4 overflow-y-auto bg-canvas min-h-0">
          <div className="min-h-0">
            <Outlet />
          </div>
        </main>
        <footer className="hidden sm:block px-8 py-3 border-t border-border text-center text-[11px] text-muted space-y-0.5 bg-surface shrink-0">
          <p>SB Connect &mdash; Only Business No Politics</p>
          <p>
            Developed by{' '}
            <a href="https://flologixautomations.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary-hover transition-colors">
              FloLogixAutomations
            </a>
          </p>
        </footer>
        <BottomNav />
        <ReportIssue />
      </div>
    </div>
  );
}
