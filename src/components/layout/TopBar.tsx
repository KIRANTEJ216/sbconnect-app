import { memo, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { signOut } from '../../lib/auth';
import { useTotalBusinessValue, useRevenueConfig, useTotalReferralRevenue, usePendingRevenueTotalsQuery } from '../../hooks/useFirebaseQuery';
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
  /** Drawer state, so the trigger can expose aria-expanded. */
  menuOpen?: boolean;
}

/**
 * The date/time readout, isolated into its own component.
 *
 * This used to be `useState` + `setInterval` inside TopBar, which re-rendered
 * the entire header once per second — including the full-viewport-width
 * `backdrop-blur-md` repaint and the gradient-clipped headline figure. Only this
 * two-line subtree needs to update at 1 Hz, so only it re-renders.
 */
const HeaderClock = memo(function HeaderClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="hidden sm:block leading-tight">
      <p className="text-xs text-muted font-mono tracking-tight leading-tight">
        {now.toLocaleDateString('en-IN', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })}
      </p>
      <p className="text-sm font-semibold tracking-tight leading-tight mt-[1px] text-primary tabular">
        {now.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })}
      </p>
    </div>
  );
});

export function TopBar({ onMenuToggle, menuOpen = false }: TopBarProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: dealRevenue = 0 } = useTotalBusinessValue();
  const { data: referralRevenue = { totalValue: 0, pendingValue: 0 } } = useTotalReferralRevenue();
  const { data: pendingRevenue = { total: 0, totalCount: 0, pendingDeals: 0, pendingDealsCount: 0, pendingReferrals: 0, pendingReferralsCount: 0 } } = usePendingRevenueTotalsQuery();
  const { data: revenueConfig } = useRevenueConfig();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const fy = getFinancialYear();
  // Matches the Dashboard headline: verified deal revenue + verified referral
  // revenue + member submissions still awaiting verification. Must stay in step
  // with Dashboard.tsx or the bar shows two different numbers.
  const total = dealRevenue + referralRevenue.totalValue + pendingRevenue.total;
  // toWords() recurses through lakh/crore groups; it only needs to recompute
  // when the figure itself changes, not on every render.
  const totalWords = useMemo(() => toWords(total), [total]);
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
    // `relative` matters: the centre block below is `absolute left-1/2`, and
    // `sticky` does not create a containing block, so without this it anchored
    // to the initial containing block and drifted as the sidebar expanded.
    // The scroll container is <main>, not the document, so `sticky` was a no-op.
    <header className="relative min-h-24 shrink-0 bg-surface-warm/80 backdrop-blur-md border-b border-border flex items-center justify-between px-4 sm:px-6 py-3 z-40">
      <div className="flex items-center gap-2.5 min-w-0">
        {/* md:hidden put the cutoff at 768px while the drawer and the desktop sidebar
              both switch at lg (1024px). Between those widths the app had no
              navigation at all — no hamburger, no drawer, no sidebar, and a
              bottom bar listing only six of the routes. The trigger now covers
              the entire sub-desktop range, and min-h-11/min-w-11 gives it a
              44px touch target. */}
            <button onClick={onMenuToggle} aria-expanded={menuOpen} className="lg:hidden p-2 -ml-2 min-h-11 min-w-11 flex items-center justify-center rounded-xl hover:bg-primary-light/50 transition-colors cursor-pointer shrink-0" aria-label="Toggle menu">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <div className="flex items-center gap-2.5">
          <img
            src="/sbconnect-logo.png"
            alt="SB Connect"
            className="h-10 w-auto object-contain shrink-0"
          />
          <HeaderClock />
        </div>
      </div>

      {/* Mobile: the absolute centre block is hidden below sm, so the target
          readout has to live here or members lose it entirely on a phone. */}
      <div className="sm:hidden flex flex-col items-end leading-none ml-3 min-w-0">
        <span className="text-micro font-semibold text-muted uppercase tracking-[0.06em]">
          {achieved ? 'Reached' : 'To raise'}
        </span>
        <span className="text-h3 font-bold tracking-tight gradient-text tabular mt-0.5">
          {hasTarget ? `₹${remaining.toLocaleString('en-IN')}` : '—'}
        </span>
        {pendingRevenue.total > 0 && (
          <span className="text-micro text-warning font-mono tracking-tight mt-0.5 tabular">
            + ₹{pendingRevenue.total.toLocaleString('en-IN')} unverified
          </span>
        )}
      </div>

      {/* Centre: the gap to target. Absolute centring collides with the logo on
          narrow viewports, so it is hidden below sm and folded into the logo row. */}
      <div className="hidden sm:flex absolute left-1/2 -translate-x-1/2 flex-col items-center leading-none px-3">
        <span className="text-micro font-semibold text-muted uppercase tracking-[0.08em] mb-1">
          {achieved ? 'Target reached' : 'Still to raise'}
        </span>
        <span className="text-h1 font-bold tracking-tight gradient-text tabular">
          {hasTarget ? `₹${remaining.toLocaleString('en-IN')}` : '—'}
        </span>
        <div className="hidden lg:flex items-center gap-2 mt-1.5">
          <span className="text-micro text-muted font-mono tracking-tight tabular">
            {fy.fyLabel} · ₹{total.toLocaleString('en-IN')} of ₹{target.toLocaleString('en-IN')}
          </span>
          <span className={`px-2 py-0.5 rounded-full ${badgeColor} border text-micro font-semibold`}>
            {achieved ? '🎉 Target Hit' : `${badgeEmoji} ${fy.remainingMonths}m ${fy.remainingDaysInMonth}d`}
          </span>
        </div>
        {total > 0 && (
          <span className="hidden lg:block text-micro text-faint font-mono tracking-tight mt-1">
            {totalWords}
          </span>
        )}
        {pendingRevenue.total > 0 && (
          <span
            className="text-micro text-warning font-mono tracking-tight mt-1 tabular"
            title="Submitted by members and included in the figure above, but not yet verified by an admin."
          >
            incl. ₹{pendingRevenue.total.toLocaleString('en-IN')} unverified
          </span>
        )}
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
