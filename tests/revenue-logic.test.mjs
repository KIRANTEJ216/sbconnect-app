/**
 * Guards the legacy-data contract: deal documents written before the approval
 * workflow existed carry neither `status` nor `source`. Those must still count as
 * approved plain deals, or every historical total would silently drop to zero.
 */
import assert from 'node:assert';

const isReferralDeal = (d) => d.source === 'referral';
const isApprovedDeal = (d) => d.status === undefined || d.status === 'approved';
const isPendingDeal = (d) => d.status === 'pending';
const countsTowardDealsTotal = (d) => !isReferralDeal(d) && isApprovedDeal(d);
const countsTowardReferralTotal = (d) => isReferralDeal(d) && isApprovedDeal(d);
const dealAmountValue = (d) =>
  (typeof d.amountValue === 'number' && Number.isFinite(d.amountValue)
    ? d.amountValue
    : parseFloat(String(d.amount || '0').replace(/[^0-9.]/g, ''))) || 0;

function parseAmount(input) {
  if (typeof input === 'number') return Number.isFinite(input) ? input : 0;
  const cleaned = String(input).trim().replace(/,/g, '').replace(/[₹$€£\s]/g, '');
  // Longest alternatives first, or "crore" would match "cr" and leave "ore" behind.
  const match = cleaned.match(/^(-?\d*\.?\d+)\s*(lakh|lac|crore|l|cr|k)?/i);
  if (!match) return 0;
  const base = parseFloat(match[1]);
  if (!Number.isFinite(base)) return 0;
  const suffix = (match[2] || '').toLowerCase();
  const multiplier = suffix === 'k' ? 1e3
    : suffix === 'lakh' || suffix === 'lac' || suffix === 'l' ? 1e5
      : suffix === 'cr' || suffix === 'crore' ? 1e7
        : 1;
  return Math.round(base * multiplier * 100) / 100;
}

let pass = 0;
const t = (name, fn) => {
  try { fn(); console.log(`PASS  ${name}`); pass++; }
  catch (e) { console.log(`FAIL  ${name}  -> ${e.message}`); process.exitCode = 1; }
};

// --- Legacy documents ---
t('legacy deal (no status/source) counts toward deals total', () => {
  assert.strictEqual(countsTowardDealsTotal({ amount: '₹1,00,000' }), true);
});
t('legacy deal is approved, not pending', () => {
  assert.strictEqual(isApprovedDeal({ amount: '₹1' }), true);
  assert.strictEqual(isPendingDeal({ amount: '₹1' }), false);
});
t('legacy deal does not count as referral revenue', () => {
  assert.strictEqual(countsTowardReferralTotal({ amount: '₹1,00,000' }), false);
});
t('legacy formatted amount still parses', () => {
  assert.strictEqual(dealAmountValue({ amount: '₹1,00,000' }), 100000);
});

// --- Approval gating ---
t('member-pending deal does not count', () => {
  assert.strictEqual(countsTowardDealsTotal({ source: 'deal', status: 'pending', amountValue: 500 }), false);
});
t('rejected deal does not count', () => {
  assert.strictEqual(countsTowardDealsTotal({ source: 'deal', status: 'rejected', amountValue: 500 }), false);
});
t('approved deal counts', () => {
  assert.strictEqual(countsTowardDealsTotal({ source: 'deal', status: 'approved', amountValue: 500 }), true);
});
t('approved referral never counts toward deals total', () => {
  assert.strictEqual(countsTowardDealsTotal({ source: 'referral', status: 'approved', amountValue: 500 }), false);
});
t('approved referral counts toward referral total', () => {
  assert.strictEqual(countsTowardReferralTotal({ source: 'referral', status: 'approved', amountValue: 500 }), true);
});
t('pending referral counts toward neither total', () => {
  assert.strictEqual(countsTowardReferralTotal({ source: 'referral', status: 'pending', amountValue: 500 }), false);
  assert.strictEqual(countsTowardDealsTotal({ source: 'referral', status: 'pending', amountValue: 500 }), false);
});

