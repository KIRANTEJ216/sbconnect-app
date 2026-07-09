import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { usePendingVerifications } from '../../hooks/usePendingVerifications';
import { isAdmin } from '../../lib/admin';

function NavBtn({ to, label, children }: { to: string; label: string; children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <button
      onClick={() => navigate(to)}
      className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-[10px] font-medium transition-all duration-200 cursor-pointer ${
        isActive ? 'text-primary bottom-nav-active' : 'text-muted hover:text-steel'
      }`}
    >
      {children}
      <span>{label}</span>
    </button>
  );
}

export function BottomNav() {
  const { user, profile } = useAuth();
  const isAdminUser = isAdmin(user?.email, profile?.role);
  const pendingCount = usePendingVerifications();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-surface/85 backdrop-blur-xl border-t border-border lg:hidden safe-area-bottom shadow-nav">
      <div className="flex items-center justify-around px-2 py-1.5">
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
                <span className="absolute -top-1.5 -right-1.5 w-2 h-2 bg-warning rounded-full" />
              )}
            </div>
          </NavBtn>
        )}
      </div>
    </nav>
  );
}
