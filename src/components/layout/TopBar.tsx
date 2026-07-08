import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { signOut } from '../../lib/auth';
import { getTotalBusinessValue, getBusinessProfile } from '../../lib/firestore';
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
  const [total, setTotal] = useState(0);
  const [now, setNow] = useState(new Date());
  const [ownerName, setOwnerName] = useState('');

  useEffect(() => {
    getTotalBusinessValue().then(setTotal).catch(() => {});
    const t = setInterval(() => setNow(new Date()), 1000);
    const unsub = setInterval(() => {
      getTotalBusinessValue().then(setTotal).catch(() => {});
    }, 30000);
    return () => { clearInterval(t); clearInterval(unsub); };
  }, []);

  useEffect(() => {
    if (user) {
      getBusinessProfile(user.uid).then((bp) => {
        if (bp?.ownerName) setOwnerName(`${bp.ownerName} ${bp.ownerSurname || ''}`.trim());
      }).catch(() => {});
    }
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const nowYear = now.getFullYear();
  const nowMonth = now.getMonth() + 1;
  const fyStart = nowMonth >= 4 ? nowYear : nowYear - 1;
  const fyLabel = `${String(fyStart).slice(-2)}-${String(fyStart + 1).slice(-2)}`;

  return (
    <header className="h-24 shrink-0 bg-surface-warm/80 backdrop-blur-md border-b border-border flex items-center justify-between px-4 sm:px-6 sticky top-0 z-40">
      <div className="flex items-center gap-3">
        <button onClick={onMenuToggle} className="md:hidden p-1.5 -ml-1.5 rounded-xl hover:bg-primary-light/50 transition-colors cursor-pointer" aria-label="Toggle menu">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A1A1AA" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <div className="hidden sm:block">
          <p className="text-sm text-muted font-mono tracking-tight leading-tight">
            {now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
          <p className="text-sm font-semibold tracking-tight leading-tight mt-[1px] text-primary">
            {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center leading-tight">
        <span className="text-4xl font-bold tracking-tight gradient-text">₹ {total.toLocaleString('en-IN')}</span>
        <span className="text-xs text-muted font-mono tracking-tight mt-1">Total Revenue &middot; FY {fyLabel}</span>
        <p className="text-[11px] text-steel font-mono tracking-tight mt-0.5">{total > 0 ? toWords(total) : 'Zero'} Rupees</p>
      </div>

      <div className="flex items-center gap-4">
        {user && (
          <>
            <span className="text-sm font-medium text-charcoal hidden sm:inline tracking-tight">
              {ownerName || user.displayName || user.email}
            </span>
            <div className="w-9 h-9 bg-canvas rounded-xl flex items-center justify-center text-charcoal font-semibold text-sm border border-border">
              {(ownerName || user.displayName || user.email || '?').charAt(0).toUpperCase()}
            </div>
            <button
              onClick={handleSignOut}
              className="p-2 rounded-xl text-muted hover:text-danger hover:bg-danger-light transition-all duration-200 cursor-pointer"
              title="Sign out"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </>
        )}
      </div>
    </header>
  );
}
