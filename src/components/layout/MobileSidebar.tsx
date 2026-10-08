import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { isRouteActive } from '../../lib/nav';
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

  const scrollRoot = typeof document !== 'undefined'
    ? document.getElementById('main-content')
    : null;

  useEffect(() => {
    // <body> locking did nothing: the scroll container is <main> inside an
    // h-[100dvh] overflow-hidden shell, so the content behind the drawer still
    // scroll-chained under the user's finger.
    const root = scrollRoot ?? document.querySelector<HTMLElement>('[data-scroll-root]');
    if (!root) return;
    root.style.overflowY = open ? 'hidden' : '';
    return () => { root.style.overflowY = ''; };
  }, [open, scrollRoot]);

  // Escape closes, and focus returns to wherever it came from.
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    triggerRef.current = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      triggerRef.current?.focus?.();
    };
  }, [open, onClose]);

  // `nav-active-indicator` renders the gradient bar unconditionally in CSS, so it
  // must only ever reach the class string of the section you are actually in.
  const isActive = (to: string) => isRouteActive(location.pathname, to);

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
      {/* Returning null while closed matters: previously the aside stayed mounted
          and translated off-screen, so all seven buttons plus the close button
          stayed in the tab order — keyboard focus walked through an invisible
          drawer before reaching the page. */}
      {open && (
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className="fixed top-0 left-0 bottom-0 z-50 w-72 max-w-[85vw] bg-surface-warm shadow-2xl lg:hidden translate-x-0 flex flex-col overflow-y-auto"
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
          <button onClick={() => handleNav('/dashboard')} className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium w-full transition-colors ${isActive('/dashboard') ? 'nav-active-indicator text-primary bg-primary-light' : 'text-steel hover:text-primary hover:bg-primary-light'}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
            </svg>
            Dashboard
          </button>
          <button onClick={() => handleNav('/profiles')} className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium w-full transition-colors ${isActive('/profiles') ? 'nav-active-indicator text-primary bg-primary-light' : 'text-steel hover:text-primary hover:bg-primary-light'}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            Directory
          </button>
          <button onClick={() => handleNav('/my-profile')} className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium w-full transition-colors ${isActive('/my-profile') ? 'nav-active-indicator text-primary bg-primary-light' : 'text-steel hover:text-primary hover:bg-primary-light'}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
            </svg>
            My Profile
          </button>
          <button onClick={() => handleNav('/attendance')} className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium w-full transition-colors ${isActive('/attendance') ? 'nav-active-indicator text-primary bg-primary-light' : 'text-steel hover:text-primary hover:bg-primary-light'}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /><polyline points="9 16 11 18 15 14" />
            </svg>
            Attendance
          </button>
          <button onClick={() => handleNav('/requests')} className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium w-full transition-colors ${isActive('/requests') ? 'nav-active-indicator text-primary bg-primary-light' : 'text-steel hover:text-primary hover:bg-primary-light'}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
            </svg>
            Requests
          </button>
          {/* These two had no entry anywhere in the drawer or the bottom bar, so
              they were unreachable below 1024px — `/my-issues` had to be reached
              by typing the URL, and `/create-profile` was only linkable from
              within the dashboard. */}
          <button onClick={() => handleNav('/my-issues')} className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium w-full transition-colors ${isActive('/my-issues') ? 'nav-active-indicator text-primary bg-primary-light' : 'text-steel hover:text-primary hover:bg-primary-light'}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /><polyline points="17 9 21 5 17 1" /><line x1="21" y1="5" x2="11" y2="5" />
            </svg>
            My Issues
          </button>
          {!profile && (
            <button onClick={() => handleNav('/create-profile')} className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium w-full transition-colors ${isActive('/create-profile') ? 'nav-active-indicator text-primary bg-primary-light' : 'text-steel hover:text-primary hover:bg-primary-light'}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" />
              </svg>
              Create Business Profile
            </button>
          )}
          <button onClick={() => handleNav('/payments')} className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium w-full transition-colors ${isActive('/payments') ? 'nav-active-indicator text-primary bg-primary-light' : 'text-steel hover:text-primary hover:bg-primary-light'}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="5" width="22" height="14" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /><circle cx="12" cy="15" r="1" />
            </svg>
            Payments
            <span className="ml-auto text-xs font-medium text-muted bg-muted-bg px-1.5 py-0.5 rounded-md">Soon</span>
          </button>
          {isAdminUser && (
            <button onClick={() => handleNav('/admin')} className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium w-full transition-colors ${isActive('/admin') ? 'nav-active-indicator text-primary bg-primary-light' : 'text-steel hover:text-primary hover:bg-primary-light'}`}>
              <div className="relative">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                {pendingCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-2.5 h-2.5 bg-warning rounded-full" />
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
      )}
    </>
  );
}
