export function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getFullYear()}`;
}

export function formatDateStr(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}-${m}-${y}`;
}

export function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  const hours = d.getHours();
  const mins = d.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const h12 = (hours % 12) || 12;
  return `${h12}:${mins} ${ampm}`;
}

/**
 * Normalises a currency-ish string down to its digits. This is a *sanitiser*,
 * not a formatter — it deliberately strips ₹/€/KSh and separators, which is why
 * callers that only used this ended up rendering bare numbers. Use
 * `formatINR` / `formatCompactINR` to actually display money.
 */
export function formatCurrency(value: string): string {
  if (!value) return '';
  const cleaned = value.replace(/[₹€KSh\s,]/g, '');
  return cleaned || value;
}

/** Full precision with Indian digit grouping, e.g. ₹3,56,000. */
export function formatINR(value: number): string {
  const sign = value < 0 ? '-' : '';
  return `${sign}₹${Math.abs(value).toLocaleString('en-IN')}`;
}

/**
 * Compact Indian notation for dense UI. Anything at or above a lakh shortens to
 * L and a crore to Cr, so a ₹3,50,00,000 target reads as ₹3.50Cr instead of
 * pushing the layout around. Below a thousand it falls back to plain digits.
 */
export function formatCompactINR(value: number): string {
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  const fixed = (n: number, d: number) =>
    n.toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });

  if (abs >= 1e7) return `${sign}₹${fixed(abs / 1e7, 2)}Cr`;
  if (abs >= 1e5) return `${sign}₹${fixed(abs / 1e5, 2)}L`;
  if (abs >= 1e3) return `${sign}₹${fixed(abs / 1e3, 1)}K`;
  return `${sign}₹${Math.round(abs).toLocaleString('en-IN')}`;
}

/**
 * Formats either a formatted string or a number as compact INR. Safe to drop
 * into places that were previously calling `formatCurrency`.
 */
export function toCompactINR(value: string | number): string {
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? formatCompactINR(n) : '';
}

/**
 * Alphabetical A–Z by company name, case-insensitive, blanks last.
 *
 * `numeric: true` keeps numbered names in natural order, so "Firm 2" sorts
 * before "Firm 10" rather than after it. The final exact comparison is a stable
 * tiebreak so entries differing only by case still order deterministically.
 */
export function byCompanyName<T extends { companyName?: string }>(a: T, b: T): number {
  const an = (a.companyName || '').trim();
  const bn = (b.companyName || '').trim();
  if (!an && !bn) return 0;
  if (!an) return 1;
  if (!bn) return -1;
  const loose = an.localeCompare(bn, 'en', { sensitivity: 'base', numeric: true });
  return loose !== 0 ? loose : an.localeCompare(bn, 'en');
}

export function getFinancialYear() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const fyStartYear = month >= 4 ? year : year - 1;
  const fyStartDate = new Date(fyStartYear, 3, 1);
  const fyEndDate = new Date(fyStartYear + 1, 2, 31);
  const totalDays = Math.round((fyEndDate.getTime() - fyStartDate.getTime()) / 86400000) + 1;
  const elapsedDays = Math.max(0, Math.round((now.getTime() - fyStartDate.getTime()) / 86400000));
  const remainingDays = Math.max(0, totalDays - elapsedDays);

  const totalMonths = 12;
  const elapsedMonths = Math.max(0, month >= 4 ? month - 4 : month + 8);
  const remainingMonths = totalMonths - elapsedMonths;

  const endOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const daysInMonth = endOfCurrentMonth.getDate();
  const daysPassedInMonth = now.getDate();
  const remainingDaysInMonth = daysInMonth - daysPassedInMonth;

  const timeProgress = totalDays > 0 ? Math.min(elapsedDays / totalDays, 1) : 0;

  const fyLabel = `FY ${String(fyStartYear).slice(-2)}-${String(fyStartYear + 1).slice(-2)}`;

  return {
    fyStartYear,
    fyLabel,
    fyStartDate,
    fyEndDate,
    totalDays,
    elapsedDays,
    remainingDays,
    totalMonths,
    elapsedMonths,
    remainingMonths,
    remainingDaysInMonth,
    timeProgress,
  };
}
