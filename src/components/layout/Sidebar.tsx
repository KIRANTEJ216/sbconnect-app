import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { usePendingVerifications } from '../../hooks/usePendingVerifications';
import { isAdmin } from '../../lib/admin';

interface NavItemProps {
  to: string;
  label: string;
  expanded: boolean;
  children: React.ReactNode;
}

function NavItem({ to, label, expanded, children }: NavItemProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <button
      onClick={() => navigate(to)}
      className={`flex items-center rounded-xl text-sm font-medium nav-active-indicator cursor-pointer ${
        isActive
          ? 'bg-primary-light text-primary'
          : 'text-steel hover:text-primary hover:bg-primary-light'
      } ${expanded ? 'gap-3.5 px-4 py-2.5' : 'justify-center px-3 py-2.5'}`}
    >
      {children}
      {expanded && label}
    </button>
  );
}

export function Sidebar() {
  const { user, profile } = useAuth();
  const isAdminUser = isAdmin(user?.email, profile?.role);
  const pendingCount = usePendingVerifications();
  const [expanded, setExpanded] = useState(false);

  return (
    <aside
      className={`bg-surface-warm border-r border-border h-full flex flex-col ${expanded ? 'w-64' : 'w-20'}`}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      <div className={`h-24 border-b border-border flex items-center relative ${expanded ? 'px-6' : 'justify-center px-0'}`}>
        <div className={`flex items-center ${expanded ? 'gap-3' : 'justify-center'}`}>
          <img
            src="/sbconnect-logo.png"
            alt="SB Connect"
            className={`w-auto object-contain shrink-0 ${expanded ? 'h-9' : 'h-8'}`}
          />
          {expanded && (
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-charcoal tracking-tight leading-tight whitespace-nowrap">SB Connect</h2>
              <p className="text-xs text-muted font-mono tracking-tight leading-tight mt-0.5 whitespace-nowrap">Business Network</p>
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        <NavItem to="/dashboard" label="Dashboard" expanded={expanded}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
          </svg>
        </NavItem>
        <NavItem to="/profiles" label="Directory" expanded={expanded}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </NavItem>
        <NavItem to="/my-profile" label="My Profile" expanded={expanded}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </NavItem>
        <NavItem to="/attendance" label="Attendance" expanded={expanded}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
            <polyline points="9 16 11 18 15 14" />
          </svg>
        </NavItem>
        <NavItem to="/requests" label="Requests" expanded={expanded}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        </NavItem>
        <NavItem to="/payments" label="Payments" expanded={expanded}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <rect x="1" y="5" width="22" height="14" rx="2" ry="2" />
            <line x1="1" y1="10" x2="23" y2="10" />
            <circle cx="12" cy="15" r="1" />
          </svg>
          {expanded && <span className="ml-auto text-[10px] font-medium text-muted bg-muted-bg px-1.5 py-0.5 rounded-md">Soon</span>}
        </NavItem>
        {isAdminUser && (
          <NavItem to="/admin" label={pendingCount > 0 ? `Admin (${pendingCount})` : 'Admin'} expanded={expanded}>
            <div className="relative shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              {pendingCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-2 h-2 bg-warning rounded-full" />
              )}
            </div>
          </NavItem>
        )}
      </nav>

      <div className={`border-t border-border bg-gradient-to-t from-premium-warm/50 to-transparent ${expanded ? 'px-4 py-3' : 'px-0 py-3'}`}>
        <div className={`flex items-center ${expanded ? 'gap-3.5' : 'justify-center'}`}>
          <div className="w-8 h-8 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center text-white font-semibold text-xs shadow-sm shrink-0">
            {(user?.displayName || user?.email || '?').charAt(0).toUpperCase()}
          </div>
          {expanded && (
            <div className="min-w-0">
              <p className="text-sm font-medium text-charcoal tracking-tight truncate whitespace-nowrap">
                {user?.displayName || user?.email}
              </p>
              <p className="text-xs text-muted font-mono truncate whitespace-nowrap">{user?.email}</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
