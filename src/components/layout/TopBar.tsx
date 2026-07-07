import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { signOut } from '../../lib/auth';
import { getTotalBusinessValue } from '../../lib/firestore';
import { FlipCounter } from '../FlipCounter';
import { useNavigate } from 'react-router-dom';

export function TopBar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [total, setTotal] = useState(0);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    getTotalBusinessValue().then(setTotal).catch(() => {});
    const t = setInterval(() => setNow(new Date()), 1000);
    const unsub = setInterval(() => {
      getTotalBusinessValue().then(setTotal).catch(() => {});
    }, 30000);
    return () => { clearInterval(t); clearInterval(unsub); };
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <header className="h-16 bg-surface border-b border-border flex items-center justify-between px-8 sticky top-0 z-40">
      <div className="flex items-center gap-5">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A1A1AA" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="md:hidden">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
        <div className="hidden sm:block">
          <p className="text-xs text-muted font-mono tracking-tight leading-tight">
            {now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
          <p className="text-xs font-semibold tracking-tight leading-tight mt-[1px]" style={{ color: '#7C3AED' }}>
            {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <FlipCounter value={total} label="Network Total" />
        <div className="flex items-center gap-5">
          {user && (
            <>
              <span className="text-sm text-steel hidden sm:inline tracking-tight">
                {user.displayName || user.email}
              </span>
              <div className="w-9 h-9 bg-canvas rounded-xl flex items-center justify-center text-charcoal font-semibold text-sm border border-border">
                {(user.displayName || user.email || '?').charAt(0).toUpperCase()}
              </div>
              <button
                onClick={handleSignOut}
                className="text-sm text-muted hover:text-charcoal transition-colors font-medium"
              >
                Sign out
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
