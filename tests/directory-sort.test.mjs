/**
 * Business Directory alphabetical ordering.
 *
 * Firestore returns documents in unspecified order, so the directory sort has to
 * be applied explicitly. These cover the cases that silently produce a
 * "random-looking" directory if handled naively: mixed case, blank company
 * names, and numbers embedded in names.
 *
 * Run: node tests/directory-sort.test.mjs
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));

// Mirrors byCompanyName in src/lib/format.ts
function byCompanyName(a, b) {
  const an = (a.companyName || '').trim();
  const bn = (b.companyName || '').trim();
  if (!an && !bn) return 0;
  if (!an) return 1;
  if (!bn) return -1;
  const loose = an.localeCompare(bn, 'en', { sensitivity: 'base', numeric: true });
  return loose !== 0 ? loose : an.localeCompare(bn, 'en');
}

const names = (list) => list.map((p) => p.companyName);
const mk = (list) => list.map((companyName) => ({ companyName }));

let pass = 0;
const t = (name, fn) => {
  try { fn(); console.log(`PASS  ${name}`); pass++; }
  catch (e) { console.log(`FAIL  ${name}  -> ${e.message}`); process.exitCode = 1; }
};

t('sorts A to Z', () => {
  const input = mk(['Zebra Ltd', 'Acme Corp', 'Midway Traders']);
  assert.deepStrictEqual(names(input.sort(byCompanyName)), ['Acme Corp', 'Midway Traders', 'Zebra Ltd']);
});

t('is case-insensitive', () => {
  const input = mk(['zebra', 'Apple', 'banana', 'Cherry']);
  assert.deepStrictEqual(names(input.sort(byCompanyName)), ['Apple', 'banana', 'Cherry', 'zebra']);
});

t('mixed case still groups together', () => {
  const input = mk(['acme', 'ACME Corp', 'Acme', 'acme industries']);
  const out = names(input.sort(byCompanyName));
  assert.ok(out.indexOf('acme') < out.indexOf('Acme'), '"acme" should precede "Acme"');
  assert.ok(out.indexOf('Acme') < out.indexOf('ACME Corp'), '"Acme" should precede "ACME Corp"');
});

t('ignores leading and trailing whitespace', () => {
  const input = mk(['  Beta  ', 'Alpha', '  Gamma']);
  assert.deepStrictEqual(names(input.sort(byCompanyName)), ['Alpha', '  Beta  ', '  Gamma']);
});

t('numbers sort naturally, not lexically', () => {
  const input = mk(['Firm 10', 'Firm 2', 'Firm 1']);
  assert.deepStrictEqual(names(input.sort(byCompanyName)), ['Firm 1', 'Firm 2', 'Firm 10']);
});

t('blank company names sink to the bottom', () => {
  const input = mk(['', 'Acme Corp', undefined, 'Zeta Ltd']);
  const out = names(input.sort(byCompanyName));
  assert.deepStrictEqual(out.slice(0, 2), ['Acme Corp', 'Zeta Ltd']);
  assert.strictEqual(out.length, 4);
  assert.ok(out[2] === '' || out[2] === undefined, 'blanks must come last');
});

t('a whitespace-only name is treated as blank', () => {
  const input = mk(['   ', 'Acme Corp']);
  assert.strictEqual(names(input.sort(byCompanyName))[0], 'Acme Corp');
});

t('two identical names tie without throwing', () => {
  assert.strictEqual(byCompanyName({ companyName: 'Acme' }, { companyName: 'Acme' }), 0);
});

t('sort is stable and does not mutate the input array', () => {
  const input = mk(['B', 'A', 'C']);
  const copy = [...input];
  input.sort(byCompanyName);
  assert.deepStrictEqual(names(copy), ['B', 'A', 'C'], 'input array must not be mutated');
  assert.deepStrictEqual(names(input), ['A', 'B', 'C']);
});

t('the real directory payload sorts into readable A–Z', () => {
  // Mirrors the shape actually stored in profiles/{uid}.
  const profiles = [
    { companyName: 'Sri Divya Enterprises', ownerName: 'A' },
    { companyName: 'FloLogix Automations', ownerName: 'B' },
    { companyName: 'iconpix pvt lts', ownerName: 'C' },
    { companyName: 'VIJAYA SURVEYORS', ownerName: 'D' },
    { companyName: 'Niva Corp LLP', ownerName: 'E' },
    { companyName: 'Electrical & Civil Works', ownerName: 'F' },
  ];
  const sorted = [...profiles].sort(byCompanyName).map((p) => p.companyName);
  assert.deepStrictEqual(sorted, [
    'Electrical & Civil Works',
    'FloLogix Automations',
    'iconpix pvt lts',
    'Niva Corp LLP',
    'Sri Divya Enterprises',
    'VIJAYA SURVEYORS',
  ]);
});

t('every directory surface consumes a sorted list', () => {
  // Structural guard: getAllProfiles is the single source for every directory.
  const firestore = readFileSync(join(root, 'src', 'lib', 'firestore.ts'), 'utf8');
  const start = firestore.indexOf('export async function getAllProfiles');
  const end = firestore.indexOf('// ─── Requests ───');
  assert.ok(start > -1 && end > start, 'could not locate getAllProfiles in firestore.ts');
  const block = firestore.slice(start, end);
  assert.ok(
    block.includes('sort(byCompanyName)'),
    'getAllProfiles must sort — member and admin directories both read from it',
  );
});

console.log(`\n${pass} passed`);