// --- amountValue precedence ---
t('amountValue wins over the display string', () => {
  assert.strictEqual(dealAmountValue({ amount: '₹1,00,000', amountValue: 250000 }), 250000);
});
t('missing amountValue falls back to parsing', () => {
  assert.strictEqual(dealAmountValue({ amount: '₹50,000' }), 50000);
});
t('unparseable amount yields 0, never NaN', () => {
  assert.strictEqual(dealAmountValue({ amount: '' }), 0);
  assert.strictEqual(dealAmountValue({ amount: 'abc' }), 0);
});

// --- Indian shorthand parsing ---
t('parses lakh/crore/k shorthand', () => {
  assert.strictEqual(parseAmount('1.5L'), 150000);
  assert.strictEqual(parseAmount('2cr'), 20000000);
  assert.strictEqual(parseAmount('50k'), 50000);
  assert.strictEqual(parseAmount('1 lakh'), 100000);
  assert.strictEqual(parseAmount('1.5 crore'), 15000000);
});
t('strips currency symbols and separators', () => {
  assert.strictEqual(parseAmount('₹1,00,000'), 100000);
  assert.strictEqual(parseAmount('  250000  '), 250000);
});
t('rejects junk and non-positive shorthand', () => {
  assert.strictEqual(parseAmount('abc'), 0);
  assert.strictEqual(parseAmount(''), 0);
});

// ─── Headline composition: no double-counting across the approval transition ───
// Dashboard/TopBar headline = stats/deals.totalValue (verified deals, admin-written)
//                          + stats/referralRevenue.totalValue (verified referrals)
//                          + derived pending (member submissions awaiting review)
const headline = (verifiedDeals, verifiedReferrals, pending) =>
  verifiedDeals + verifiedReferrals + pending;

function derivePending(deals) {
  let pendingDeals = 0, pendingReferrals = 0;
  for (const d of deals) {
    if (!isPendingDeal(d)) continue;
    const v = dealAmountValue(d);
    if (isReferralDeal(d)) pendingReferrals += v; else pendingDeals += v;
  }
  return { pendingDeals, pendingReferrals, total: pendingDeals + pendingReferrals };
}

t('member submission lands in the headline immediately', () => {
  const p = derivePending([{ source: 'deal', status: 'pending', amountValue: 100000 }]);
  assert.strictEqual(headline(0, 0, p.total), 100000);
});

t('approving a pending deal moves value, never duplicates it', () => {
  const pendingDoc = { source: 'deal', status: 'pending', amountValue: 100000 };
  const before = headline(0, 0, derivePending([pendingDoc]).total);
  // Approve: status flips, cache gains the value, pending no longer sees it.
  const after = headline(100000, 0, derivePending([{ ...pendingDoc, status: 'approved' }]).total);
  assert.strictEqual(after, before);
});

t('rejecting a pending deal removes it from the headline', () => {
  const pendingDoc = { source: 'deal', status: 'pending', amountValue: 100000 };
  const before = headline(0, 0, derivePending([pendingDoc]).total);
  const after = headline(0, 0, derivePending([{ ...pendingDoc, status: 'rejected' }]).total);
  assert.strictEqual(before, 100000);
  assert.strictEqual(after, 0);
});

t('approving a pending referral moves value, never duplicates it', () => {
  const pendingDoc = { source: 'referral', status: 'pending', amountValue: 500000 };
  const before = headline(0, 0, derivePending([pendingDoc]).total);
  const after = headline(0, 500000, derivePending([{ ...pendingDoc, status: 'approved' }]).total);
  assert.strictEqual(after, before);
});

t('an approved referral is never also counted as pending', () => {
  const p = derivePending([{ source: 'referral', status: 'approved', amountValue: 500000 }]);
  assert.strictEqual(p.total, 0);
  assert.strictEqual(headline(0, 500000, p.total), 500000);
});

t('admin-recorded revenue is counted once, via the verified cache', () => {
  const doc = { source: 'referral', status: 'approved', amountValue: 250000 };
  const p = derivePending([doc]);
  assert.strictEqual(p.total, 0);
  assert.strictEqual(headline(0, 250000, p.total), 250000);
});

