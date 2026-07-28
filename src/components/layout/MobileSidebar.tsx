import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { usePendingVerifications } from '../../hooks/usePendingVerifications';
import { isAdmin } from '../../lib/admin';

interface MobileSidebarProps {
  open: boolean;
  onClose: () => void;
}

export function MobileSidebar({ open, onClose }: MobileSidebarProps) {
  const { user, profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isAdminUser = isAdmin(profile?.role);
  const pendingCount = usePendingVerifications();

  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const handleNav = (to: string) => {
    navigate(to);
    onClose();
  };

  return (
    <> 
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={onClose}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
        </div>
      )}
      <aside
        className={`fixed top-0 left-0 bottom-0 z-50 w-72 bg-surface-warm shadow-2xl lg:hidden ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-20 px-6 border-b border-border flex items-center justify-between relative">
          <img
            src="/sbconnect-logo.png"
            alt="SB Connect"
            className="h-8 w-auto object-contain"
          />
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-canvas transition-colors cursor-pointer" aria-label="Close menu">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#71717A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <nav className="px-3 py-4 space-y-1">
          <button onClick={() => handleNav('/dashboard')} className="flex items-center gap-3.5 px-4 py-2.5 rounded-xl text-sm font-medium nav-active-indicator text-steel hover:text-primary hover:bg-primary-light cursor-pointer w-full">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
            </svg>
            Dashboard
          </button>
          <button onClick={() => handleNav('/profiles')} className="flex items-center gap-3.5 px-4 py-2.5 rounded-xl text-sm font-medium nav-active-indicator text-steel hover:text-primary hover:bg-primary-light cursor-pointer w-full">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            Directory
          </button>
          <button onClick={() => handleNav('/my-profile')} className="flex items-center gap-3.5 px-4 py-2.5 rounded-xl text-sm font-medium nav-active-indicator text-steel hover:text-primary hover:bg-primary-light cursor-pointer w-full">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
            </svg>
            My Profile
          </button>
          <button onClick={() => handleNav('/attendance')} className="flex items-center gap-3.5 px-4 py-2.5 rounded-xl text-sm font-medium nav-active-indicator text-steel hover:text-primary hover:bg-primary-light cursor-pointer w-full">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /><polyline points="9 16 11 18 15 14" />
            </svg>
            Attendance
          </button>
          <button onClick={() => handleNav('/requests')} className="flex items-center gap-3.5 px-4 py-2.5 rounded-xl text-sm font-medium nav-active-indicator text-steel hover:text-primary hover:bg-primary-light cursor-pointer w-full">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
            </svg>
            Requests
          </button>
          <button onClick={() => handleNav('/payments')} className="flex items-center gap-3.5 px-4 py-2.5 rounded-xl text-sm font-medium nav-active-indicator text-steel hover:text-primary hover:bg-primary-light cursor-pointer w-full">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="5" width="22" height="14" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /><circle cx="12" cy="15" r="1" />
            </svg>
            Payments
            <span className="ml-auto text-[10px] font-medium text-muted bg-muted-bg px-1.5 py-0.5 rounded-md">Soon</span>
          </button>
          {isAdminUser && (
            <button onClick={() => handleNav('/admin')} className="flex items-center gap-3.5 px-4 py-2.5 rounded-xl text-sm font-medium nav-active-indicator text-steel hover:text-primary hover:bg-primary-light cursor-pointer w-full">
              <div className="relative">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                {pendingCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-2 h-2 bg-warning rounded-full" />
                )}
              </div>
              {pendingCount > 0 ? `Admin (${pendingCount})` : 'Admin'}
            </button>
          )}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 px-4 py-4 border-t border-border bg-gradient-to-t from-premium-warm/50 to-transparent">
          <div className="flex items-center gap-3.5">
            <div className="w-9 h-9 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center text-white font-semibold text-sm shadow-sm">
              {(user?.displayName || user?.email || '?').charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-charcoal tracking-tight truncate">
                {user?.displayName || user?.email}
              </p>
              <p className="text-xs text-muted font-mono truncate">{user?.email}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
