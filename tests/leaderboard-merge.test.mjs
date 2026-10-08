/**
 * Business Leaderboard row merging.
 *
 * The leaderboard used to be grouped by *giver*, so a company that won three
 * deals appeared on three separate rows. It is now grouped by receiving company:
 * one row per receiver, wins and value summed, clients collapsed into a single
 * cell led by the most recent one.
 *
 * Run: node tests/leaderboard-merge.test.mjs
 */
import assert from 'node:assert';

function dealValue(d) {
  if (typeof d.amountValue === 'number' && Number.isFinite(d.amountValue)) return d.amountValue;
  return parseFloat(String(d.amount || '0').replace(/[^0-9.]/g, '')) || 0;
}

function rowKey(d) {
  const name = (d.receiverCompanyName || '').trim();
  return name ? `co:${name.toLowerCase()}` : `uid:${d.receiverUid}`;
}

function reorderGiversByRecency(givers, deals, rowKeyValue) {
  const latestFor = new Map();
  for (const d of deals) {
    if (rowKey(d) !== rowKeyValue) continue;
    const giver = (d.giverCompanyName || '').trim();
    if (!giver) continue;
    latestFor.set(giver, Math.max(latestFor.get(giver) || 0, d.createdAt || 0));
  }
  return [...givers].sort((a, b) => (latestFor.get(b) || 0) - (latestFor.get(a) || 0));
}

function buildBusinessLeaderboard(deals) {
  const rows = new Map();
  for (const deal of deals) {
    const key = rowKey(deal);
    let row = rows.get(key);
    if (!row) {
      row = {
        key,
        receiverUid: deal.receiverUid,
        receiverCompany: deal.receiverCompanyName,
        receiverUids: [],
        totalValue: 0, dealCount: 0, givers: [], lastActivityAt: 0,
      };
      rows.set(key, row);
    }
    row.totalValue += dealValue(deal);
    row.dealCount += 1;
    if ((deal.createdAt || 0) >= row.lastActivityAt) {
      row.lastActivityAt = deal.createdAt || 0;
      row.receiverUid = deal.receiverUid;
    }
    if (deal.receiverUid && !row.receiverUids.includes(deal.receiverUid)) {
      row.receiverUids.push(deal.receiverUid);
    }
    const giver = (deal.giverCompanyName || '').trim();
    if (giver && !row.givers.includes(giver)) row.givers.push(giver);
  }
  for (const row of rows.values()) {
    row.givers = reorderGiversByRecency(row.givers, deals, row.key);
  }
  return Array.from(rows.values()).sort(
    (a, b) => b.totalValue - a.totalValue || b.lastActivityAt - a.lastActivityAt,
  );
}

const deal = (o) => ({
  id: o.id || Math.random().toString(36).slice(2),
  receiverUid: o.receiverUid ?? 'r1',
  receiverCompanyName: o.receiverCompanyName ?? 'Acme',
  giverCompanyName: o.giverCompanyName ?? 'Client',
  amount: o.amount ?? '₹1',
  amountValue: o.amountValue,
  createdAt: o.createdAt ?? 1,
});

let pass = 0;
const t = (name, fn) => {
  try { fn(); console.log(`PASS  ${name}`); pass++; }
  catch (e) { console.log(`FAIL  ${name}  -> ${e.message}`); process.exitCode = 1; }
};

t('three deals to one company merge into a single row', () => {
  const rows = buildBusinessLeaderboard([
    deal({ id: 'a', receiverUid: 'r1', receiverCompanyName: 'FloLogix', giverCompanyName: 'Client A', amountValue: 30000, createdAt: 3 }),
    deal({ id: 'b', receiverUid: 'r1', receiverCompanyName: 'FloLogix', giverCompanyName: 'Client B', amountValue: 40000, createdAt: 2 }),
    deal({ id: 'c', receiverUid: 'r1', receiverCompanyName: 'FloLogix', giverCompanyName: 'Client C', amountValue: 10000, createdAt: 1 }),
  ]);
  assert.strictEqual(rows.length, 1, 'must collapse to one row');
  assert.strictEqual(rows[0].dealCount, 3, 'Deals Won must be summed');
  assert.strictEqual(rows[0].totalValue, 80000, 'Deal Value must be summed');
});

