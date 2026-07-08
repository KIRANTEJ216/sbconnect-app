export function MembershipCountdown({ membershipExpiry }: { membershipExpiry: number }) {
  const now = Date.now();
  const diff = membershipExpiry - now;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const absDays = Math.abs(days);

  if (diff <= 0) {
    return (
      <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-center">
        <p className="text-xs font-mono text-danger font-semibold">EXPIRED</p>
        <p className="text-3xl font-bold text-danger">{absDays}</p>
        <p className="text-[10px] text-danger/70">days ago</p>
      </div>
    );
  }

  if (days > 60) return null;

  const thresholds = [
    { max: 60, min: 46, bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-700', label: 'Healthy' },
    { max: 45, min: 31, bg: 'bg-yellow-50', border: 'border-yellow-300', text: 'text-yellow-700', label: 'Warning' },
    { max: 30, min: 16, bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-700', label: 'Expiring Soon' },
    { max: 15, min: 8, bg: 'bg-orange-100', border: 'border-orange-400', text: 'text-orange-800', label: 'Critical' },
    { max: 7, min: 4, bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-700', label: 'Urgent' },
    { max: 3, min: 2, bg: 'bg-red-100', border: 'border-red-400', text: 'text-red-800', label: 'Very Urgent' },
    { max: 1, min: 1, bg: 'bg-red-200', border: 'border-red-500', text: 'text-red-900', label: 'Last Day' },
    { max: 0, min: 0, bg: 'bg-rose-200', border: 'border-rose-500', text: 'text-rose-900', label: 'Expiring Today' },
  ];

  const threshold = thresholds.find((t) => days >= t.min && days <= t.max) || thresholds[thresholds.length - 1];

  return (
    <div className={`p-3 rounded-xl ${threshold.bg} ${threshold.border} border text-center`}>
      <p className={`text-xs font-mono font-semibold ${threshold.text}`}>{threshold.label}</p>
      <p className={`text-3xl font-bold ${threshold.text}`}>{days}</p>
      <p className="text-[10px] text-muted">days remaining</p>
    </div>
  );
}
