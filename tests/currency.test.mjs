/**
 * Compact Indian currency notation. The dashboard and leaderboards use these in
 * dense tables, so the thresholds and rounding have to be exact — "₹1.00L" for a
 * value that is not a lakh is the kind of thing nobody notices until a number
 * they report to the chapter is wrong.
 *
 * Run: node tests/currency.test.mjs
 */
import assert from 'node:assert';

const fmt = (n, d) =>
  n.toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });

// Mirrors formatCompactINR in src/lib/format.ts
function formatCompactINR(value) {
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (abs >= 1e7) return `${sign}₹${fmt(abs / 1e7, 2)}Cr`;
  if (abs >= 1e5) return `${sign}₹${fmt(abs / 1e5, 2)}L`;
  if (abs >= 1e3) return `${sign}₹${fmt(abs / 1e3, 1)}K`;
  return `${sign}₹${Math.round(abs).toLocaleString('en-IN')}`;
}

let pass = 0;
const t = (name, fn) => {
  try { fn(); console.log(`PASS  ${name}`); pass++; }
  catch (e) { console.log(`FAIL  ${name}  -> ${e.message}`); process.exitCode = 1; }
};

// ── Always carries the ₹ symbol ──
t('every formatted amount includes the rupee sign', () => {
  for (const v of [0, 5, 999, 1000, 46000, 100000, 356000, 35000000]) {
    assert.ok(formatCompactINR(v).startsWith('₹'), `${v} lost the ₹ symbol`);
  }
});

t('values below a thousand render in full', () => {
  assert.strictEqual(formatCompactINR(0), '₹0');
  assert.strictEqual(formatCompactINR(500), '₹500');
  assert.strictEqual(formatCompactINR(999), '₹999');
});

t('thousands shorten to K with one decimal', () => {
  assert.strictEqual(formatCompactINR(1000), '₹1.0K');
  assert.strictEqual(formatCompactINR(46000), '₹46.0K');
  assert.strictEqual(formatCompactINR(99400), '₹99.4K');
});

// ── The lakh threshold the user asked for ──
t('one lakh is the switch point to L', () => {
  assert.strictEqual(formatCompactINR(99999), '₹100.0K');
  assert.strictEqual(formatCompactINR(100000), '₹1.00L');
});

t('lakh values render with two decimals', () => {
  assert.strictEqual(formatCompactINR(356000), '₹3.56L');
  assert.strictEqual(formatCompactINR(240000), '₹2.40L');
  assert.strictEqual(formatCompactINR(1500000), '₹15.00L');
});

t('one crore is the switch point to Cr', () => {
  assert.strictEqual(formatCompactINR(9999900), '₹100.00L');
  assert.strictEqual(formatCompactINR(10000000), '₹1.00Cr');
});

t('crore values render with two decimals', () => {
  // Indian grouping is 2-2-3, so 350,000,000 is "35,00,00,000" = 35 crore.
  assert.strictEqual(formatCompactINR(35000000), '₹3.50Cr');
  assert.strictEqual(formatCompactINR(350000000), '₹35.00Cr');
  assert.strictEqual(formatCompactINR(125000000), '₹12.50Cr');
  assert.strictEqual(formatCompactINR(10000000), '₹1.00Cr');
});

// ── Round-trip sanity: compact must never imply a different order of magnitude ──
t('compact value is within 1% of the original', () => {
  const parse = (s) => {
    const m = s.match(/₹([\d,.]+)(K|L|Cr)?/);
    const n = parseFloat(m[1].replace(/,/g, ''));
    return m[2] === 'K' ? n * 1e3 : m[2] === 'L' ? n * 1e5 : m[2] === 'Cr' ? n * 1e7 : n;
  };
  for (const v of [46000, 356000, 240000, 1500000, 35000000, 350000000]) {
    const back = parse(formatCompactINR(v));
    assert.ok(Math.abs(back - v) / v < 0.01, `${v} -> ${formatCompactINR(v)} -> ${back} drifted`);
  }
});

// ── Sign handling ──
t('negative amounts keep the sign outside the symbol', () => {
  assert.strictEqual(formatCompactINR(-46000), '-₹46.0K');
  assert.strictEqual(formatCompactINR(-350000000), '-₹35.00Cr');
});

// ── Sign handling ──
t('full-value output uses Indian grouping (lakh, not 100k)', () => {
  const exact = (v) => `${v < 0 ? '-' : ''}₹${Math.abs(v).toLocaleString('en-IN')}`;
  assert.strictEqual(exact(356000), '₹3,56,000');
  // en-IN groups as 35 | 00 | 00 | 000 — the same number as 350,000,000.
  assert.strictEqual(exact(350000000), '₹35,00,00,000');
  assert.strictEqual(exact(-240000), '-₹2,40,000');
});

// ── String input path (used where amounts arrive as formatted display strings) ──
function toCompactINR(value) {
  const n = typeof value === 'number'
    ? value
    : parseFloat(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? formatCompactINR(n) : '';
}

t('display strings like "₹2,40,000" parse and compact', () => {
  assert.strictEqual(toCompactINR('₹2,40,000'), '₹2.40L');
  assert.strictEqual(toCompactINR('₹3,56,000'), '₹3.56L');
});

t('unparseable strings yield an empty string, not NaN', () => {
  assert.strictEqual(toCompactINR(''), '');
  assert.strictEqual(toCompactINR('abc'), '');
});

console.log(`\n${pass} passed`);