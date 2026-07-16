import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { signOut } from '../../lib/auth';
import { useTotalBusinessValue, useRevenueConfig } from '../../hooks/useFirebaseQuery';
import { getFinancialYear } from '../../lib/format';
import { useNavigate } from 'react-router-dom';

const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function toWords(n: number): string {
  if (n === 0) return 'Zero';
  const under100 = (x: number) => x < 20 ? ones[x] : tens[Math.floor(x / 10)] + (x % 10 ? ' ' + ones[x % 10] : '');
  if (n < 100) return under100(n);
  if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + under100(n % 100) : '');
  if (n < 100000) return under100(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + toWords(n % 1000) : '');
  if (n < 10000000) return under100(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + toWords(n % 100000) : '');
  return toWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + toWords(n % 10000000) : '');
}

interface TopBarProps {
  onMenuToggle?: () => void;
}

export function TopBar({ onMenuToggle }: TopBarProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: total = 0 } = useTotalBusinessValue();
  const { data: revenueConfig } = useRevenueConfig();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const fy = getFinancialYear();
  const target = revenueConfig?.target || 0;
  const remaining = Math.max(0, target - total);
  const achieved = target > 0 && total >= target;
  const hasTarget = target > 0;
  const urgency = fy.timeProgress;
  const badgeColor = urgency > 0.75
    ? 'bg-gradient-to-r from-danger/15 to-warning/15 border-danger/25 text-danger'
    : urgency > 0.5
      ? 'bg-gradient-to-r from-warning/10 to-accent/10 border-warning/20 text-warning'
      : 'bg-gradient-to-r from-primary/10 to-success/10 border-primary/15 text-charcoal';
  const badgeEmoji = achieved ? '🎉' : urgency > 0.75 ? '🚨' : urgency > 0.5 ? '⚠️' : '🔥';

  return (
    <header className="h-24 shrink-0 bg-surface-warm/80 backdrop-blur-md border-b border-border flex items-center justify-between px-4 sm:px-6 sticky top-0 z-40">
      <div className="flex items-center gap-2.5 min-w-0">
        <button onClick={onMenuToggle} className="md:hidden p-1.5 -ml-1.5 rounded-xl hover:bg-primary-light/50 transition-colors cursor-pointer shrink-0" aria-label="Toggle menu">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A1A1AA" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <div className="hidden sm:block leading-tight">
          <p className="text-sm text-muted font-mono tracking-tight leading-tight">
            {now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
          <p className="text-sm font-semibold tracking-tight leading-tight mt-[1px] text-primary">
            {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
          </p>
        </div>
      </div>

      <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center leading-tight px-2">
        <span className="text-lg sm:text-2xl lg:text-4xl font-bold tracking-tight gradient-text truncate max-w-full">{hasTarget ? remaining.toLocaleString('en-IN') : '0'}</span>
        <span className="text-[10px] sm:text-xs text-muted font-mono tracking-tight mt-0.5 sm:mt-1">{hasTarget ? `${fy.fyLabel} · ₹ ${total.toLocaleString('en-IN')} of ₹ ${target.toLocaleString('en-IN')} target` : `${fy.fyLabel} · No target set`}</span>
        <div className="hidden sm:flex items-center gap-1.5 mt-0.5">
          <span className={`px-1.5 py-0.5 rounded-full ${badgeColor} border text-[10px] font-semibold transition-all duration-500`}>
            {achieved ? '🎉 Target Hit' : `${badgeEmoji} ${fy.remainingMonths}m ${fy.remainingDaysInMonth}d`}
          </span>
          {total > 0 && (
            <span className="text-[10px] text-steel font-mono tracking-tight">{toWords(total)}</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {user && (
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-muted hover:text-danger hover:bg-danger-light transition-all duration-200 cursor-pointer"
            title="Sign out"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        )}
      </div>
    </header>
  );
}