t('mixed ledger composes correctly', () => {
  const deals = [
    { source: 'deal', status: 'approved', amountValue: 400000 },
    { source: 'deal', status: 'pending', amountValue: 150000 },
    { source: 'referral', status: 'approved', amountValue: 600000 },
    { source: 'referral', status: 'pending', amountValue: 350000 },
    { source: 'deal', status: 'rejected', amountValue: 999000 },
    { amount: '₹1,00,000' }, // legacy: approved plain deal
  ];
  const p = derivePending(deals);
  assert.strictEqual(p.pendingDeals, 150000);
  assert.strictEqual(p.pendingReferrals, 350000);
  // verified deals 400k + legacy 100k; verified referrals 600k; pending 500k
  assert.strictEqual(headline(500000, 600000, p.total), 1600000);
});

// ─── Regression: the real drift that hid ₹240,000 from the dashboard ───
// Production ledger held three approved legacy deals totalling ₹310,000 while
// stats/deals.totalValue had drifted to ₹70,000. Because the old getter trusted
// the cache whenever the doc existed, the dashboard under-reported by ₹240,000
// permanently. The headline must derive from the ledger, never the cache.
const productionLedger = [
  { amount: '₹30,000' },                                   // FloLogix ← Sri Divya
  { amount: '₹2,40,000' },                                 // Sriram Wealth Creations ← Niva Corp
  { amount: '₹40,000' },                                   // FloLogix ← Smart Irrigation
];
const STALE_CACHE = 70000;

t('sum of the production ledger is the full ₹310,000', () => {
  let total = 0;
  for (const d of productionLedger) total += dealAmountValue(d);
  assert.strictEqual(total, 310000);
});

t('the stale ₹70,000 cache would have hidden exactly ₹240,000', () => {
  let ledger = 0;
  for (const d of productionLedger) ledger += dealAmountValue(d);
  assert.strictEqual(ledger - STALE_CACHE, 240000);
});

t('every legacy approved deal contributes regardless of cache state', () => {
  // The gate that decides inclusion: source absent => deal, status absent => approved.
  for (const d of productionLedger) {
    assert.strictEqual(isReferralDeal(d), false);
    assert.strictEqual(isApprovedDeal(d), true);
    assert.strictEqual(countsTowardDealsTotal(d), true);
    assert.ok(dealAmountValue(d) > 0);
  }
});

t('headline counts all three production deals, none dropped', () => {
  let verifiedDeals = 0;
  for (const d of productionLedger) if (countsTowardDealsTotal(d)) verifiedDeals += dealAmountValue(d);
  assert.strictEqual(verifiedDeals, 310000);
  assert.notStrictEqual(verifiedDeals, STALE_CACHE);
});

// ─── Regression: the Business Leaderboard went blank ────────────────────────
// The Dashboard gated the leaderboard table on
//   allDeals.length !== leaderboardDeals.length
// so a single pending submission (or any referral claim) hid every verified
// deal behind "No verified deals yet." The board must render whenever at least
// one verified deal exists; only a genuinely empty verified set shows the
// empty state.
const boardRows = (allDeals) => allDeals.filter(countsTowardDealsTotal);

const leaderboardShowsTable = (allDeals) => boardRows(allDeals).length > 0;

const threeVerified = [
  { amount: '₹30,000' },
  { amount: '₹2,40,000' },
  { amount: '₹40,000' },
];

t('the production ledger renders the leaderboard', () => {
  assert.strictEqual(leaderboardShowsTable(threeVerified), true);
  assert.strictEqual(boardRows(threeVerified).length, 3);
});

t('one pending submission does NOT blank the leaderboard', () => {
  const withPending = [...threeVerified, { source: 'deal', status: 'pending', amountValue: 500000 }];
  assert.strictEqual(boardRows(withPending).length, 3);
  assert.strictEqual(leaderboardShowsTable(withPending), true, 'board must still render');
});

t('a pending referral claim does NOT blank the leaderboard', () => {
  const withRef = [...threeVerified, { source: 'referral', status: 'pending', amountValue: 900000 }];
  assert.strictEqual(leaderboardShowsTable(withRef), true);
});