t('different receiving companies stay on separate rows', () => {
  const rows = buildBusinessLeaderboard([
    deal({ receiverUid: 'r1', receiverCompanyName: 'FloLogix', amountValue: 40000 }),
    deal({ receiverUid: 'r2', receiverCompanyName: 'Sriram', amountValue: 240000 }),
  ]);
  assert.strictEqual(rows.length, 2);
});

t('rows rank by total value, highest first', () => {
  const rows = buildBusinessLeaderboard([
    deal({ receiverUid: 'r1', receiverCompanyName: 'Small', amountValue: 30000 }),
    deal({ receiverUid: 'r2', receiverCompanyName: 'Large', amountValue: 240000 }),
    deal({ receiverUid: 'r3', receiverCompanyName: 'Mid', amountValue: 46000 }),
  ]);
  assert.deepStrictEqual(rows.map((r) => r.receiverCompany), ['Large', 'Mid', 'Small']);
});

t('latest client leads the Given By cell', () => {
  const rows = buildBusinessLeaderboard([
    deal({ id: 'old', receiverUid: 'r1', receiverCompanyName: 'FloLogix', giverCompanyName: 'Smart Irrigation', amountValue: 40000, createdAt: 100 }),
    deal({ id: 'new', receiverUid: 'r1', receiverCompanyName: 'FloLogix', giverCompanyName: 'VIJAYA SURVEYORS', amountValue: 46000, createdAt: 300 }),
  ]);
  assert.strictEqual(rows[0].givers[0], 'VIJAYA SURVEYORS', 'most recent client must lead');
  assert.strictEqual(rows[0].givers[1], 'Smart Irrigation', 'older client is secondary');
});

t('the secondary client is available for the lighter sub-line', () => {
  const rows = buildBusinessLeaderboard([
    deal({ receiverUid: 'r1', giverCompanyName: 'A', createdAt: 1 }),
    deal({ receiverUid: 'r1', giverCompanyName: 'B', createdAt: 2 }),
  ]);
  assert.ok(rows[0].givers.length >= 2, 'needs at least a primary and a secondary');
  const extra = rows[0].givers.length - 2;
  assert.strictEqual(extra, 0);
});

t('three or more clients collapse to primary + secondary + count', () => {
  const rows = buildBusinessLeaderboard([
    deal({ receiverUid: 'r1', giverCompanyName: 'A', createdAt: 1 }),
    deal({ receiverUid: 'r1', giverCompanyName: 'B', createdAt: 2 }),
    deal({ receiverUid: 'r1', giverCompanyName: 'C', createdAt: 3 }),
    deal({ receiverUid: 'r1', giverCompanyName: 'D', createdAt: 4 }),
  ]);
  assert.strictEqual(rows[0].givers[0], 'D');
  assert.strictEqual(rows[0].givers[1], 'C');
  assert.strictEqual(rows[0].givers.length - 2, 2, 'remaining clients reported as "+2 more"');
  assert.strictEqual(rows[0].dealCount, 4, 'all four still counted as wins');
});

t('a repeated client is listed once but still counted as a deal', () => {
  const rows = buildBusinessLeaderboard([
    deal({ id: 'a', receiverUid: 'r1', giverCompanyName: 'Client A', amountValue: 10000, createdAt: 1 }),
    deal({ id: 'b', receiverUid: 'r1', giverCompanyName: 'Client A', amountValue: 20000, createdAt: 2 }),
  ]);
  assert.strictEqual(rows[0].dealCount, 2, 'two deals from one client');
  assert.strictEqual(rows[0].givers.length, 1, 'but only one client shown');
  assert.strictEqual(rows[0].totalValue, 30000);
});

