/**
 * Ledger-fidelity check: seeds the Firestore emulator with the exact production
 * documents behind the missing ₹240,000 and proves the dashboard figure comes
 * from the ledger, not the stale `stats/deals` cache.
 *
 * Why emulator rather than pure-JS: the risk is that Firestore returns legacy
 * documents differently than a unit test's object literals — `status`/`source`
 * absent rather than null, `amount` as an Indian-formatted string. Reading the
 * real documents back closes that gap.
 *
 * Writes/reads use the emulator's owner credential because firestore.rules
 * correctly rejects unauthenticated access — which is itself part of what these
 * rules are for.
 *
 * Run: node tests/ledger-fidelity.mjs
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';

const HOST = '127.0.0.1';
// Overridable because 8080 is a common dev-server port. When another process
// already holds it the emulator fails to bind, the readiness probe below then
// succeeds against the *wrong* server, and the suite dies parsing that server's
// HTML as JSON. Set SB_EMULATOR_PORT to run alongside another dev server.
const PORT = Number(process.env.SB_EMULATOR_PORT || 8080);
const BASE = `http://${HOST}:${PORT}/v1/projects/demo-sbconnect/databases/(default)/documents`;
const OWNER = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };

// ── Gate functions, copied verbatim from src/lib/firestore.ts ──
const isReferralDeal = (d) => d.source === 'referral';
const isApprovedDeal = (d) => d.status === undefined || d.status === 'approved';
const isPendingDeal = (d) => d.status === 'pending';
const dealAmountValue = (d) =>
  (typeof d.amountValue === 'number' && Number.isFinite(d.amountValue)
    ? d.amountValue
    : parseFloat(String(d.amount || '0').replace(/[^0-9.]/g, ''))) || 0;

// Mirrors getRevenueSummary()
function summarize(docs) {
  const s = {
    verifiedDeals: 0, verifiedDealsCount: 0,
    verifiedReferrals: 0, verifiedReferralsCount: 0,
    pendingDeals: 0, pendingDealsCount: 0,
    pendingReferrals: 0, pendingReferralsCount: 0,
  };
  for (const d of docs) {
    const value = dealAmountValue(d);
    const referral = isReferralDeal(d);
    if (isPendingDeal(d)) {
      if (referral) { s.pendingReferrals += value; s.pendingReferralsCount++; }
      else { s.pendingDeals += value; s.pendingDealsCount++; }
    } else if (!isApprovedDeal(d)) { /* rejected — counted nowhere */ }
    else if (referral) { s.verifiedReferrals += value; s.verifiedReferralsCount++; }
    else { s.verifiedDeals += value; s.verifiedDealsCount++; }
  }
  s.headline = s.verifiedDeals + s.verifiedReferrals + s.pendingDeals + s.pendingReferrals;
  return s;
}

/** Firestore REST wire format -> plain JS object, omitting absent fields. */
function decode(res) {
  const out = {};
  for (const [k, v] of Object.entries(res.fields || {})) {
    out[k] = 'stringValue' in v ? v.stringValue
      : 'integerValue' in v ? Number(v.integerValue)
        : 'doubleValue' in v ? v.doubleValue
          : 'booleanValue' in v ? v.booleanValue
            : 'nullValue' in v ? null
              : v;
  }
  return out;
}

const s = (v) => ({ stringValue: v });
const n = (v) => ({ integerValue: String(v) });

async function addDeal(fields) {
  const res = await fetch(`${BASE}/deals`, {
    method: 'POST', headers: OWNER,
    body: JSON.stringify({ fields }),
  });
  return (await res.json()).name.split('/').pop();
}

async function listDeals() {
  const res = await fetch(`${BASE}/deals?pageSize=300`, { headers: OWNER });
  const j = await res.json();
  return (j.documents || []).map((d) => decode(d));
}

async function patchDeal(id, fields) {
  const mask = Object.keys(fields).map((k) => `updateMask.fieldPaths=${k}`).join('&');
  await fetch(`${BASE}/deals/${id}?${mask}`, {
    method: 'PATCH', headers: OWNER, body: JSON.stringify({ fields }),
  });
}


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

const proc = spawn(
  'npx',
  [
    'firebase-tools', 'emulators:start', '--only', 'firestore',
    '--project=demo-sbconnect',
    '--config', emulatorConfigPath(PORT),
  ],
  { stdio: 'ignore', detached: true },
);

