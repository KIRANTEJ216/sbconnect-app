import * as functions from 'firebase-functions/v2';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';

/**
 * Materialized revenue aggregates.
 *
 * WHY THIS EXISTS
 * ---------------
 * `deals` is an append-only ledger. The client used to compute every headline
 * figure by reading the ENTIRE collection (`getDocs(collection(db,'deals'))`) —
 * ten call sites, and three to six of those full-collection downloads per page
 * load, repeated by eleven 60s polling timers. That cost grows linearly with
 * lifetime revenue entries and is paid by every member on every visit.
 *
 * This trigger maintains a tiny `revenueStats/{fyKey}` document per financial
 * year so the client can read the headline numbers in ONE document read that
 * never grows. The ledger remains the source of truth; this is a derived cache,
 * exactly like the old `stats/deals` — except it is maintained by a server-side
 * transaction, so it cannot drift the way a client-side increment could.
 *
 * The client falls back to a ledger scan if the aggregate is missing (see
 * `getRevenueSummary` in src/lib/firestore.ts), so this is safe to deploy
 * incrementally: before the function is live, reads still work.
 */

admin.initializeApp();

const db = () => admin.firestore();

/** Mirrors `getFinancialYear()` in src/lib/format.ts — Indian FY, April–March. */
function financialYearKey(when: Date): string {
  const year = when.getFullYear();
  const month = when.getMonth() + 1; // 1-12
  const fyStartYear = month >= 4 ? year : year - 1;
  return `FY${String(fyStartYear).slice(-2)}${String(fyStartYear + 1).slice(-2)}`;
}

/**
 * Which FY bucket a deal belongs to, from its `occurredOn` (falling back to
 * `createdAt`). Deals recorded without a date land in the current FY.
 */
function dealFiscalYear(deal: Record<string, any> | undefined): string | null {
  if (!deal) return null;
  const stamp = typeof deal.occurredOn === 'number' ? deal.occurredOn : deal.createdAt;
  if (typeof stamp !== 'number' || !Number.isFinite(stamp)) return null;
  return financialYearKey(new Date(stamp));
}

/** Must stay in lockstep with isApprovedDeal / isPendingDeal / isReferralDeal. */
function classify(deal: Record<string, any> | undefined) {
  if (!deal) return null;
  // Absent status is legacy-approved; absent source is a legacy plain deal.
  const referral = deal.source === 'referral';
  if (deal.status === 'pending') return referral ? 'pendingReferrals' : 'pendingDeals';
  if (deal.status !== undefined && deal.status !== 'approved') return 'rejected';
  return referral ? 'verifiedReferrals' : 'verifiedDeals';
}

/**
 * Numeric amount, parsed once. Mirrors `dealAmountValue`: prefer the value
 * captured at write time, else parse the formatted amount string.
 */
function amountValue(deal: Record<string, any>): number {
  if (typeof deal.amountValue === 'number' && Number.isFinite(deal.amountValue)) {
    return deal.amountValue;
  }
  if (typeof deal.amount !== 'string') return 0;
  const digits = deal.amount.replace(/[^0-9.-]/g, '');
  const parsed = Number.parseFloat(digits);
  return Number.isFinite(parsed) ? parsed : 0;
}

interface BucketTotals {
  value: number;
  count: number;
}

interface AggregateDoc {
  fy: string;
  verifiedDeals: BucketTotals;
  verifiedReferrals: BucketTotals;
  pendingDeals: BucketTotals;
  pendingReferrals: BucketTotals;
  rejected: BucketTotals;
  totalRaised: number;
  dealCount: number;
  updatedAt: admin.firestore.FieldValue;
  /**
   * Recently applied CloudEvent ids.
   *
   * This trigger runs with `retry: true`, and Eventarc re-delivers the *same*
   * event on failure. Because the logic below applies a delta, replaying an event
   * would subtract-and-add it a second time and silently double-count revenue.
   * Recording the ids inside the same transaction makes the update idempotent:
   * a retry sees its own id and returns without changing any total.
   *
   * Bounded because it only needs to cover the retry window.
   */
  appliedEventIds?: string[];
  /**
   * Wall-clock marker for when this aggregate was last rebuilt. Diagnostic only
   * — correctness comes from the transactional delta plus the nightly reconcile.
   */
  recomputeAfter: admin.firestore.Timestamp | Date;
}

const ZERO: BucketTotals = { value: 0, count: 0 };

/**
 * Append an event id, keeping only the most recent ones.
 *
 * The window only has to outlast Eventarc's retry period; keeping it short avoids
 * unbounded growth on a document that is read on every dashboard load.
 */
const REMEMBERED_EVENT_IDS = 50;

function rememberEvent(previous: string[] | undefined, eventId: string | undefined): string[] {
  const list = previous ?? [];
  if (!eventId) return list.slice(-REMEMBERED_EVENT_IDS);
  return [...list.filter((id) => id !== eventId), eventId].slice(-REMEMBERED_EVENT_IDS);
}

