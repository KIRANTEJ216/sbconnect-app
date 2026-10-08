import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { usePendingVerifications } from '../../hooks/usePendingVerifications';
import { isRouteActive } from '../../lib/nav';
import { isAdmin } from '../../lib/admin';

function NavBtn({ to, label, children }: { to: string; label: string; children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = isRouteActive(location.pathname, to);
  return (
    <button
      onClick={() => navigate(to)}
      aria-current={isActive ? 'page' : undefined}
      className={`flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-xl text-xs font-medium cursor-pointer min-h-[56px] flex-1 min-w-0 transition-colors ${
        isActive ? 'text-primary bottom-nav-active' : 'text-muted hover:text-steel'
      }`}
    >
      <span className="shrink-0" aria-hidden="true">{children}</span>
      <span className="truncate max-w-full">{label}</span>
    </button>
  );
}

export function BottomNav() {
  const { profile } = useAuth();
  const isAdminUser = isAdmin(profile?.role);
  const pendingCount = usePendingVerifications();

  return (
    // backdrop-blur-xl was a full-viewport-width blur on a bar that is always
    // mounted below `lg` (including on desktop, where it is invisible), so it
    // repainted on every scroll for nothing. An opaque bar reads the same here.
    <nav
      aria-label="Primary"
      className="fixed bottom-0 left-0 right-0 z-50 bg-surface/95 border-t border-border lg:hidden safe-area-bottom shadow-nav"
    >
      <div className="flex items-stretch justify-around px-1.5 py-1">
        <NavBtn to="/dashboard" label="Home">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
          </svg>
        </NavBtn>
        <NavBtn to="/profiles" label="Directory">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </NavBtn>
        <NavBtn to="/requests" label="Requests">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        </NavBtn>
        <NavBtn to="/my-issues" label="Issues">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            <polyline points="17 9 21 5 17 1" /><line x1="21" y1="5" x2="11" y2="5" />
          </svg>
        </NavBtn>
        <NavBtn to="/attendance" label="Attendance">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /><polyline points="9 16 11 18 15 14" />
          </svg>
        </NavBtn>
        <NavBtn to="/my-profile" label="Profile">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </NavBtn>
        {isAdminUser && (
          <NavBtn to="/admin" label={pendingCount > 0 ? `Admin (${pendingCount})` : 'Admin'}>
            <div className="relative">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              {pendingCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-2.5 h-2.5 bg-warning rounded-full" />
              )}
            </div>
          </NavBtn>
        )}
      </div>
    </nav>
  );
}