t('several pending entries do NOT blank the leaderboard', () => {
  const many = [
    ...threeVerified,
    { status: 'pending', amountValue: 1 },
    { status: 'pending', amountValue: 2 },
    { status: 'rejected', amountValue: 3 },
    { source: 'referral', status: 'approved', amountValue: 4 },
  ];
  assert.strictEqual(boardRows(many).length, 3);
  assert.strictEqual(leaderboardShowsTable(many), true);
});

t('empty state only when there are genuinely no verified deals', () => {
  assert.strictEqual(leaderboardShowsTable([]), false);
  assert.strictEqual(leaderboardShowsTable([{ status: 'pending', amountValue: 100 }]), false);
  assert.strictEqual(leaderboardShowsTable([{ status: 'rejected', amountValue: 100 }]), false);
});

t('excluded-entry count is non-zero exactly when rows were withheld', () => {
  const all = [...threeVerified, { status: 'pending', amountValue: 1 }];
  assert.strictEqual(all.length - boardRows(all).length, 1);
  assert.strictEqual(threeVerified.length - boardRows(threeVerified).length, 0);
});

// ─── Regression: a plain deal misfiled through the referral form ──────────────
// An admin recorded iconpix <- VIJAYA (₹46,000) via the referral-only form, so
// it was stored as source:'referral'. That put it in the Referrals bucket, kept
// it off the Business Leaderboard, and credited a referrer for a straight deal.
// Reclassifying to source:'deal' must move it to Deals and onto the board.
const MISFILED = {
  amount: '₹46,000',
  receiverCompanyName: 'iconpix pvt lts',
  giverCompanyName: 'VIJAYA SURVEYORS',
  source: 'referral',
  status: 'approved',
  referrerUid: 'r1',
  referrerName: 'MADHU PRASHANTH GUTTULA',
};

const reclassified = { ...MISFILED, source: 'deal', referrerUid: undefined, referrerName: undefined };

t('misfiled referral does not count toward the deals total', () => {
  assert.strictEqual(countsTowardDealsTotal(MISFILED), false);
  assert.strictEqual(countsTowardReferralTotal(MISFILED), true);
});

t('reclassifying moves the amount from Referrals to Deals', () => {
  assert.strictEqual(countsTowardReferralTotal(MISFILED), true);
  assert.strictEqual(countsTowardReferralTotal(reclassified), false);
  assert.strictEqual(countsTowardDealsTotal(reclassified), true);
});

t('the amount is unchanged by reclassification — only the bucket moves', () => {
  assert.strictEqual(dealAmountValue(MISFILED), 46000);
  assert.strictEqual(dealAmountValue(reclassified), 46000);
});

t('headline total is invariant to the misclassification', () => {
  const others = [{ amount: '₹30,000' }, { amount: '₹2,40,000' }, { amount: '₹40,000' }];
  const sum = (list) => {
    let deals = 0, referrals = 0;
    for (const d of list) {
      if (countsTowardDealsTotal(d)) deals += dealAmountValue(d);
      else if (countsTowardReferralTotal(d)) referrals += dealAmountValue(d);
    }
    return { deals, referrals, headline: deals + referrals };
  };
  const before = sum([...others, MISFILED]);
  const after = sum([...others, reclassified]);
  assert.strictEqual(before.headline, 356000);
  assert.strictEqual(after.headline, 356000);
  // The whole point: the split corrects, the headline does not drift.
  assert.strictEqual(before.deals, 310000);
  assert.strictEqual(after.deals, 356000);
  assert.strictEqual(before.referrals, 46000);
  assert.strictEqual(after.referrals, 0);
});

t('a reclassified deal appears on the Business Leaderboard', () => {
  const board = [MISFILED, reclassified].filter(countsTowardDealsTotal);
  assert.strictEqual(board.length, 1);
  assert.strictEqual(board[0].giverCompanyName, 'VIJAYA SURVEYORS');
});

t('an admin-recorded deal is already a plain deal, no reclassification needed', () => {
  const adminDeal = {
    amount: '₹46,000', giverCompanyName: 'VIJAYA', receiverCompanyName: 'iconpix',
    source: 'deal', status: 'approved', submittedByRole: 'admin',
  };
  assert.strictEqual(countsTowardDealsTotal(adminDeal), true);
  assert.strictEqual(countsTowardReferralTotal(adminDeal), false);
});

console.log(`\n${pass} passed`);