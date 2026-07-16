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

export function formatCurrency(value: string): string {
  if (!value) return '';
  const cleaned = value.replace(/[₹€KSh\s,]/g, '');
  return cleaned || value;
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
