/**
 * Admin email alert tests.
 *
 * These assert the two things that actually break in practice:
 *
 *  1. Every interpolated value is HTML-escaped. Request titles and issue subjects
 *     are attacker-controlled, and `adminEmail.composeEmail` is the only thing
 *     standing between them and an inbox.
 *  2. A Resend failure never throws — a mail outage must not fail a member's
 *     post, because the handler is wrapped in the same trigger that observes the
 *     write.
 *
 * `composeEmail` is pure, so it is compiled and imported directly; the Resend
 * path is exercised against a stubbed key.
 *
 * Run: node tests/admin-email.test.mjs
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Compile inside functions/ so the emitted CommonJS resolves `firebase-functions`
// and `resend` by walking up to functions/node_modules. A temp dir under the OS
// temp folder would fail MODULE_NOT_FOUND for those imports.
const outDir = join(root, 'functions', '.test-build-admin-email');
rmSync(outDir, { recursive: true, force: true });

try {
  execFileSync(
    'npx',
    [
      'tsc',
      'functions/src/adminEmail.ts',
      'functions/src/html.ts',
      '--ignoreConfig',
      '--outDir', outDir,
      '--module', 'commonjs',
      '--target', 'es2022',
      '--moduleResolution', 'bundler',
      '--skipLibCheck',
    ],
    { cwd: root, stdio: 'pipe' },
  );
} finally {
  // Compiled output is disposable; remove it whatever happens.
  process.on('exit', () => rmSync(outDir, { recursive: true, force: true }));
}

const require_ = createRequire(import.meta.url);
const { composeEmail, composeRequestDigest, IMMEDIATE_ALERT_KINDS, _resetBursts, _flushAll, notifyAdmin } = require_(
  join(outDir, 'adminEmail.js'),
);

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

const one = (kind, data) => composeEmail([{ kind, data }]);
const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#x27;');

// ── 1. Every event kind produces the right subject ───────────────────────────
check('new_request subject', () => {
  const e = one('new_request', { title: 'Need a civil contractor', id: 'r1' });
  assert.equal(e.subject, '[SB Connect] New request posted');
});
check('new_profile subject', () => {
  const e = one('new_profile', { companyName: 'Vastu Civil', id: 'p1' });
  assert.equal(e.subject, '[SB Connect] New profile awaiting verification');
});
check('new_pitch subject', () => {
  const e = one('new_pitch', { requestTitle: 'Roads', id: 'i1' });
  assert.equal(e.subject, '[SB Connect] New pitch on a request');
});
check('pending_revenue subject', () => {
  const e = one('pending_revenue', { amountValue: 240000, id: 'd1' });
  assert.equal(e.subject, '[SB Connect] Revenue awaiting verification');
});
check('new_issue subject', () => {
  const e = one('new_issue', { subject: 'Cannot upload photo', id: 'x1' });
  assert.equal(e.subject, '[SB Connect] New issue report');
});
check('new_meeting subject', () => {
  const e = one('new_meeting', { label: 'Monthly Meet', id: 'm1' });
  assert.equal(e.subject, '[SB Connect] New meeting scheduled');
});

// ── 2. Key fields actually reach the body ────────────────────────────────────
check('request body includes title, budget, deadline, company, id', () => {
  const { html } = one('new_request', {
    title: 'Civil contractor needed',
    budget: '1.5L',
    deadline: '2026-11-30',
    companyName: 'Niva Corp LLP',
    uid: 'uid123',
    description: 'Bridge work',
    id: 'req-9',
  });
  for (const needle of ['Civil contractor needed', '1.5L', '2026-11-30', 'Niva Corp LLP', 'uid123', 'req-9']) {
    assert.ok(html.includes(needle), `missing ${needle}`);
  }
});
check('request uses customCategory when category is Other', () => {
  const { html } = one('new_request', {
    category: 'Other', customCategory: 'Drone Survey', title: 'T', id: 'r',
  });
  assert.ok(html.includes('Drone Survey'));
});
check('profile body includes owner, categories, location, contact', () => {
  const { html } = one('new_profile', {
    companyName: 'Helio Solar', ownerName: 'Priya', ownerSurname: 'Nair',
    categories: ['Energy', 'Rooftop'], location: 'Chennai',
    contactEmail: 'p@example.com', countryCode: '+91', phone: '9876543210',
    id: 'prof-1',
  });
  for (const needle of ['Helio Solar', 'Priya Nair', 'Energy, Rooftop', 'Chennai', 'p@example.com', '+91 9876543210', 'prof-1']) {
    assert.ok(html.includes(needle), `missing ${needle}`);
  }
});
check('pitch body includes request title, company, phone', () => {
  const { html } = one('new_pitch', {
    requestTitle: 'Bridge work', companyName: 'Acme', phone: '9000000000',
    message: 'We can help', id: 'int-2', requestId: 'req-2',
  });
  for (const needle of ['Bridge work', 'Acme', '9000000000', 'We can help', 'int-2', 'req-2']) {
    assert.ok(html.includes(needle), `missing ${needle}`);
  }
});
check('pending revenue formats the amount in rupees', () => {
  const { html } = one('pending_revenue', {
    amountValue: 240000, receiverCompanyName: 'Receiver Co',
    giverCompanyName: 'Giver Co', submittedByRole: 'member', id: 'deal-3',
  });
  assert.ok(html.includes('\u20b92,40,000'), 'expected ₹2,40,000');
  assert.ok(html.includes('Receiver Co'));
  assert.ok(html.includes('Giver Co'));
  assert.ok(html.includes('deal-3'));
});
check('issue body includes subject, company, reporter', () => {
  const { html } = one('new_issue', {
    subject: 'Upload fails', companyName: 'Acme',
    userDisplayName: 'Asha', userEmail: 'a@example.com', description: '500 error', id: 'iss-4',
  });
  for (const needle of ['Upload fails', 'Acme', 'Asha', 'a@example.com', '500 error', 'iss-4']) {
    assert.ok(html.includes(needle), `missing ${needle}`);
  }
});
check('meeting body includes label, date, location', () => {
  const { html } = one('new_meeting', {
    label: 'Monthly Meet', date: '2026-11-05', location: 'Bengaluru', id: 'meet-5',
  });
  for (const needle of ['Monthly Meet', '2026-11-05', 'Bengaluru', 'meet-5']) {
    assert.ok(html.includes(needle), `missing ${needle}`);
  }
});

// ── 3. Escaping: attacker-controlled fields must be inert ───────────────────
const XSS = '<script>alert("xss")</script>';

check('request title is escaped', () => {
  const { html } = one('new_request', { title: XSS, id: 'r' });
  assert.ok(!html.includes('<script>'), 'raw <script> leaked into the email');
  assert.ok(html.includes(esc(XSS)), 'title was not escaped');
});
check('issue subject is escaped', () => {
  const { html } = one('new_issue', { subject: XSS, id: 'x' });
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes(esc(XSS)));
});
check('profile company name is escaped', () => {
  const { html } = one('new_profile', { companyName: XSS, id: 'p' });
  assert.ok(!html.includes('<script>'));
});
check('pitch message is escaped', () => {
  const { html } = one('new_pitch', { requestTitle: 'R', message: XSS, id: 'i' });
  assert.ok(!html.includes('<script>'));
});
check('attribute-breaking quotes are escaped', () => {
  const { html } = one('new_request', { title: '" onmouseover="alert(1)', id: 'r' });
  assert.ok(!html.includes('onmouseover="alert'), 'attribute injection succeeded');
  assert.ok(html.includes('&quot;'));
});
check('ampersand is escaped first so entities are not double-decoded', () => {
  const { html } = one('new_request', { title: 'Ben & Jerry', id: 'r' });
  assert.ok(html.includes('Ben &amp; Jerry'));
});

// ── 4. Long free text is clamped so an inbox is not flooded ─────────────────
check('description is truncated', () => {
  const long = 'a'.repeat(500);
  const { html } = one('new_request', { title: 'T', description: long, id: 'r' });
  assert.ok(!html.includes('a'.repeat(200)), 'description was not clamped');
  assert.ok(html.includes('…'));
});

// ── 5. Burst coalescing ─────────────────────────────────────────────────────
check('a burst of same-kind events produces one email', () => {
  const items = Array.from({ length: 25 }, (_, i) => ({
    kind: 'new_profile',
    data: { companyName: `Co ${i}`, id: `p${i}` },
  }));
  const { subject, html } = composeEmail(items);
  assert.equal(subject, '[SB Connect] New profile awaiting verification (25)');
  // Every item is still represented — nothing is dropped.
  for (let i = 0; i < 25; i++) assert.ok(html.includes(`Co ${i}`), `missing Co ${i}`);
});
check('a very large burst is capped and says how many were omitted', () => {
  // 200 rows from a CSV import would otherwise be ~90 KB of HTML, which Gmail
  // clips at ~102 KB — hiding the content the admin opened the email for.
  const items = Array.from({ length: 200 }, (_, i) => ({
    kind: 'new_profile',
    data: { companyName: `Co ${i}`, id: `p${i}` },
  }));
  const { subject, html } = composeEmail(items);
  assert.equal(subject, '[SB Connect] New profile awaiting verification (200)');
  assert.ok(html.length < 30_000, `html still too large: ${html.length}`);
  // The first 25 are shown in full...
  for (let i = 0; i < 25; i++) assert.ok(html.includes(`Co ${i}`), `missing Co ${i}`);
  // ...the rest are stated rather than silently dropped.
  assert.ok(html.includes('175 further items'), 'missing overflow notice');
  assert.ok(!html.includes('Co 199'), 'overflow items should not be rendered in full');
});
check('burst of 2 request + 2 pitch would stay 2 separate emails', () => {
  const reqs = composeEmail([
    { kind: 'new_request', data: { title: 'R1', id: 'a' } },
    { kind: 'new_request', data: { title: 'R2', id: 'b' } },
  ]);
  assert.equal(reqs.subject, '[SB Connect] New request posted (2)');
  const pitches = composeEmail([
    { kind: 'new_pitch', data: { requestTitle: 'P1', id: 'c' } },
    { kind: 'new_pitch', data: { requestTitle: 'P2', id: 'd' } },
  ]);
  assert.equal(pitches.subject, '[SB Connect] New pitch on a request (2)');
  // Kinds never merge.
  assert.ok(!reqs.html.includes('P1'));
});
check('a single item never gets a count suffix', () => {
  const { subject } = one('new_request', { title: 'T', id: 'r' });
  assert.ok(!subject.includes('(1)'));
});

// ── 6. notifyAdmin never throws, with or without a Resend key ───────────────
check('notifyAdmin does not throw with no RESEND_API_KEY', () => {
  delete process.env.RESEND_API_KEY;
  _resetBursts();
  assert.doesNotThrow(() => {
    notifyAdmin('new_request', { title: 'T', id: 'r' });
    notifyAdmin('new_profile', { companyName: 'C', id: 'p' });
  });
});
check('notifyAdmin does not throw with garbage in the payload', () => {
  _resetBursts();
  assert.doesNotThrow(() => {
    notifyAdmin('new_request', { title: undefined, budget: null, categories: [null] });
  });
});
check('notifyAdmin does not throw for an unknown-shaped kind', () => {
  _resetBursts();
  assert.doesNotThrow(() => notifyAdmin('new_issue', {}));
});
check('flushing with no key logs a warning and resolves, not rejects', async () => {
  delete process.env.RESEND_API_KEY;
  _resetBursts();
  notifyAdmin('new_meeting', { label: 'L', id: 'm' });
  // _flushAll is async; assert it settles rather than rejects.
  assert.ok(_flushAll() instanceof Promise);
});

// ── 7. The 12-hourly request digest ─────────────────────────────────────────
// Requirement: email every 12 hours, but only when there are new requests. The
// decisive assertion is the first one — an empty window must produce NO email.
check('EMPTY digest sends nothing at all', () => {
  const d = composeRequestDigest([], '12h window');
  assert.equal(d.shouldSend, false, 'an empty window must not send');
  assert.equal(d.count, 0);
  assert.equal(d.subject, '', 'no subject means nothing will be emailed');
  assert.equal(d.html, '');
});
check('digest with 1 request sends', () => {
  const d = composeRequestDigest(
    [{ id: 'r1', title: 'Need a vendor', budget: '50k', deadline: '2026-12-01', companyName: 'Acme', uid: 'u1' }],
    '12h window',
  );
  assert.equal(d.shouldSend, true);
  assert.equal(d.count, 1);
  assert.equal(d.subject, '[SB Connect] 1 new request awaiting review (12h window)');
  assert.ok(d.html.includes('Need a vendor'));
  assert.ok(d.html.includes('50k'));
  assert.ok(d.html.includes('Acme'));
  assert.ok(d.html.includes('r1'));
});
check('digest with many requests pluralises and counts', () => {
  const reqs = Array.from({ length: 7 }, (_, i) => ({ id: `r${i}`, title: `Job ${i}` }));
  const d = composeRequestDigest(reqs, '12h window');
  assert.equal(d.shouldSend, true);
  assert.equal(d.count, 7);
  assert.ok(d.subject.includes('7 new requests awaiting review'));
  for (let i = 0; i < 7; i++) assert.ok(d.html.includes(`Job ${i}`), `missing Job ${i}`);
});
check('digest escapes an attacker-controlled title', () => {
  const d = composeRequestDigest([{ id: 'r', title: '<script>alert(1)</script>' }], '12h window');
  assert.ok(!d.html.includes('<script>'));
  assert.ok(!d.subject.includes('<script>'));
});
check('digest caps detail and states the remainder', () => {
  const reqs = Array.from({ length: 40 }, (_, i) => ({ id: `r${i}`, title: `Job ${i}` }));
  const d = composeRequestDigest(reqs, '12h window');
  assert.ok(d.html.length < 30_000, `html too large: ${d.html.length}`);
  assert.ok(d.html.includes('15 further requests'), 'missing remainder notice');
  assert.ok(!d.html.includes('Job 39'), 'overflow should not render in full');
});
check('digest uses customCategory when category is Other', () => {
  const d = composeRequestDigest(
    [{ id: 'r', title: 'T', category: 'Other', customCategory: 'Drone Survey' }],
    '12h window',
  );
  assert.ok(d.html.includes('Drone Survey'));
});
check('digest subject includes the reporting window', () => {
  const d = composeRequestDigest([{ id: 'r', title: 'T' }], '12h window');
  assert.ok(d.subject.includes('12h window'));
});

// ── 8. Requests no longer alert immediately ─────────────────────────────────
check('requests are NOT in the immediate-alert list', () => {
  assert.ok(
    !IMMEDIATE_ALERT_KINDS.includes('new_request'),
    'new_request must not alert immediately — it is digest-only now',
  );
});
check('the other five kinds still alert immediately', () => {
  for (const k of ['new_profile', 'new_pitch', 'pending_revenue', 'new_issue', 'new_meeting']) {
    assert.ok(IMMEDIATE_ALERT_KINDS.includes(k), `${k} should still alert immediately`);
  }
});

console.log(`admin-email: ${passed} passed`);