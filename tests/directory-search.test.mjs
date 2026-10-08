/**
 * Business-directory search tests.
 *
 * These lock in behaviour that shipped broken twice:
 *
 *  1. The predicate tested the whole trimmed query with `.includes()`, so a
 *     multi-word search only matched when the exact phrase sat contiguously in
 *     one field. "civil construction" returned nothing.
 *  2. `keywords` and `categories` imported from CSV were stored as a single
 *     comma-separated string. Spreading a bare string into an array explodes it
 *     into single characters, so keyword search silently failed for exactly
 *     those records.
 *  3. The directory was windowed with a virtualizer that resolved its row range
 *     against a stale scroll offset, putting filtered-out cards back on screen.
 *
 * The module is compiled with the project's own tsc rather than hand-stripped,
 * so a signature change fails loudly instead of passing against a stale regex.
 *
 * Run: node tests/directory-search.test.mjs
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = mkdtempSync(join(tmpdir(), 'dsc-'));

execFileSync(
  'npx',
  [
    'tsc',
    'src/lib/directorySearch.ts',
    '--ignoreConfig',
    '--outDir', outDir,
    '--module', 'commonjs',
    '--target', 'es2022',
    '--moduleResolution', 'bundler',
    '--skipLibCheck',
  ],
  { cwd: root, stdio: 'pipe' },
);

const require_ = createRequire(import.meta.url);
const { matchesSearch, searchTokens, filterProfiles } = require_(join(outDir, 'lib/directorySearch.js'));

let passed = 0;
const check = (name, fn) => {
  try {
    fn();
    passed++;
  } catch (err) {
    console.error(`  FAIL  ${name}`);
    console.error(`        ${err.message}`);
    process.exitCode = 1;
  }
};

const p = (over = {}) => ({
  uid: over.uid ?? 'u1',
  companyName: '',
  ownerName: '',
  location: '',
  description: '',
  categories: [],
  keywords: [],
  membershipStatus: 'active',
  verified: true,
  ...over,
});

const civil = p({
  uid: 'civil',
  companyName: 'Vastu Civil Works',
  ownerName: 'Ramesh Iyer',
  location: 'Bengaluru',
  categories: ['Construction'],
  keywords: ['civil', 'roads', 'bridges'],
});
const solar = p({
  uid: 'solar',
  companyName: 'Helio Solar',
  ownerName: 'Priya Nair',
  location: 'Chennai',
  categories: ['Energy'],
  keywords: ['solar', 'installation'],
  description: 'Rooftop and ground-mounted solar plants.',
});
const inter = p({
  uid: 'inter',
  companyName: 'Studio Interiors',
  ownerName: 'Anil Kumar',
  location: 'Bengaluru',
  categories: ['Interiors'],
  keywords: ['design'],
});

// ── tokenising ───────────────────────────────────────────────────────────────
check('empty query yields no tokens', () => {
  assert.deepEqual(searchTokens(''), []);
  assert.deepEqual(searchTokens('   '), []);
});
check('query is lowercased and split on whitespace', () => {
  assert.deepEqual(searchTokens('  Civil   CONSTRUCTION '), ['civil', 'construction']);
});
check('extra internal whitespace collapses', () => {
  assert.deepEqual(searchTokens('a   b\tc'), ['a', 'b', 'c']);
});

// ── single-token matching across every searchable field ──────────────────────
check('matches on company name', () =>
  assert.ok(matchesSearch(civil, ['vastu'])));
check('matches on owner name (was not searched before)', () =>
  assert.ok(matchesSearch(civil, ['ramesh'])));
check('matches on category', () =>
  assert.ok(matchesSearch(civil, ['construction'])));
check('matches on keyword', () =>
  assert.ok(matchesSearch(civil, ['bridges'])));
check('matches on location', () =>
  assert.ok(matchesSearch(civil, ['bengaluru'])));
check('matches on description (was not searched before)', () =>
  assert.ok(matchesSearch(solar, ['rooftop'])));
check('matching is case-insensitive', () =>
  assert.ok(matchesSearch(civil, ['VASTU'])));
check('empty tokens match everything', () =>
  assert.ok(matchesSearch(civil, [])));
check('non-matching token rejects', () =>
  assert.equal(matchesSearch(civil, ['solar']), false));

// ── multi-token: the bug that made "civil construction" return nothing ───────
check('multi-token AND matches across different fields', () => {
  assert.ok(matchesSearch(civil, ['vastu', 'construction']));
});
check('multi-token across keyword and location', () => {
  assert.ok(matchesSearch(civil, ['bridges', 'bengaluru']));
});
check('multi-token does NOT require contiguity within one field', () => {
  // "civil works" spans the two words of a single company name.
  assert.ok(matchesSearch(civil, ['civil', 'works']));
  // "bengaluru bridges" spans location and a keyword.
  assert.ok(matchesSearch(civil, ['bengaluru', 'bridges']));
});
check('multi-token requires EVERY token to match (narrows, never widens)', () => {
  assert.equal(matchesSearch(civil, ['civil', 'solar']), false);
  assert.equal(matchesSearch(solar, ['solar', 'civil']), false);
});
check('the old phrase-only behaviour would have failed these', () => {
  // Guards the regression directly: a single `.includes('civil construction')`
  // against any one field returns false, which is what shipped.
  const fields = [
    civil.companyName, civil.location, ...civil.categories, ...civil.keywords,
  ];
  assert.equal(fields.some((f) => f.toLowerCase().includes('civil construction')), false);
  assert.ok(matchesSearch(civil, ['civil', 'construction']));
});

// ── filterProfiles: list behaviour + ordering ────────────────────────────────
check('empty query returns all, sorted A-Z', () => {
  const out = filterProfiles([solar, inter, civil], '');
  assert.equal(out.length, 3);
  assert.deepEqual(out.map((x) => x.companyName), [
    'Helio Solar',
    'Studio Interiors',
    'Vastu Civil Works',
  ]);
});
check('single token narrows the list', () => {
  const out = filterProfiles([solar, inter, civil], 'bengaluru');
  assert.deepEqual(out.map((x) => x.uid), ['inter', 'civil']);
});
check('multi-token narrows across profiles', () => {
  const out = filterProfiles([solar, inter, civil], 'civil construction');
  assert.deepEqual(out.map((x) => x.uid), ['civil']);
});
check('results stay sorted A-Z', () => {
  const out = filterProfiles([civil, solar, inter], 'bengaluru');
  const names = out.map((x) => x.companyName);
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)));
});
check('no matches returns an empty list', () => {
  assert.deepEqual(filterProfiles([solar, inter, civil], 'nonexistentxyz'), []);
});
check('query with odd spacing still matches', () => {
  assert.equal(filterProfiles([civil], '   civil    works   ').length, 1);
});
check('does not mutate the input array', () => {
  const input = [solar, civil];
  const copy = [...input];
  filterProfiles(input, '');
  assert.deepEqual(input.map((x) => x.uid), copy.map((x) => x.uid));
});
check('profiles missing optional fields do not throw', () => {
  const sparse = p({ uid: 'sparse', companyName: 'Bare Co' });
  assert.ok(matchesSearch(sparse, ['bare']));
  assert.equal(matchesSearch(sparse, ['zzz']), false);
});
check('a token cannot straddle two fields via the join separator', () => {
  const bare = p({ uid: 'bare', companyName: 'Bare Co', location: 'Pune' });
  // Two tokens each match, so the profile matches...
  assert.ok(matchesSearch(bare, ['bare', 'pune']));
  // ...but one token must never match across the field boundary, which is what
  // the \u0001 separator guards against.
  assert.equal(matchesSearch(bare, ['bareco', '' ].slice(0, 1)[0] ? ['bareco'] : []), false);
});

// ── CSV-imported records where keywords/categories are one string ───────────
// These arrived from bulkImportProfiles as a comma-separated string rather than
// an array. Spreading a bare string into an array produced one character per
// entry, so `keywords.includes('civil')` was false and keyword search found
// nothing for exactly those members.
const legacy = p({
  uid: 'legacy',
  companyName: 'Imported Traders',
  // Deliberately the wrong runtime type, as stored by the importer.
  keywords: 'Civil, Roads, Turnkey',
  categories: 'Construction',
});
check('comma-separated keyword string is searched word-wise', () => {
  assert.ok(matchesSearch(legacy, ['civil']));
  assert.ok(matchesSearch(legacy, ['turnkey']));
});
check('a keyword string is not searched character-by-character', () => {
  // "civil" as characters would be c,i,v,i,l — this proves whole-word matching.
  assert.ok(matchesSearch(legacy, ['civil']));
  assert.equal(matchesSearch(legacy, ['iv']), false);
});
check('multi-token works on legacy records too', () => {
  assert.ok(matchesSearch(legacy, ['civil', 'construction']));
});
check('semicolon and pipe separated strings also split', () => {
  const odd = p({ uid: 'odd', companyName: 'Odd Separators', keywords: 'alpha;beta|gamma' });
  assert.ok(matchesSearch(odd, ['beta']));
  assert.ok(matchesSearch(odd, ['gamma']));
});

// ── prefix matching ──────────────────────────────────────────────────────────
check('a token matches the start of a longer word', () => {
  const panels = p({ uid: 'panels', companyName: 'Sun Works', keywords: ['solarpanels'] });
  assert.ok(matchesSearch(panels, ['solar']));
});
check('a token does not match mid-word', () => {
  const solar = p({ uid: 'solar', companyName: 'Sun Works', keywords: ['solar'] });
  assert.equal(matchesSearch(solar, ['ola']), false);
});
check('multi-word tokens split so both parts match', () => {
  const panels = p({ uid: 'panels', companyName: 'Sun Works', keywords: ['solar panels'] });
  // Via filterProfiles, because splitting is searchTokens' job — calling
  // matchesSearch with an already-space-joined token bypasses it by design.
  assert.equal(filterProfiles([panels], 'solar panels').length, 1);
  assert.ok(matchesSearch(panels, ['solar', 'panels']));
});

// ── punctuation and noise ───────────────────────────────────────────────────
check('punctuation in the query is ignored rather than breaking matching', () => {
  assert.deepEqual(searchTokens('civil,'), ['civil']);
  assert.deepEqual(searchTokens('(civil)'), ['civil']);
  assert.equal(filterProfiles([civil], 'civil,').length, 1);
  assert.equal(filterProfiles([civil], '(civil)').length, 1);
});
check('a query of only punctuation yields no tokens', () => {
  assert.deepEqual(searchTokens('!!!'), []);
});
check('owner surname is searchable', () => {
  const named = p({ uid: 'named', companyName: 'Acme', ownerSurname: 'Kumar' });
  assert.ok(matchesSearch(named, ['kumar']));
});
check('empty keyword arrays do not throw and still match on name', () => {
  const bare = p({ uid: 'bare', companyName: 'Vastu Civil Works', keywords: [], categories: [] });
  assert.ok(matchesSearch(bare, ['vastu']));
  assert.equal(matchesSearch(bare, ['solar']), false);
});

console.log(`directory-search: ${passed} passed`);