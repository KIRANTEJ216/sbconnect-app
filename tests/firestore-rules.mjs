/**
 * Security regression check for the revenue approval workflow.
 *
 * The point of the feature is that member-entered revenue cannot count until an
 * admin verifies it. Rules are the only real enforcement, so assert them directly
 * rather than trusting a unit test of the client helpers.
 *
 * Run: node tests/firestore-rules.mjs
 */
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

// Overridable — see the note in tests/ledger-fidelity.mjs. 8080 is frequently
// occupied by an unrelated dev server, which makes the emulator fail to bind
// and this suite then test nothing at all.
const PORT = Number(process.env.SB_EMULATOR_PORT || 8080);
const HOST = `http://127.0.0.1:${PORT}`;
const PROJ = 'demo-sbconnect';

// The emulator reads its port from firebase.json, so honouring SB_EMULATOR_PORT
// requires handing `emulators:start` a config that says so. Written to a temp
// file rather than mutating the real firebase.json.
function emulatorConfigPath(port) {
  const cfgPath = new URL('../firebase.json', import.meta.url);
  const base = JSON.parse(readFileSync(cfgPath, 'utf8'));
  base.emulators = { ...(base.emulators || {}), firestore: { ...(base.emulators?.firestore || {}), port } };
  // `emulators:start --config <tmpfile>` resolves `firestore.rules` and
  // `firestore.indexes` RELATIVE TO THE CONFIG FILE, so the copied relative paths
  // ("firestore.rules") pointed into the temp directory. The emulator then loaded
  // no rules at all and defaulted to allow-all, which made the suite report
  // members could overwrite revenue totals. Rewrite them as absolute paths.
  const projectRoot = dirname(fileURLToPath(cfgPath));
  if (base.firestore?.rules) {
    base.firestore.rules = join(projectRoot, base.firestore.rules);
  }
  if (base.firestore?.indexes) {
    base.firestore.indexes = join(projectRoot, base.firestore.indexes);
  }
  const file = join(mkdtempSync(join(tmpdir(), 'sbfb-')), 'firebase.json');
  writeFileSync(file, JSON.stringify(base, null, 2));
  return file;
}

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}
function token(uid, role) {
  const header = b64url({ alg: 'none', typ: 'JWT' });
  const payload = b64url({ user_id: uid, role, sub: uid });
  return `${header}.${payload}.`;
}

const MEMBER = token('member1', 'user');
const ADMIN = token('admin1', 'admin');
const SUPER = token('super1', 'super_admin');

async function req(method, path, tok, body) {
  const res = await fetch(`${HOST}/v1/projects/${PROJ}/databases/(default)/documents/${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.status;
}

const field = (v) => ({ stringValue: String(v) });
const doc = (fields) => ({ fields });

// Firestore REST document fields must be typed values.
const dealDoc = (over = {}) => ({
  receiverUid: field('member1'),
  giverCompanyName: field('Acme'),
  receiverCompanyName: field('Member One'),
  amount: field('500000'),
  amountValue: { doubleValue: 500000 },
  status: field('pending'),
  submittedByRole: field('member'),
  createdAt: { doubleValue: Date.now() },
  ...over,
});

const results = [];
function check(name, actual, expected) {
  const pass = actual === expected;
  results.push({ name, actual, expected, pass });
}

async function run() {
  // --- deals: create ---
  // Member submitting their own pending revenue -> allowed
  check('member creates own pending deal',
    await req('POST', 'deals', MEMBER, doc(dealDoc())), 200);

  // Member forging an approved entry -> denied (this is the whole point)
  check('member cannot self-approve a deal',
    await req('POST', 'deals', MEMBER, doc(dealDoc({ status: field('approved') }))), 403);

  // Member attributing revenue to someone else -> denied
  check('member cannot file revenue for another member',
    await req('POST', 'deals', MEMBER, doc(dealDoc({ receiverUid: field('victim') }))), 403);

  // Admin may record revenue directly, already approved
  check('admin creates approved deal',
    await req('POST', 'deals', ADMIN, doc(dealDoc({ receiverUid: field('member1'), status: field('approved'), submittedByRole: field('admin') }))), 200);

  // --- deals: update/delete ---
  check('member cannot update a deal', await req('PATCH', 'deals/x', MEMBER, doc({ status: field('approved') })), 403);
  check('member cannot delete a deal', await req('DELETE', 'deals/x', MEMBER), 403);
  check('super admin can update a deal', await req('PATCH', 'deals/x', SUPER, doc({ status: field('approved') })), 200);

  // --- stats ---
  check('member cannot overwrite revenue total',
    await req('PATCH', 'stats/deals', MEMBER, doc({ totalValue: { doubleValue: 999999999 } })), 403);
  check('member cannot overwrite referral total',
    await req('PATCH', 'stats/referralRevenue', MEMBER, doc({ totalValue: { doubleValue: 999999999 } })), 403);
  check('member can update online count',
    await req('PATCH', 'stats/online', MEMBER, doc({ count: { doubleValue: 1 } })), 200);
  check('super admin can set revenue total',
    await req('PATCH', 'stats/deals', SUPER, doc({ totalValue: { doubleValue: 500000 } })), 200);

  // --- read access still intact ---
  check('member can read deals', await req('GET', 'deals/x', MEMBER), 200);
  check('member can read stats', await req('GET', 'stats/deals', MEMBER), 200);
}

const proc = spawn(
  'npx',
  ['firebase-tools', 'emulators:start', '--only', 'firestore', `--project=${PROJ}`,
   '--config', emulatorConfigPath(PORT)],
  { stdio: 'ignore', detached: true },
);

try {
  for (let i = 0; i < 60; i++) {
    try { await fetch(`${HOST}/`); break; } catch { await sleep(1000); }
  }
  await run();
} finally {
  try { process.kill(-proc.pid); } catch { /* already gone */ }
}

let failed = 0;
for (const r of results) {
  if (!r.pass) failed++;
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}  (got ${r.actual}, expected ${r.expected})`);
}
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);