let pass = 0;
const t = (name, fn) => {
  try { fn(); console.log(`PASS  ${name}`); pass++; }
  catch (e) { console.log(`FAIL  ${name}  -> ${e.message}`); process.exitCode = 1; }
};

try {
  for (let i = 0; i < 60; i++) {
    try { await fetch(`http://${HOST}:${PORT}/`); break; } catch { await sleep(1000); }
  }

  // The three production deals, verbatim. Legacy shape: no status, no source,
  // no amountValue, amount stored as an Indian-formatted string.
  const now = Date.now();
  await addDeal({ receiverCompanyName: s('FloLogixAutomations'), giverCompanyName: s('Sri Divya Enterprises'), amount: s('₹30,000'), createdAt: n(now - 86400000) });
  await addDeal({ receiverCompanyName: s('Sriram Wealth Creations'), giverCompanyName: s('Niva Corp LLP'), amount: s('₹2,40,000'), createdAt: n(now - 2 * 86400000) });
  await addDeal({ receiverCompanyName: s('FloLogixAutomations'), giverCompanyName: s('Smart Irrigation Design & Consulting'), amount: s('₹40,000'), createdAt: n(now - 30 * 86400000) });

  // The stale cache that caused the bug.
  await fetch(`${BASE}/stats/deals`, {
    method: 'PATCH', headers: OWNER,
    body: JSON.stringify({ fields: { totalValue: n(70000), updatedAt: n(now) } }),
  });

  let docs = await listDeals();
  let summary = summarize(docs);

  t('emulator returns all three production deals', () => assert.strictEqual(docs.length, 3));

  t('legacy docs read back with status/source absent, not null', () => {
    for (const d of docs) {
      assert.ok(!('status' in d), 'status should be absent');
      assert.ok(!('source' in d), 'source should be absent');
      assert.strictEqual(d.status, undefined);
    }
  });

  t('Indian-formatted amount strings parse correctly', () => {
    assert.strictEqual(dealAmountValue(docs.find((d) => d.receiverCompanyName === 'Sriram Wealth Creations')), 240000);
    assert.strictEqual(dealAmountValue(docs.find((d) => d.amount === '₹30,000')), 30000);
    assert.strictEqual(dealAmountValue(docs.find((d) => d.amount === '₹40,000')), 40000);
  });

  t('verified deals total the full Rs 310,000 from the ledger', () => {
    assert.strictEqual(summary.verifiedDeals, 310000);
    assert.strictEqual(summary.verifiedDealsCount, 3);
  });

  t('headline matches the ledger, not the stale Rs 70,000 cache', () => {
    assert.strictEqual(summary.headline, 310000);
    assert.notStrictEqual(summary.headline, 70000);
  });

  t('nothing is pending initially', () => {
    assert.strictEqual(summary.pendingDeals, 0);
    assert.strictEqual(summary.pendingReferrals, 0);
  });

  // A pending member submission must move the headline immediately...
  const pendingId = await addDeal({
    receiverCompanyName: s('Sriram Wealth Creations'), giverCompanyName: s('Some Referrer'),
    amount: s('₹50,000'), amountValue: n(50000), source: s('referral'), status: s('pending'),
    referrerUid: s('r1'), referrerName: s('Some Referrer'), referredMemberUid: s('s1'),
    createdAt: n(now),
  });
  summary = summarize(await listDeals());
  t('pending referral is included in the headline immediately', () => {
    assert.strictEqual(summary.pendingReferrals, 50000);
    assert.strictEqual(summary.headline, 360000);
  });

  // ...and approving must move it, not duplicate it.
  await patchDeal(pendingId, { status: s('approved') });
  summary = summarize(await listDeals());
  t('approving moves the value without double-counting', () => {
    assert.strictEqual(summary.pendingReferrals, 0);
    assert.strictEqual(summary.verifiedReferrals, 50000);
    assert.strictEqual(summary.headline, 360000);
  });

  // Rejecting must remove it entirely.
  await patchDeal(pendingId, { status: s('rejected') });
  summary = summarize(await listDeals());
  t('rejecting removes the value from the headline', () => {
    assert.strictEqual(summary.headline, 310000);
  });
} finally {
  try { process.kill(-proc.pid); } catch { /* already gone */ }
}

console.log(`\n${pass} passed`);