/**
 * Apply one document's before/after delta to the FY aggregate inside a
 * transaction. Recomputes by reading the ledger for that FY when the delta
 * can't be trusted (see `needsFullRecompute`).
 */
async function applyDelta(
  beforeDeal: Record<string, any> | undefined,
  afterDeal: Record<string, any> | undefined,
  eventId?: string,
) {
  const beforeFy = dealFiscalYear(beforeDeal);
  const afterFy = dealFiscalYear(afterDeal);
  const fyKeys = Array.from(new Set([beforeFy, afterFy].filter(Boolean) as string[]));

  for (const fyKey of fyKeys) {
    const ref = db().collection('revenueStats').doc(fyKey);

    await db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);

      // Already folded in by an earlier delivery of this same event.
      if (eventId && snap.data()?.appliedEventIds?.includes(eventId)) {
        functions.logger.info(`revenueStats: event ${eventId} already applied, skipping.`);
        return;
      }

      const current = snap.exists
        ? (snap.data() as unknown as AggregateDoc)
        : {
            fy: fyKey,
            verifiedDeals: { ...ZERO },
            verifiedReferrals: { ...ZERO },
            pendingDeals: { ...ZERO },
            pendingReferrals: { ...ZERO },
            rejected: { ...ZERO },
            totalRaised: 0,
            dealCount: 0,
            appliedEventIds: [],
          };

      // An FY with no aggregate yet is seeded from the ledger, so the very
      // first deal of a financial year produces correct numbers immediately
      // rather than a zeroed document that only fills up on later writes.
      if (!snap.exists) {
        const seeded = await recomputeFromLedger(fyKey);
        tx.set(ref, {
          ...seeded,
          fy: fyKey,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          recomputeAfter: new Date(Date.now() + 5 * 60 * 1000),
          ...(eventId ? { appliedEventIds: [eventId] } : {}),
        });
        return;
      }

      const next = { ...current } as AggregateDoc;

      // Subtract the old document, then add the new one. Both can be in the
      // same FY (an edit) or different FYs (a backdated correction).
      if (beforeDeal && beforeFy === fyKey) {
        const bucket = classify(beforeDeal);
        if (bucket) {
          const target = next[bucket] as BucketTotals;
          next[bucket] = { value: target.value - amountValue(beforeDeal), count: target.count - 1 };
          if (bucket === 'verifiedDeals' || bucket === 'verifiedReferrals') {
            next.totalRaised = (next.totalRaised ?? 0) - amountValue(beforeDeal);
            next.dealCount = (next.dealCount ?? 0) - 1;
          }
        }
      }

      if (afterDeal && afterFy === fyKey) {
        const bucket = classify(afterDeal);
        if (bucket) {
          const target = next[bucket] as BucketTotals;
          next[bucket] = { value: target.value + amountValue(afterDeal), count: target.count + 1 };
          if (bucket === 'verifiedDeals' || bucket === 'verifiedReferrals') {
            next.totalRaised = (next.totalRaised ?? 0) + amountValue(afterDeal);
            next.dealCount = (next.dealCount ?? 0) + 1;
          }
        }
      }

      // Counters must never drift below zero through repeated rounding.
      for (const key of ['verifiedDeals', 'verifiedReferrals', 'pendingDeals', 'pendingReferrals', 'rejected'] as const) {
        const b = next[key] as BucketTotals;
        next[key] = { value: Math.max(0, b.value), count: Math.max(0, b.count) };
      }
      next.totalRaised = Math.max(0, next.totalRaised ?? 0);
      next.dealCount = Math.max(0, next.dealCount ?? 0);

      tx.set(ref, {
        ...next,
        fy: fyKey,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        recomputeAfter: new Date(Date.now() + 5 * 60 * 1000),
        appliedEventIds: rememberEvent(current.appliedEventIds, eventId),
      });
    });
  }
}

/** Sum the whole ledger for one FY. Used to seed/verify an aggregate. */
async function recomputeFromLedger(fyKey: string) {
  const snap = await db()
    .collection('deals')
    .where('createdAt', '>=', fyStartMillis(fyKey))
    .where('createdAt', '<', fyEndMillis(fyKey))
    .get();

  const totals: AggregateDoc = {
    fy: fyKey,
    verifiedDeals: { ...ZERO },
    verifiedReferrals: { ...ZERO },
    pendingDeals: { ...ZERO },
    pendingReferrals: { ...ZERO },
    rejected: { ...ZERO },
    totalRaised: 0,
    dealCount: 0,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    recomputeAfter: new Date(Date.now() + 5 * 60 * 1000),
  };

  for (const doc of snap.docs) {
    const deal = doc.data() as Record<string, any>;
    const bucket = classify(deal);
    if (!bucket) continue;
    const target = totals[bucket] as BucketTotals;
    target.value += amountValue(deal);
    target.count += 1;
    if (bucket === 'verifiedDeals' || bucket === 'verifiedReferrals') {
      totals.totalRaised += amountValue(deal);
      totals.dealCount += 1;
    }
  }

  return totals;
}

