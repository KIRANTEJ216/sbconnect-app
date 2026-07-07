import { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface MobileSidebarProps {
  open: boolean;
  onClose: () => void;
}

export function MobileSidebar({ open, onClose }: MobileSidebarProps) {
  const { user, profile } = useAuth();
  const location = useLocation();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';

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

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={onClose}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
        </div>
      )}
      <aside
        className={`fixed top-0 left-0 bottom-0 z-50 w-72 bg-surface-warm shadow-2xl transform transition-transform duration-300 ease-out lg:hidden ${
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
          <MobileNavItem to="/dashboard" label="Dashboard" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
            </svg>
          </MobileNavItem>
          <MobileNavItem to="/profiles" label="Directory" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </MobileNavItem>
          <MobileNavItem to="/my-profile" label="My Profile" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
            </svg>
          </MobileNavItem>
          <MobileNavItem to="/requests" label="Requests" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
            </svg>
          </MobileNavItem>
          {isAdmin && (
            <MobileNavItem to="/admin" label="Admin" onClick={onClose}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </MobileNavItem>
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

function MobileNavItem({ to, label, onClick, children }: { to: string; label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 nav-active-indicator ${
          isActive
            ? 'bg-primary-light text-primary'
            : 'text-steel hover:text-primary hover:bg-primary-light'
        }`
      }
    >
      {children}
      {label}
    </NavLink>
  );
}
