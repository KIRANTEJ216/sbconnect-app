export function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getFullYear()}`;
}

export function formatDateStr(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}-${m}-${y}`;
}

export function formatCurrency(value: string): string {
  if (!value) return '';
  const cleaned = value.replace(/[₹$€KSh\s,]/g, '');
  return cleaned ? `₹ ${cleaned}` : value;
}