function fyStartMillis(fyKey: string): number {
  // "FY2627" -> start year 2026 (April 1).
  const startYear = 2000 + Number.parseInt(fyKey.slice(2, 4), 10);
  return new Date(startYear, 3, 1).getTime();
}

function fyEndMillis(fyKey: string): number {
  const startYear = 2000 + Number.parseInt(fyKey.slice(2, 4), 10);
  return new Date(startYear + 1, 3, 1).getTime();
}

/**
 * Primary trigger. Keeps every FY aggregate current on deal create, edit,
 * approval, rejection and delete.
 */
export const onDealWritten = onDocumentWritten(
  {
    document: 'deals/{dealId}',
    // Deals are written rarely; retry transient failures, skip poison payloads.
    retry: true,
  },
  async (event) => {
    const before = event.data?.before?.data() as Record<string, any> | undefined;
    const after = event.data?.after?.data() as Record<string, any> | undefined;

    try {
      await applyDelta(before, after, event.id);
      // Mirror referral revenue into each affected member's own subcollection so
      // `getUserRevenueEntries` reads a bounded slice instead of every referral
      // deal ever recorded.
      await mirrorToMemberEntries(event.params.dealId, before, after);
      functions.logger.info(
        `revenueStats updated for deal ${event.params.dealId} (${event.data?.before.exists ? 'updated' : 'created'})`,
      );
    } catch (err) {
      // Never let an aggregate failure break the member's write.
      functions.logger.error('Failed to update revenueStats:', err);
    }
  },
);

/**
 * Keep `users/{uid}/revenueEntries/{dealId}` in step for the two members a
 * referral deal concerns: the referrer (who earns) and the referred member (who
 * is credited with it).
 */
async function mirrorToMemberEntries(
  dealId: string,
  beforeDeal: Record<string, any> | undefined,
  afterDeal: Record<string, any> | undefined,
) {
  const uids = new Set<string>();
  for (const deal of [beforeDeal, afterDeal]) {
    if (!deal) continue;
    if (deal.referredMemberUid) uids.add(deal.referredMemberUid);
    if (deal.referrerUid) uids.add(deal.referrerUid);
  }
  if (uids.size === 0) return;

  const batch = db().batch();
  for (const uid of uids) {
    const ref = db().collection('users').doc(uid).collection('revenueEntries').doc(dealId);
    if (beforeDeal && !afterDeal) batch.delete(ref);
    else if (afterDeal) batch.set(ref, afterDeal);
  }
  await batch.commit();
}

/**
 * Nightly reconciliation. The delta path above is exact, but this guarantees
 * the cache can never drift — e.g. if a trigger was missed, a document was
 * deleted from the console, or a seed script inserted rows directly.
 */
export const reconcileRevenueStats = functions.scheduler.onSchedule(
  { schedule: 'every 24 hours', timeZone: 'Asia/Kolkata', retryCount: 3 },
  async () => {
    const deals = await db().collection('deals').select('createdAt', 'occurredOn').get();

    const byFy = new Map<string, admin.firestore.QueryDocumentSnapshot[]>();
    for (const doc of deals.docs) {
      const fyKey = dealFiscalYear(doc.data() as Record<string, any>);
      if (!fyKey) continue;
      const bucket = byFy.get(fyKey);
      if (bucket) bucket.push(doc);
      else byFy.set(fyKey, [doc]);
    }

    for (const fyKey of byFy.keys()) {
      const rebuilt = await recomputeFromLedger(fyKey);
      await db()
        .collection('revenueStats')
        .doc(fyKey)
        .set(rebuilt, { merge: true });
      functions.logger.info(`Reconciled revenueStats/${fyKey}: ${rebuilt.dealCount} verified deals`);
    }
  },
);

/**
 * On-demand rebuild for admins, callable from the existing Admin panel. The UI
 * already has a "Rebuild Totals From Ledger" action that scanned the client
 * side; this does the same work authoritatively and cheaply.
 */
export const rebuildRevenueStats = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Sign in required.');
  }
  const role = request.auth.token.role;
  if (role !== 'admin' && role !== 'super_admin') {
    throw new functions.https.HttpsError('permission-denied', 'Admin access required.');
  }

  const deals = await db().collection('deals').select('createdAt', 'occurredOn').get();
  const fyKeys = new Set<string>();
  for (const doc of deals.docs) {
    const fyKey = dealFiscalYear(doc.data() as Record<string, any>);
    if (fyKey) fyKeys.add(fyKey);
  }

  const summary: Record<string, number> = {};
  for (const fyKey of fyKeys) {
    const rebuilt = await recomputeFromLedger(fyKey);
    await db()
      .collection('revenueStats')
      .doc(fyKey)
      .set(rebuilt, { merge: true });
    summary[fyKey] = rebuilt.totalRaised;
  }

  functions.logger.info(`revenueStats rebuilt for ${fyKeys.size} FY by ${request.auth.uid}`);
  return { rebuilt: fyKeys.size, totalRaised: summary };
});