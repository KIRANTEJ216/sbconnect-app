import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface NavItemProps {
  to: string;
  label: string;
  children: React.ReactNode;
}

function NavItem({ to, label, children }: NavItemProps) {
  return (
    <NavLink
      to={to}
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

export function Sidebar() {
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';

  return (
    <aside className="w-64 bg-surface-warm border-r border-border h-full flex flex-col">
      <div className="h-24 px-6 border-b border-border flex items-center relative">
        <div className="flex items-center gap-3">
          <img
            src="/sbconnect-logo.png"
            alt="SB Connect"
            className="h-9 w-auto object-contain shrink-0"
          />
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-charcoal tracking-tight leading-tight">SB Connect</h2>
            <p className="text-xs text-muted font-mono tracking-tight leading-tight mt-0.5">Business Network</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        <NavItem to="/dashboard" label="Dashboard">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
          </svg>
        </NavItem>
        <NavItem to="/profiles" label="Directory">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </NavItem>
        <NavItem to="/my-profile" label="My Profile">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </NavItem>
        <NavItem to="/requests" label="Requests">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        </NavItem>
        {isAdmin && (
          <NavItem to="/admin" label="Admin">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </NavItem>
        )}
      </nav>

      <div className="px-4 py-3 border-t border-border bg-gradient-to-t from-premium-warm/50 to-transparent">
        <div className="flex items-center gap-3.5">
          <div className="w-8 h-8 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center text-white font-semibold text-xs shadow-sm">
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
  );
}