t('deals from one company total more than any single company', () => {
  const rows = buildBusinessLeaderboard([
    deal({ receiverUid: 'r1', receiverCompanyName: 'FloLogix', amountValue: 30000 }),
    deal({ receiverUid: 'r1', receiverCompanyName: 'FloLogix', amountValue: 40000 }),
    deal({ receiverUid: 'r2', receiverCompanyName: 'Sriram', amountValue: 60000 }),
  ]);
  const flo = rows.find((r) => r.receiverCompany === 'FloLogix');
  assert.strictEqual(flo.totalValue, 70000);
  assert.strictEqual(rows[0].receiverCompany, 'FloLogix', 'merged total outranks the single 60k deal');
});

t('empty input yields no rows', () => {
  assert.deepStrictEqual(buildBusinessLeaderboard([]), []);
});

t('receiver without a uid falls back to company name', () => {
  const rows = buildBusinessLeaderboard([
    deal({ receiverUid: '', receiverCompanyName: 'External Co', amountValue: 1000 }),
    deal({ receiverUid: '', receiverCompanyName: 'External Co', amountValue: 2000 }),
  ]);
  assert.strictEqual(rows.length, 1, 'external receivers still merge by name');
  assert.strictEqual(rows[0].totalValue, 3000);
});

// ── The case that caused the split: one company, two accounts ──
t('the same company on two different uids merges into one row', () => {
  const rows = buildBusinessLeaderboard([
    deal({ receiverUid: 'acctA', receiverCompanyName: 'FloLogixAutomations', giverCompanyName: 'Sri Divya', amountValue: 30000, createdAt: 2 }),
    deal({ receiverUid: 'acctB', receiverCompanyName: 'FloLogixAutomations', giverCompanyName: 'Smart Irrigation', amountValue: 40000, createdAt: 3 }),
  ]);
  assert.strictEqual(rows.length, 1, 'duplicate signups must not split the company');
  assert.strictEqual(rows[0].dealCount, 2);
  assert.strictEqual(rows[0].totalValue, 70000);
});

t('a merged row reports both underlying account uids', () => {
  const rows = buildBusinessLeaderboard([
    deal({ receiverUid: 'acctA', receiverCompanyName: 'FloLogix', amountValue: 1000 }),
    deal({ receiverUid: 'acctB', receiverCompanyName: 'FloLogix', amountValue: 2000 }),
  ]);
  assert.strictEqual(rows[0].receiverUids.length, 2);
  assert.deepStrictEqual(rows[0].receiverUids.sort(), ['acctA', 'acctB']);
});

t('company-name matching ignores case', () => {
  const rows = buildBusinessLeaderboard([
    deal({ receiverUid: 'acctA', receiverCompanyName: 'FloLogix', amountValue: 1000 }),
    deal({ receiverUid: 'acctB', receiverCompanyName: 'flologix', amountValue: 2000 }),
  ]);
  assert.strictEqual(rows.length, 1);
});

t('the most recent deal decides which account uid is reported', () => {
  const rows = buildBusinessLeaderboard([
    deal({ receiverUid: 'acctA', receiverCompanyName: 'FloLogix', createdAt: 10 }),
    deal({ receiverUid: 'acctB', receiverCompanyName: 'FloLogix', createdAt: 99 }),
  ]);
  assert.strictEqual(rows[0].receiverUid, 'acctB');
});

t('falls back to parsing the amount string when amountValue is absent', () => {
  const rows = buildBusinessLeaderboard([
    deal({ receiverUid: 'r1', amount: '₹2,40,000' }),
  ]);
  assert.strictEqual(rows[0].totalValue, 240000);
});

t('lastActivityAt reflects the most recent deal', () => {
  const rows = buildBusinessLeaderboard([
    deal({ receiverUid: 'r1', createdAt: 100 }),
    deal({ receiverUid: 'r1', createdAt: 900 }),
  ]);
  assert.strictEqual(rows[0].lastActivityAt, 900);
});

t('ties break by most recent activity', () => {
  const rows = buildBusinessLeaderboard([
    deal({ receiverUid: 'r1', receiverCompanyName: 'Older', amountValue: 5000, createdAt: 10 }),
    deal({ receiverUid: 'r2', receiverCompanyName: 'Newer', amountValue: 5000, createdAt: 99 }),
  ]);
  assert.strictEqual(rows[0].receiverCompany, 'Newer');
});

console.log(`\n${pass} passed`);