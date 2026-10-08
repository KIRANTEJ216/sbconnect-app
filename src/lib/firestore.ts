import {
  doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc,
  collection, query, where, orderBy, limit, arrayUnion,
  addDoc, onSnapshot, runTransaction, writeBatch, increment,
} from 'firebase/firestore';
import { db } from './firebase';
import { getAuth } from 'firebase/auth';

async function requireSuperAdmin(): Promise<string> {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  const snap = await getDoc(doc(db, 'users', user.uid));
  const profile = snap.data();
  const role = profile?.role;
  if (role !== 'super_admin') throw new Error('Super admin access required');
  return user.uid;
}
import type {
  BusinessProfile, Request,
  Interest, Deal, LeaderboardEntry, UserProfile,
  Meeting, Attendance, AppNotification, MeetingRSVP, IssueReport, IssueReply, UserNotification, RevenueConfig,
  ReferralLeaderboardEntry, ReferralRevenueTotal, ReferralDealBreakdown, DealStatus,
} from '../types';
import { byCompanyName } from './format';

/**
 * Parses an amount a member actually types. Handles currency symbols, thousands
 * separators and Indian shorthand (1.5L / 2cr / 50k) instead of the bare
 * `replace(/[^0-9.]/g,'')` this codebase used, which turned "1.5L" into 1.5.
 */
export function parseAmount(input: string | number): number {
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

/**
 * Legacy-safe discriminators. Every deal document written before revenue approval
 * existed has neither `source` nor `status`, so absence must read as
 * 'deal' / 'approved' or every historical deal would drop out of every total.
 */
export const isReferralDeal = (d: Deal): boolean => d.source === 'referral';
export const isApprovedDeal = (d: Deal): boolean => d.status === undefined || d.status === 'approved';
export const isPendingDeal = (d: Deal): boolean => d.status === 'pending';

/** Prefer the numeric amount; fall back to parsing the legacy display string. */
export function dealAmountValue(d: Deal): number {
  if (typeof d.amountValue === 'number' && Number.isFinite(d.amountValue)) return d.amountValue;
  return parseFloat(String(d.amount || '0').replace(/[^0-9.]/g, '')) || 0;
}

/** A revenue row counts toward a total only once it is a plain deal that has been approved. */
export function countsTowardDealsTotal(d: Deal): boolean {
  return !isReferralDeal(d) && isApprovedDeal(d);
}
export function countsTowardReferralTotal(d: Deal): boolean {
  return isReferralDeal(d) && isApprovedDeal(d);
}

export async function createBusinessProfile(
  uid: string,
  data: Omit<BusinessProfile, 'uid' | 'photoURL' | 'catalogURLs' | 'qrCodeURL' | 'verified' | 'membershipStatus' | 'membershipExpiry' | 'membershipDate' | 'paidDate' | 'dripSentDays' | 'editCount' | 'locked' | 'lastRequestsViewedAt' | 'createdAt' | 'updatedAt' | 'ownerSurname' | 'referredByPhone' | 'referredByName' | 'countryCode'>,
) {
  const profile: BusinessProfile = {
    ...data,
    uid,
    photoURL: '',
    catalogURLs: [],
    verified: false,
    qrCodeURL: `${window.location.origin}/profile/${uid}`,
    ownerSurname: '',
    lastRequestsViewedAt: 0,
    membershipDate: 0,
    membershipStatus: 'inactive',
    membershipExpiry: 0,
    paidDate: 0,
    dripSentDays: [],
    editCount: 0,
    locked: false,
    countryCode: '+91',
    referredByPhone: '',
    referredByName: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await setDoc(doc(db, 'profiles', uid), profile);
  return profile;
}

const DEFAULTS = {
    photoURL: '',
    keywords: [],
    catalogURLs: [],
  qrCodeURL: '',
  verified: false,
  membershipStatus: 'inactive' as const,
  membershipDate: 0,
  paidDate: 0,
  dripSentDays: [] as number[],
  ownerName: '',
  ownerSurname: '',
  phone: '',
  categories: [] as string[],
  companySize: '',
  location: '',
  contactEmail: '',
  website: '',
  description: '',
  editCount: 0,
  locked: false,
  lastRequestsViewedAt: 0,
  countryCode: '+91',
  referredByPhone: '',
  referredByName: '',
};

function fillDefaults(data: Record<string, unknown>): BusinessProfile {
  const migrated = { ...data } as Record<string, unknown>;
  if (migrated.catalogPDFURL && !migrated.catalogURLs) {
    migrated.catalogURLs = [migrated.catalogPDFURL as string];
  }
  delete migrated.catalogPDFURL;
  const phoneRaw = (migrated.phone as string) || '';
  if (phoneRaw.startsWith('+91-') || phoneRaw.startsWith('+91')) {
    migrated.phone = phoneRaw.replace(/^\+91[-\s]?/, '');
    if (!migrated.countryCode) migrated.countryCode = '+91';
  }
  return { ...DEFAULTS, ...migrated } as unknown as BusinessProfile;
}

export async function getBusinessProfile(uid: string): Promise<BusinessProfile | null> {
  const snap = await getDoc(doc(db, 'profiles', uid));
  if (!snap.exists()) return null;
  return fillDefaults(snap.data());
}

/**
 * Fetch many profiles in ONE round trip.
 *
 * Callers previously did `Promise.all(uids.map(getBusinessProfile))`, which is
 * N separate `getDoc` RPCs — 30 interests meant 30 reads, on a page every member
 * can reach, and it ran twice per visit (on mount and after submitting). Firestore
 * caps an `in` clause at 30 values, so this chunks and issues one query per chunk.
 */
export async function getBusinessProfiles(uids: string[]): Promise<Record<string, BusinessProfile>> {
  const unique = Array.from(new Set(uids.filter(Boolean)));
  const out: Record<string, BusinessProfile> = {};
  if (unique.length === 0) return out;

  // Firestore's `in` operator accepts at most 30 values per query.
  const CHUNK = 30;
  for (let i = 0; i < unique.length; i += CHUNK) {
    const chunk = unique.slice(i, i + CHUNK);
    const snap = await getDocs(query(collection(db, 'profiles'), where('__name__', 'in', chunk)));
    for (const d of snap.docs) {
      out[d.id] = fillDefaults(d.data());
    }
  }
  return out;
}

export async function updateBusinessProfile(uid: string, data: Partial<BusinessProfile>) {
  await updateDoc(doc(db, 'profiles', uid), { ...data, updatedAt: Date.now() });
}

export async function updateMembershipDates(uid: string, paidDate: number) {
  await requireSuperAdmin();
  const expiry = paidDate + 364 * 24 * 60 * 60 * 1000;
  await updateDoc(doc(db, 'profiles', uid), {
    paidDate,
    membershipDate: paidDate,
    membershipStatus: 'active',
    membershipExpiry: expiry,
    dripSentDays: [],
    updatedAt: Date.now(),
  });
}

export async function getProfilesForReferral(limitCount = 5): Promise<Pick<BusinessProfile, 'uid' | 'ownerName' | 'ownerSurname' | 'phone' | 'companyName'>[]> {
  const q = query(collection(db, 'profiles'), orderBy('createdAt', 'desc'), where('verified', '==', true), limit(limitCount));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      uid: d.id,
      ownerName: data.ownerName || '',
      ownerSurname: data.ownerSurname || '',
      phone: data.phone || '',
      companyName: data.companyName || '',
    };
  });
}

export async function getAllProfiles(max = 999, verifiedOnly = false): Promise<BusinessProfile[]> {
  const constraints: (ReturnType<typeof where> | ReturnType<typeof limit>)[] = [limit(max)];
  if (verifiedOnly) constraints.push(where('verified', '==', true));
  const q = query(collection(db, 'profiles'), ...constraints);
  const snap = await getDocs(q);
  // Firestore returns documents in unspecified order (effectively id order), so
  // every directory view sorts here once rather than in each screen.
  return snap.docs.map((d) => fillDefaults(d.data())).sort(byCompanyName);
}

// ─── Requests ───

export async function createRequest(
  uid: string, companyName: string, title: string, description: string,
  category: string, customCategory: string, budget: string, deadline: string,
  requesterPhone?: string,
) {
  const ref = await addDoc(collection(db, 'requests'), {
    uid,
    companyName,
    title,
    description,
    category,
    customCategory,
    budget,
    deadline,
    status: 'open',
    awardedTo: null,
    interestCount: 0,
    interestedUids: [],
    requesterPhone: requesterPhone || '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  return ref.id;
}

export async function getRequest(id: string): Promise<Request | null> {
  const snap = await getDoc(doc(db, 'requests', id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Request;
}

export async function closeRequest(id: string) {
  await requireSuperAdmin();
  await updateDoc(doc(db, 'requests', id), { status: 'closed', updatedAt: Date.now() });
}

export async function deleteRequest(id: string) {
  await requireSuperAdmin();
  await deleteDoc(doc(db, 'requests', id));
}

export async function getAllRequests(max = 999): Promise<Request[]> {
  const q = query(collection(db, 'requests'), orderBy('createdAt', 'desc'), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Request));
}

export async function getUserRequests(uid: string): Promise<Request[]> {
  const q = query(collection(db, 'requests'), where('uid', '==', uid));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Request));
}

export async function getAwardedRequests(uid: string): Promise<Request[]> {
  const all = await getUserRequests(uid);
  return all.filter((r) => r.awardedTo).sort((a, b) => b.createdAt - a.createdAt);
}

// ─── Interest & Deals ───

export async function expressInterest(requestId: string, uid: string, companyName: string, phone: string, message: string) {
  const reqRef = doc(db, 'requests', requestId);
  const snap = await getDoc(reqRef);
  if (!snap.exists()) throw new Error('Request not found');
  const data = snap.data();

  // Check the subcollection, not `interestedUids` on the parent. That array was
  // never persisted — `expressInterest` only ever wrote the subcollection — so it
  // stayed `[]` forever and this guard never fired, letting a member pitch the
  // same request repeatedly. The parent array is now maintained server-side by
  // the `onInterestCreated` trigger, but the subcollection is the source of
  // truth, so that is what a correctness check must consult.
  const existingInterests = await getDocs(collection(db, 'requests', requestId, 'interests'));
  if (existingInterests.docs.some((d) => d.data().uid === uid)) {
    throw new Error('You have already pitched for this request');
  }

  const requestOwnerUid = data.uid;
  const requestTitle = data.title || '';
  const ref = doc(collection(db, 'requests', requestId, 'interests'));
  await setDoc(ref, {
    requestId,
    uid,
    companyName,
    phone,
    message,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  sendUserNotification(requestOwnerUid, 'admin_message', 'New Pitch', `${companyName} pitched for "${requestTitle}": ${message}`, requestId).catch(() => {});
  return ref.id;
}

export async function getInterests(requestId: string): Promise<Interest[]> {
  const snap = await getDocs(collection(db, 'requests', requestId, 'interests'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Interest));
}

export async function awardDeal(
  requestId: string,
  requestTitle: string,
  giverUid: string,
  giverCompanyName: string,
  receiverUid: string,
  receiverCompanyName: string,
  amount: string,
) {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  if (user.uid !== giverUid) {
    await requireSuperAdmin();
  }
  const parsed = parseAmount(amount);
  // Admin-initiated: recorded by the chapter, so it is approved on entry.
  const dealRef = await addDoc(collection(db, 'deals'), {
    requestId,
    requestTitle,
    giverUid,
    giverCompanyName,
    receiverUid,
    receiverCompanyName,
    amount,
    amountValue: parsed,
    source: 'deal',
    status: 'approved',
    submittedByRole: 'admin',
    reviewedBy: user.uid,
    reviewedAt: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  if (parsed > 0) {
    await runTransaction(db, async (tx) => {
      const statsRef = doc(db, 'stats', 'deals');
      const snap = await tx.get(statsRef);
      if (snap.exists()) {
        tx.update(statsRef, { totalValue: increment(parsed), updatedAt: Date.now() });
      } else {
        tx.set(statsRef, { totalValue: parsed, updatedAt: Date.now() });
      }
    });
  }
  await updateDoc(doc(db, 'requests', requestId), { status: 'closed', awardedTo: receiverUid, updatedAt: Date.now() });
  sendUserNotification(receiverUid, 'deal_won', '🎉 You Won!', `Your pitch for "${requestTitle}" was selected by ${giverCompanyName}!`, requestId).catch(() => {});
  sendUserNotification(giverUid, 'deal_thanks', '🙏 Thank You!', `${receiverCompanyName} sends their thanks for awarding "${requestTitle}" to them.`, requestId).catch(() => {});
  return dealRef.id;
}

export async function recordDeal(
  giverUid: string,
  giverCompanyName: string,
  receiverUid: string,
  receiverCompanyName: string,
  amount: string,
  description?: string,
) {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  const parsed = parseAmount(amount);
  if (parsed <= 0) throw new Error('Enter a valid amount greater than zero.');

  // Member-submitted: held as pending until an admin verifies it. Nothing touches
  // the public total or the leaderboard until then.
  const ref = await addDoc(collection(db, 'deals'), {
    requestId: '',
    requestTitle: description || 'Direct Deal',
    giverUid,
    giverCompanyName,
    receiverUid,
    receiverCompanyName,
    amount,
    amountValue: parsed,
    source: 'deal',
    status: 'pending',
    submittedBy: user.uid,
    submittedByRole: 'member',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  sendUserNotification(
    receiverUid,
    'revenue_submitted',
    'Submitted for verification',
    `Your submission of ${amount} from ${giverCompanyName} is awaiting admin verification.`,
    ref.id,
  ).catch(() => {});
  sendUserNotification(
    giverUid,
    'revenue_submitted',
    'Revenue submitted in your name',
    `${receiverCompanyName} submitted a revenue entry of ${amount}. An admin will verify it.`,
    ref.id,
  ).catch(() => {});
  return ref.id;
}

export async function recalculateTotalBusinessValue(): Promise<void> {
  const ref = doc(db, 'stats', 'deals');
  const dealsSnap = await getDocs(collection(db, 'deals'));
  let total = 0;
  for (const d of dealsSnap.docs) {
    const deal = d.data() as Deal;
    if (countsTowardDealsTotal(deal)) total += dealAmountValue(deal);
  }
  await setDoc(ref, { totalValue: total, updatedAt: Date.now() });
}

export interface RevenueSummary {
  verifiedDeals: number;
  verifiedDealsCount: number;
  verifiedReferrals: number;
  verifiedReferralsCount: number;
  pendingDeals: number;
  pendingDealsCount: number;
  pendingReferrals: number;
  pendingReferralsCount: number;
  rejectedTotal: number;
  rejectedCount: number;
  entryCount: number;
  /** verified + pending, i.e. the figure shown as "raised" on the dashboard. */
  headline: number;
}

/**
 * Materialized aggregate maintained by the `onDealWritten` Cloud Function in
 * functions/src/revenueStats.ts. One document per financial year; reading it
 * costs a single fixed-size document instead of scanning the whole ledger.
 */
interface RevenueStatsAggregate {
  verifiedDeals: { value: number; count: number };
  verifiedReferrals: { value: number; count: number };
  pendingDeals: { value: number; count: number };
  pendingReferrals: { value: number; count: number };
  rejected: { value: number; count: number };
  totalRaised: number;
  dealCount: number;
}

/** "FY 26-27" -> "FY2627", matching the Cloud Function's key format. */
function currentFYKey(): string {
  const now = new Date();
  const fyStartYear = now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1;
  return `FY${String(fyStartYear).slice(-2)}${String(fyStartYear + 1).slice(-2)}`;
}

/**
 * Every revenue aggregate, derived from the deal ledger in one read.
 *
 * `stats/deals.totalValue` is a denormalised cache and it drifts: the previous
 * implementation both incremented it on insert and overwrote it from a fresh sum,
 * so a race could silently drop an entry. A ₹240,000 deal went missing from the
 * headline for exactly that reason. The ledger is the only source of truth, so
 * every displayed figure derives from here and the cache is never trusted.
 */
export async function getRevenueSummary(): Promise<RevenueSummary> {
  // Fast path: one fixed-size document read maintained by a Cloud Function.
  // Before the function is deployed (or for an FY with no writes yet) this
  // misses and we fall through to the authoritative ledger scan below, so the
  // headline is never wrong — only slower until the function is live.
  try {
    const statsSnap = await getDoc(doc(db, 'revenueStats', currentFYKey()));
    if (statsSnap.exists()) {
      const agg = statsSnap.data() as RevenueStatsAggregate;
      if (typeof agg?.totalRaised === 'number' && typeof agg?.dealCount === 'number') {
        const verifiedDeals = agg.verifiedDeals?.value ?? 0;
        const verifiedReferrals = agg.verifiedReferrals?.value ?? 0;
        const pendingDeals = agg.pendingDeals?.value ?? 0;
        const pendingReferrals = agg.pendingReferrals?.value ?? 0;
        return {
          verifiedDeals,
          verifiedDealsCount: agg.verifiedDeals?.count ?? 0,
          verifiedReferrals,
          verifiedReferralsCount: agg.verifiedReferrals?.count ?? 0,
          pendingDeals,
          pendingDealsCount: agg.pendingDeals?.count ?? 0,
          pendingReferrals,
          pendingReferralsCount: agg.pendingReferrals?.count ?? 0,
          rejectedTotal: agg.rejected?.value ?? 0,
          rejectedCount: agg.rejected?.count ?? 0,
          entryCount:
            (agg.verifiedDeals?.count ?? 0) +
            (agg.verifiedReferrals?.count ?? 0) +
            (agg.pendingDeals?.count ?? 0) +
            (agg.pendingReferrals?.count ?? 0) +
            (agg.rejected?.count ?? 0),
          headline: verifiedDeals + verifiedReferrals + pendingDeals + pendingReferrals,
        };
      }
    }
  } catch {
    // Missing permission or offline — fall back to the ledger scan.
  }

  return getRevenueSummaryFromLedger();
}

/**
 * Authoritative fallback: derive every figure by scanning the ledger. Kept as a
 * separate function so the correctness path stays available even if the
 * aggregate is unavailable, and so tests can exercise it directly.
 */
export async function getRevenueSummaryFromLedger(): Promise<RevenueSummary> {
  const snap = await getDocs(collection(db, 'deals'));
  let verifiedDeals = 0, verifiedDealsCount = 0;
  let verifiedReferrals = 0, verifiedReferralsCount = 0;
  let pendingDeals = 0, pendingDealsCount = 0;
  let pendingReferrals = 0, pendingReferralsCount = 0;
  let rejectedTotal = 0, rejectedCount = 0;

  for (const d of snap.docs) {
    const deal = d.data() as Deal;
    const value = dealAmountValue(deal);
    const referral = isReferralDeal(deal);
    if (isPendingDeal(deal)) {
      if (referral) { pendingReferrals += value; pendingReferralsCount++; }
      else { pendingDeals += value; pendingDealsCount++; }
    } else if (!isApprovedDeal(deal)) {
      rejectedTotal += value; rejectedCount++;
    } else if (referral) {
      verifiedReferrals += value; verifiedReferralsCount++;
    } else {
      verifiedDeals += value; verifiedDealsCount++;
    }
  }

  return {
    verifiedDeals,
    verifiedDealsCount,
    verifiedReferrals,
    verifiedReferralsCount,
    pendingDeals,
    pendingDealsCount,
    pendingReferrals,
    pendingReferralsCount,
    rejectedTotal,
    rejectedCount,
    entryCount: snap.size,
    headline:
      verifiedDeals + verifiedReferrals + pendingDeals + pendingReferrals,
  };
}

/**
 * Verifies (or rejects) a member-submitted revenue entry and moves it into the
 * matching public total. This is the single place member-entered money becomes
 * visible, so it is the single place that fans notifications out.
 */
export async function reviewRevenueEntry(
  dealId: string,
  approve: boolean,
  note?: string,
): Promise<void> {
  const adminUid = await requireSuperAdmin();
  const ref = doc(db, 'deals', dealId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Entry not found');
  const deal = snap.data() as Deal;
  if (isApprovedDeal(deal) || deal.status === 'rejected') {
    throw new Error('This entry has already been reviewed.');
  }

  const value = dealAmountValue(deal);
  await updateDoc(ref, {
    status: approve ? 'approved' : 'rejected',
    reviewedBy: adminUid,
    reviewedAt: Date.now(),
    reviewNote: note?.trim() || '',
    updatedAt: Date.now(),
  });

  if (deal.source === 'referral') {
    await runTransaction(db, async (tx) => {
      const statsRef = doc(db, 'stats', 'referralRevenue');
      const s = await tx.get(statsRef);
      if (!s.exists()) {
        tx.set(statsRef, { totalValue: approve ? value : 0, updatedAt: Date.now() });
        return;
      }
      const totalValue = approve
        ? ((s.data()?.totalValue as number) || 0) + value
        : ((s.data()?.totalValue as number) || 0);
      tx.update(statsRef, { totalValue, updatedAt: Date.now() });
    });
  } else {
    // Pending deals were never added, so approving is a straight increment.
    if (approve && value > 0) {
      await runTransaction(db, async (tx) => {
        const statsRef = doc(db, 'stats', 'deals');
        const s = await tx.get(statsRef);
        if (s.exists()) {
          tx.update(statsRef, { totalValue: increment(value), updatedAt: Date.now() });
        } else {
          tx.set(statsRef, { totalValue: value, updatedAt: Date.now() });
        }
      });
    }
  }

  const who = deal.receiverCompanyName || 'A member';
  if (deal.source === 'referral') {
    const referrer = deal.referrerName || 'your referrer';
    if (approve) {
      sendUserNotification(deal.referredMemberUid || deal.receiverUid, 'revenue_approved', '✅ Referral revenue verified', `${value} in referral revenue attributed to ${referrer} was verified.`, dealId).catch(() => {});
      if (deal.referrerUid) {
        sendUserNotification(deal.referrerUid, 'referral_credited', '🎉 Referral revenue credited', `Your referral ${who} generated ${value}, now credited to you on the referral leaderboard.`, dealId).catch(() => {});
      }
    } else {
      sendUserNotification(deal.referredMemberUid || deal.receiverUid, 'revenue_rejected', 'Referral revenue not verified', `Your submission of ${value} was not verified.${note?.trim() ? ` Note: ${note.trim()}` : ''}`, dealId).catch(() => {});
    }
    return;
  }

  sendUserNotification(
    deal.receiverUid,
    approve ? 'revenue_approved' : 'revenue_rejected',
    approve ? '✅ Revenue verified' : 'Revenue not verified',
    approve
      ? `Your revenue entry of ${value} from ${deal.giverCompanyName} was verified and added to the total.`
      : `Your revenue entry of ${value} was not verified.${note?.trim() ? ` Note: ${note.trim()}` : ''}`,
    dealId,
  ).catch(() => {});
}

/**
 * Member-submitted revenue that has not been verified yet. Derived from the deal
 * collection rather than stored, because members cannot write `stats/*` under the
 * Firestore rules — and a member's submission must never be able to inflate the
 * headline total by itself.
 */
  /**
 * Pending-only read. Previously this downloaded the entire ledger and filtered
 * in JS; the server can filter `status == 'pending'` directly, so the payload is
 * proportional to the review queue rather than to lifetime revenue.
 */
export async function getPendingRevenueEntries(): Promise<Deal[]> {
  const snap = await getDocs(
    query(collection(db, 'deals'), where('status', '==', 'pending'), orderBy('createdAt', 'desc')),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Deal)).filter(isPendingDeal);
}

export async function recalculateReferralRevenueTotals(): Promise<ReferralRevenueTotal> {
  const snap = await getDocs(collection(db, 'deals'));
  let totalValue = 0;
  let pendingValue = 0;
  for (const d of snap.docs) {
    const deal = d.data() as Deal;
    if (!isReferralDeal(deal)) continue;
    const value = dealAmountValue(deal);
    if (isApprovedDeal(deal)) totalValue += value;
    else if (isPendingDeal(deal)) pendingValue += value;
  }
  await setDoc(doc(db, 'stats', 'referralRevenue'), { totalValue, updatedAt: Date.now() });
  return { totalValue, pendingValue };
}

/**
 * `totalValue` is the cached, admin-written aggregate. `pendingValue` is always
 * derived from the deal collection rather than stored, so a member can never
 * write a number into it — Firestore rules reserve `stats/*` for admins.
 */
/** Referral-only read — filtered server-side rather than by a full ledger scan. */
export async function getReferralRevenueEntries(): Promise<Deal[]> {
  const snap = await getDocs(
    query(collection(db, 'deals'), where('source', '==', 'referral'), orderBy('createdAt', 'desc')),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Deal)).filter(isReferralDeal);
}

/**
 * One member's referral revenue. Sourced from `revenueEntries/{uid}` — a
 * per-user subcollection the writer maintains — instead of reading every referral
 * deal ever recorded and filtering in JS. Falls back to the old scan if the
 * subcollection is empty for a member with referral history.
 */
export async function getUserRevenueEntries(uid: string): Promise<Deal[]> {
  try {
    const snap = await getDocs(
      query(collection(db, 'users', uid, 'revenueEntries'), orderBy('createdAt', 'desc')),
    );
    if (!snap.empty) {
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Deal));
    }
  } catch {
    // Rules or offline — fall through.
  }

  const entries = await getReferralRevenueEntries();
  return entries.filter((d) => d.referredMemberUid === uid || d.referrerUid === uid);
}

/**
 * Revenue-ranked referral board. Approved revenue is what ranks; referral count is
 * carried alongside because it is the funnel, not the score.
 */
export async function getReferralLeaderboard(): Promise<ReferralLeaderboardEntry[]> {
  const [entriesSnap, profilesSnap] = await Promise.all([
    getDocs(collection(db, 'deals')),
    getDocs(query(collection(db, 'profiles'), where('verified', '==', true))),
  ]);

  const byPhone = new Map<string, BusinessProfile>();
  const byUid = new Map<string, BusinessProfile>();
  for (const p of profilesSnap.docs) {
    const profile = fillDefaults(p.data());
    byUid.set(profile.uid, profile);
    if (profile.phone) byPhone.set(profile.phone, profile);
    const digits = profile.phone.replace(/\D/g, '');
    if (digits && !byPhone.has(digits)) byPhone.set(digits, profile);
  }

  const accrual = new Map<string, {
    approvedRevenue: number; approvedCount: number; pendingRevenue: number; pendingCount: number;
    referralCount: number; profile?: BusinessProfile;
    displayName: string; displayCompany: string; isExternal: boolean;
    deals: ReferralDealBreakdown[];
  }>();

  // Referrers are bucketed by uid when they are a member, and by lowercased
  // company name when the admin entered them as "Others". Without the second
  // path, off-platform referrers were silently dropped from the board.
  const ensureBucket = (key: string) => {
    if (!accrual.has(key)) {
      accrual.set(key, {
        approvedRevenue: 0, approvedCount: 0, pendingRevenue: 0, pendingCount: 0,
        referralCount: 0, displayName: '', displayCompany: '', isExternal: false, deals: [],
      });
    }
    return accrual.get(key)!;
  };

  const bucketFor = (profile?: BusinessProfile | null) => {
    const key = profile?.uid;
    if (!key) return null;
    const b = ensureBucket(`uid:${key}`);
    if (!b.profile && profile) b.profile = profile;
    if (!b.displayName) {
      b.displayName = `${profile.ownerName} ${profile.ownerSurname || ''}`.trim();
      b.displayCompany = profile.companyName || '';
    }
    return b;
  };

  // Every verified profile contributes a row so referrers with no revenue still appear.
  for (const p of profilesSnap.docs) {
    bucketFor(fillDefaults(p.data()));
  }

  for (const p of profilesSnap.docs) {
    const profile = fillDefaults(p.data());
    if (!profile.referredByPhone) continue;
    const referrer = byPhone.get(profile.referredByPhone)
      || byPhone.get(profile.referredByPhone.replace(/\D/g, ''));
    const b = bucketFor(referrer);
    if (b) b.referralCount += 1;
  }

  for (const d of entriesSnap.docs) {
    const deal = d.data() as Deal;
    if (!isReferralDeal(deal)) continue;

    const memberBucket = deal.referrerUid ? bucketFor(byUid.get(deal.referrerUid)) : null;
    const referrerName = (deal.referrerName || deal.referrerCompanyName || '').trim();
    const referrerCompany = (deal.referrerCompanyName || referrerName).trim();

    const b = memberBucket
      || (referrerName
        ? (() => {
          const k = `name:${referrerCompany.toLowerCase() || referrerName.toLowerCase()}`;
          const bucket = ensureBucket(k);
          bucket.isExternal = true;
          if (!bucket.displayName) bucket.displayName = referrerName;
          if (!bucket.displayCompany) bucket.displayCompany = referrerCompany;
          return bucket;
        })()
        : null);
    if (!b) continue;

    const value = dealAmountValue(deal);
    const status: DealStatus = deal.status || 'approved';
    if (status === 'approved') { b.approvedRevenue += value; b.approvedCount += 1; }
    else if (status === 'pending') { b.pendingRevenue += value; b.pendingCount += 1; }

    b.deals.push({
      id: d.id,
      receivedBy: deal.referredMemberName
        ? `${deal.receiverCompanyName || ''}`.trim() || deal.referredMemberName
        : (deal.receiverCompanyName || deal.referredMemberName || '—'),
      givenBy: deal.clientCompanyName || deal.giverCompanyName || '—',
      value,
      status,
      createdAt: deal.createdAt,
    });
  }

  return Array.from(accrual.entries())
    .filter(([, b]) => b.referralCount > 0 || b.approvedRevenue > 0 || b.pendingRevenue > 0)
    .map(([key, b]) => ({
      uid: b.profile?.uid || key,
      name: b.displayName,
      companyName: b.displayCompany,
      phone: b.profile?.phone || '',
      isExternal: b.isExternal,
      referralCount: b.referralCount,
      approvedRevenue: b.approvedRevenue,
      approvedCount: b.approvedCount,
      pendingRevenue: b.pendingRevenue,
      pendingCount: b.pendingCount,
      deals: b.deals.sort((x, y) => y.createdAt - x.createdAt),
    }))
    .sort((a, b) => b.approvedRevenue - a.approvedRevenue || b.referralCount - a.referralCount);
}

/**
 * Records a deal on a member's behalf — a member received business from a client,
 * but nobody entered it. Without this, the only admin-side entry point was the
 * referral form, which forces a referrer and files the row as `source: 'referral'`;
 * that hides a genuine deal from the Business Leaderboard and puts it in the wrong
 * total bucket.
 *
 * Admin-entered revenue is approved on entry, consistent with
 * `submitReferralRevenueAsAdmin`. Totals derive from the ledger, so there is no
 * cache write here.
 */
export async function submitDealAsAdmin(input: {
  memberUid: string;
  giverUid?: string;
  giverName: string;
  clientName: string;
  amount: string;
  note?: string;
}): Promise<string> {
  const adminUid = await requireSuperAdmin();
  if (!input.memberUid) throw new Error('Select the member who received the business.');
  const giverName = input.giverName.trim();
  if (!giverName) throw new Error('Select or enter the client / business that gave the work.');
  const clientName = input.clientName.trim() || giverName;

  const memberSnap = await getDoc(doc(db, 'profiles', input.memberUid));
  if (!memberSnap.exists()) throw new Error('Member not found');
  const member = fillDefaults(memberSnap.data());

  const parsed = parseAmount(input.amount);
  if (parsed <= 0) throw new Error('Enter a valid amount greater than zero.');

  const value = parsed;
  const isExternal = !input.giverUid;

  return (await addDoc(collection(db, 'deals'), {
    requestId: '',
    requestTitle: clientName,
    clientUid: isExternal ? '' : input.giverUid,
    clientCompanyName: clientName,
    clientIsExternal: isExternal,
    giverUid: input.giverUid || `external_${value}`,
    giverCompanyName: giverName,
    receiverUid: member.uid,
    receiverCompanyName: member.companyName,
    amount: formatCurrencyValue(value),
    amountValue: value,
    source: 'deal',
    status: 'approved',
    reviewNote: input.note?.trim() || '',
    submittedBy: adminUid,
    submittedByRole: 'admin',
    reviewedBy: adminUid,
    reviewedAt: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })).id;
}

/**
 * Records referral revenue on a member's behalf — business that arrived *because
 * of* a referral, so the referrer takes the credit.
 *
 * Admin-entered revenue is approved on entry: an admin approving their own entry
 * adds no control, and the submittedByRole/reviewedBy trail keeps it visible.
 *
 * The referrer is supplied explicitly rather than read off the member's profile,
 * because members referred verbally often have nothing on file. Set
 * `alsoSaveReferrerToProfile` to backfill the profile at the same time.
 *
 * For a plain deal where someone just did business with a client, use
 * `submitDealAsAdmin` instead — filing those here is what previously hid them
 * from the Business Leaderboard.
 */
export async function submitReferralRevenueAsAdmin(input: {
  memberUid?: string;
  /** Company name typed in when the member is not a registered profile ("Others"). */
  memberCompanyName?: string;
  referrerUid?: string;
  /** Referrer name typed in for an external/off-platform referrer. */
  referrerCompanyName?: string;
  amount: string;
  clientUid?: string;
  clientName: string;
  clientIsExternal: boolean;
  note?: string;
  alsoSaveReferrerToProfile?: boolean;
}): Promise<string> {
  const adminUid = await requireSuperAdmin();

  // Either a registered profile or a typed company name is acceptable for both
  // ends, because referrals frequently come from people outside the network.
  const memberUid = input.memberUid || '';
  const memberTyped = (input.memberCompanyName || '').trim();
  const referrerUid = input.referrerUid || '';
  const referrerTyped = (input.referrerCompanyName || '').trim();

  if (!memberUid && !memberTyped) {
    throw new Error('Select the member who received the business, or choose Others and enter the company name.');
  }
  if (!referrerUid && !referrerTyped) {
    throw new Error('Select the referrer to credit, or choose Others and enter the name.');
  }
  if (memberUid && referrerUid && memberUid === referrerUid) {
    throw new Error('A member cannot be their own referrer.');
  }
  if (!referrerUid && memberTyped && referrerTyped.toLowerCase() === memberTyped.toLowerCase()) {
    throw new Error('A company cannot be its own referrer.');
  }

  let memberCompanyName = memberTyped;
  let memberOwnerName = memberTyped;
  let memberPhone = '';

  if (memberUid) {
    const memberSnap = await getDoc(doc(db, 'profiles', memberUid));
    if (!memberSnap.exists()) throw new Error('Member not found');
    const member = fillDefaults(memberSnap.data());
    memberCompanyName = member.companyName || memberTyped;
    memberOwnerName = `${member.ownerName} ${member.ownerSurname || ''}`.trim();
    memberPhone = member.phone || '';
  }

  let referrerCompany = referrerTyped;
  let referrerName = referrerTyped;
  let referrerPhone = '';

  if (referrerUid) {
    const referrerSnap = await getDoc(doc(db, 'profiles', referrerUid));
    if (!referrerSnap.exists()) throw new Error('Referrer profile not found');
    const referrer = fillDefaults(referrerSnap.data());
    referrerCompany = referrer.companyName || referrerTyped;
    referrerName = `${referrer.ownerName} ${referrer.ownerSurname || ''}`.trim();
    referrerPhone = referrer.phone || '';
  }

  const clientName = input.clientName.trim();
  if (!clientName) throw new Error('Select or enter the client / business.');

  const parsed = parseAmount(input.amount);
  if (parsed <= 0) throw new Error('Enter a valid amount greater than zero.');

  const value = parsed;

  // Optional: make the attribution permanent so referralCount and future
  // self-reporting both work. Only possible when both ends are real profiles.
  if (input.alsoSaveReferrerToProfile && memberUid && referrerUid && memberPhone !== referrerPhone) {
    await updateDoc(doc(db, 'profiles', memberUid), {
      referredByPhone: referrerPhone,
      referredByName: referrerName,
      updatedAt: Date.now(),
    });
  }

  const ref = await addDoc(collection(db, 'deals'), {
    requestId: '',
    requestTitle: clientName,
    clientUid: input.clientIsExternal ? '' : (input.clientUid || ''),
    clientCompanyName: clientName,
    clientIsExternal: input.clientIsExternal,
    // "Given By" on the referral ledger is the client; "Received By" is the
    // member. When either side is typed in rather than picked, the uid is blank
    // and the name is the only identity we have.
    giverUid: referrerUid,
    giverCompanyName: referrerCompany,
    receiverUid: memberUid,
    receiverCompanyName: memberCompanyName,
    amount: formatCurrencyValue(value),
    amountValue: value,
    source: 'referral',
    status: 'approved',
    referrerUid,
    referrerName,
    referrerCompanyName: referrerCompany,
    referredMemberUid: memberUid,
    referredMemberName: memberOwnerName,
    reviewNote: input.note?.trim() || '',
    submittedBy: adminUid,
    submittedByRole: 'admin',
    reviewedBy: adminUid,
    reviewedAt: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  if (value > 0) {
    await runTransaction(db, async (tx) => {
      const statsRef = doc(db, 'stats', 'referralRevenue');
      const s = await tx.get(statsRef);
      if (s.exists()) {
        tx.update(statsRef, { totalValue: increment(value), updatedAt: Date.now() });
      } else {
        tx.set(statsRef, { totalValue: value, updatedAt: Date.now() });
      }
    });
  }

  // Notifications only make sense for members with a real account.
  if (referrerUid) {
    sendUserNotification(referrerUid, 'referral_credited', '🎉 Referral revenue credited', `${memberCompanyName} generated ${formatCurrencyValue(value)} from ${clientName} through your referral. Credited to you.`, ref.id).catch(() => {});
  }
  if (memberUid) {
    sendUserNotification(memberUid, 'revenue_approved', '✅ Referral revenue recorded', `Revenue of ${formatCurrencyValue(value)} from ${clientName} was recorded on your behalf and credited to ${referrerName}.`, ref.id).catch(() => {});
  }
  return ref.id;
}

function formatCurrencyValue(value: number): string {
  return `₹${value.toLocaleString('en-IN')}`;
}

  /**
 * Member-reported referral revenue. Always lands pending — a member must not be
 * able to approve revenue that pays a referrer, and must not be able to name
 * their own referrer (the profile's referrer is used as-is).
 */
export async function submitReferralRevenue(input: {
  amount: string;
  clientUid?: string;
  clientName: string;
  clientIsExternal: boolean;
  note?: string;
}): Promise<string> {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  const selfSnap = await getDoc(doc(db, 'profiles', user.uid));
  if (!selfSnap.exists()) throw new Error('Complete your business profile first.');
  const self = fillDefaults(selfSnap.data());
  if (!self.referredByPhone) {
    throw new Error('You do not have a referrer on your profile, so referral revenue cannot be attributed. Ask an admin to add it.');
  }

  const clientName = input.clientName.trim();
  if (!clientName) throw new Error('Select or enter the client / business.');

  const parsed = parseAmount(input.amount);
  if (parsed <= 0) throw new Error('Enter a valid amount greater than zero.');

  let referrerName = self.referredByName;
  let referrerCompanyName = '';
  let referrerUid = '';
  const referrerSnap = await getDoc(doc(db, 'profiles', self.referredByPhone));
  if (referrerSnap.exists()) {
    const referrer = fillDefaults(referrerSnap.data());
    referrerUid = referrer.uid;
    referrerName = `${referrer.ownerName} ${referrer.ownerSurname || ''}`.trim();
    referrerCompanyName = referrer.companyName;
  }

  const value = parsed;
  const referredName = `${self.ownerName} ${self.ownerSurname || ''}`.trim();
  const ref = await addDoc(collection(db, 'deals'), {
    requestId: '',
    requestTitle: clientName,
    clientUid: input.clientIsExternal ? '' : (input.clientUid || ''),
    clientCompanyName: clientName,
    clientIsExternal: input.clientIsExternal,
    giverUid: referrerUid || self.referredByPhone,
    giverCompanyName: referrerCompanyName,
    receiverUid: self.uid,
    receiverCompanyName: self.companyName,
    amount: formatCurrencyValue(value),
    amountValue: value,
    source: 'referral',
    status: 'pending',
    referrerUid,
    referrerName,
    referrerCompanyName,
    referredMemberUid: self.uid,
    referredMemberName: referredName,
    reviewNote: input.note?.trim() || '',
    submittedBy: user.uid,
    submittedByRole: 'member',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  // No stats write here on purpose: a member cannot touch stats/* under the
  // Firestore rules, and pending totals are derived rather than stored.
  sendUserNotification(
    self.uid,
    'revenue_submitted',
    'Submitted for verification',
    `Your referral revenue of ${formatCurrencyValue(value)} from ${clientName} is awaiting admin verification.`,
    ref.id,
  ).catch(() => {});
  return ref.id;
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const snap = await getDocs(collection(db, 'deals'));
  const deals = snap.docs.map((d) => d.data() as Deal).filter(countsTowardDealsTotal);
  const map = new Map<string, { companyName: string; totalRevenue: number; dealCount: number }>();
  for (const d of deals) {
    const amount = dealAmountValue(d);
    const entry = map.get(d.giverUid) || { companyName: d.giverCompanyName, totalRevenue: 0, dealCount: 0 };
    entry.totalRevenue += amount;
    entry.dealCount += 1;
    map.set(d.giverUid, entry);
  }
  const uids = Array.from(map.keys());
  const ownerMap = new Map<string, string>();
  for (let i = 0; i < uids.length; i += 10) {
    const batch = uids.slice(i, i + 10);
    const q = query(collection(db, 'profiles'), where('__name__', 'in', batch));
    const batchSnap = await getDocs(q);
    batchSnap.docs.forEach((d) => ownerMap.set(d.id, d.data().ownerName || ''));
  }
  return Array.from(map.entries())
    .map(([uid, e]) => ({ uid, companyName: e.companyName, ownerName: ownerMap.get(uid) || '', totalRevenue: e.totalRevenue, dealCount: e.dealCount }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue);
}

export async function getDeals(): Promise<Deal[]> {
  const snap = await getDocs(collection(db, 'deals'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Deal));
}

export async function getRevenueConfig(): Promise<RevenueConfig | null> {
  const snap = await getDoc(doc(db, 'settings', 'revenue'));
  if (!snap.exists()) return null;
  return snap.data() as RevenueConfig;
}

export async function setRevenueConfig(target: number, financialYear: string, updatedBy: string): Promise<void> {
  const ref = doc(db, 'settings', 'revenue');
  const snap = await getDoc(ref);
  const data: Record<string, unknown> = { target, financialYear, updatedBy, updatedAt: Date.now() };
  if (!snap.exists()) data.createdAt = Date.now();
  await setDoc(ref, data);
}

export async function resetProductionData(adminUid: string): Promise<void> {
  const batchSize = 500;

  const deleteCollection = async (colPath: string) => {
    const docs = await getDocs(query(collection(db, colPath), limit(batchSize)));
    while (docs.size > 0) {
      const batch = writeBatch(db);
      docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      const next = await getDocs(query(collection(db, colPath), limit(batchSize)));
      if (next.size === 0) break;
    }
  };

  await deleteCollection('deals');
  await deleteCollection('requests');
  await deleteCollection('profiles');
  const fy = new Date().getFullYear() + (new Date().getMonth() >= 3 ? 0 : -1);
  await setDoc(doc(db, 'stats', 'deals'), { totalValue: 0, updatedAt: Date.now() });
  await setDoc(doc(db, 'stats', 'referralRevenue'), { totalValue: 0, updatedAt: Date.now() });
  await setDoc(doc(db, 'settings', 'revenue'), { target: 0, financialYear: `FY ${String(fy).slice(-2)}-${String(fy + 1).slice(-2)}`, updatedBy: adminUid, updatedAt: Date.now(), createdAt: Date.now() });
}

// ─── Admin ───

export async function getAllUsers(max = 999): Promise<UserProfile[]> {
  const snap = await getDocs(query(collection(db, 'users'), limit(max)));
  return snap.docs.map((d) => d.data() as UserProfile);
}

export async function setUserRole(uid: string, role: 'user' | 'admin' | 'super_admin') {
  await requireSuperAdmin();
  await updateDoc(doc(db, 'users', uid), { role });
}

export async function getUserByEmail(email: string): Promise<UserProfile | null> {
  const normalized = email.toLowerCase().trim();
  const q = query(collection(db, 'users'), where('email', '>=', normalized), where('email', '<=', normalized + '\uf8ff'));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0].data() as UserProfile;
}

export async function getProfileByContactEmail(email: string): Promise<BusinessProfile | null> {
  const normalized = email.toLowerCase().trim();
  const q = query(collection(db, 'profiles'), where('contactEmail', '>=', normalized), where('contactEmail', '<=', normalized + '\uf8ff'));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0].data() as BusinessProfile;
}

export async function getProfileByPhone(phone: string): Promise<BusinessProfile | null> {
  const digits = phone.replace(/\D/g, '');
  const q = query(collection(db, 'profiles'), where('phone', '==', phone));
  const snap = await getDocs(q);
  if (!snap.empty) return fillDefaults(snap.docs[0].data());
  if (!phone.startsWith('+91-')) {
    const legacyQ = query(collection(db, 'profiles'), where('phone', '==', `+91-${digits}`));
    const legacySnap = await getDocs(legacyQ);
    if (!legacySnap.empty) return fillDefaults(legacySnap.docs[0].data());
  }
  return null;
}

export async function verifyBusinessProfile(uid: string) {
  await requireSuperAdmin();
  await updateDoc(doc(db, 'profiles', uid), { verified: true });
}

export async function deleteBusinessProfile(uid: string) {
  await requireSuperAdmin();
  await deleteDoc(doc(db, 'profiles', uid));
}

export async function getUnverifiedProfiles(): Promise<BusinessProfile[]> {
  const q = query(collection(db, 'profiles'), where('verified', '==', false));
  const snap = await getDocs(q);
  return snap.docs.map((d) => fillDefaults(d.data()));
}

// ─── Meetings & Attendance ───

export async function createMeeting(_uid: string, date: string, label: string, location: string = '') {
  await requireSuperAdmin();
  const ref = await addDoc(collection(db, 'meetings'), {
    date,
    label,
    location,
    qrCodeURL: `${window.location.origin}/attendance/scan?meetingId=PENDING`,
    active: true,
    rsvpEnabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  const qrCodeURL = `${window.location.origin}/attendance/scan?meetingId=${ref.id}`;
  await updateDoc(ref, { qrCodeURL, updatedAt: Date.now() });
  return ref.id;
}

export async function getMeetings(max = 50): Promise<Meeting[]> {
  const snap = await getDocs(query(collection(db, 'meetings'), orderBy('date', 'desc'), limit(max)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Meeting));
}

export async function getActiveMeeting(): Promise<Meeting | null> {
  const q = query(collection(db, 'meetings'), where('active', '==', true), orderBy('createdAt', 'desc'), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as Meeting;
}

export async function markAttendance(meetingId: string, uid: string, displayName: string, companyName: string) {
  const existing = query(
    collection(db, 'attendance'),
    where('meetingId', '==', meetingId),
    where('uid', '==', uid),
  );
  const snap = await getDocs(existing);
  if (!snap.empty) return { alreadyMarked: true };

  await addDoc(collection(db, 'attendance'), {
    meetingId,
    uid,
    displayName,
    companyName,
    scannedAt: Date.now(),
  });
  return { alreadyMarked: false };
}

export async function getUserAttendance(uid: string): Promise<Attendance[]> {
  const q = query(collection(db, 'attendance'), where('uid', '==', uid), orderBy('scannedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Attendance));
}

export async function getMeetingAttendance(meetingId: string): Promise<Attendance[]> {
  const q = query(collection(db, 'attendance'), where('meetingId', '==', meetingId), orderBy('scannedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Attendance));
}

// ─── Attendance Compliance (3-strike rule) ───

export async function getAttendanceCompliance(uid: string): Promise<{
  compliant: boolean;
  attendedCount: number;
  requiredCount: number;
  monthsWindow: number;
}> {
  const sixMonthsAgo = Date.now() - 180 * 24 * 60 * 60 * 1000;
  const q = query(
    collection(db, 'attendance'),
    where('uid', '==', uid),
  );
  const snap = await getDocs(q);
  const recentRecords = snap.docs.filter((d) => d.data().scannedAt >= sixMonthsAgo);
  const attendedCount = recentRecords.length;
  const requiredCount = 3;
  return {
    compliant: attendedCount >= requiredCount,
    attendedCount,
    requiredCount,
    monthsWindow: 6,
  };
}

// ─── RSVP ───

/**
 * Write an RSVP.
 *
 * The RSVP doc id is now the member's uid instead of an `addDoc` random id, so
 * responding twice updates in place instead of costing a read to find the old
 * row. The same payload is mirrored to `users/{uid}/rsvps/{meetingId}`, which is
 * what makes `getUserRSVPs` a single query instead of an N+1.
 */
export async function submitRSVP(meetingId: string, uid: string, displayName: string, companyName: string, response: 'yes' | 'no' | 'maybe', guestCount: number = 0) {
  const payload = {
    meetingId, uid, displayName, companyName, response, guestCount, respondedAt: Date.now(),
  };
  const meetingRef = doc(db, 'meetings', meetingId, 'rsvps', uid);
  const mirrorRef = doc(db, 'users', uid, 'rsvps', meetingId);

  const existed = (await getDoc(meetingRef)).exists();

  const batch = writeBatch(db);
  batch.set(meetingRef, payload);
  batch.set(mirrorRef, payload);
  await batch.commit();

  return { updated: existed };
}

/**
 * One member's RSVPs across all meetings.
 *
 * This used to be 1 + N reads (fetch every meeting, then every meeting's RSVPs)
 * and it was re-run every 30 seconds — with 50 historical meetings that is ~100
 * reads a minute for a panel showing 3 upcoming meetings. Now it reads the
 * member's own RSVP subcollection once.
 */
export async function getUserRSVPs(uid: string): Promise<MeetingRSVP[]> {
  try {
    const snap = await getDocs(
      query(collection(db, 'users', uid, 'rsvps'), orderBy('respondedAt', 'desc')),
    );
    if (!snap.empty) {
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as MeetingRSVP));
    }
  } catch {
    // Rules or offline — fall through to the scan.
  }

  // Legacy data written before the mirror existed.
  const meetings = await getMeetings();
  const results = await Promise.all(meetings.map((m) => getMeetingRSVPs(m.id)));
  return results.flat().filter((r) => r.uid === uid).sort((a, b) => b.respondedAt - a.respondedAt);
}

export async function getMeetingRSVPs(meetingId: string): Promise<MeetingRSVP[]> {
  const snap = await getDocs(collection(db, 'meetings', meetingId, 'rsvps'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as MeetingRSVP));
}

// ─── Notifications ───

/**
 * Live list of active notifications, newest first.
 *
 * Bounded to 20: the only consumer is the marquee bar, which renders a single
 * line, and this listener is mounted app-wide for the whole session. Without a
 * limit the payload grows without bound as notifications accumulate.
 */
export function subscribeToNotifications(callback: (notifs: AppNotification[]) => void) {
  const q = query(
    collection(db, 'notifications'),
    where('active', '==', true),
    orderBy('createdAt', 'desc'),
    limit(20),
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AppNotification)));
  }, (error) => {
    console.error('Notifications snapshot error:', error);
  });
}

// ─── Issue Reports ───

export async function reportIssue(data: {
  uid: string;
  userEmail: string;
  userDisplayName: string;
  companyName: string;
  page: string;
  subject: string;
  description: string;
}) {
  await addDoc(collection(db, 'issueReports'), {
    ...data,
    status: 'open',
    adminNote: '',
    replies: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}

export async function addIssueReply(issueId: string, text: string, authorUid: string, authorName: string, authorRole: IssueReply['authorRole']) {
  const reply: IssueReply = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    text,
    authorUid,
    authorName,
    authorRole,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await updateDoc(doc(db, 'issueReports', issueId), {
    replies: arrayUnion(reply),
    updatedAt: Date.now(),
  });
  const issueSnap = await getDoc(doc(db, 'issueReports', issueId));
  const issue = issueSnap.data() as IssueReport;
  if (authorRole === 'user' || authorRole === 'admin') {
    await notifyAdmins('issue_reply', `New reply on "${issue.subject}"`, `${authorName}: ${text}`, issueId);
  } else {
    await sendUserNotification(issue.uid, 'issue_reply', `Admin replied to "${issue.subject}"`, `${authorName}: ${text}`, issueId);
  }
  return reply;
}

export async function notifyAdmins(type: UserNotification['type'], title: string, message: string, relatedId: string) {
  const userSnap = await getDocs(query(collection(db, 'users'), where('role', 'in', ['admin', 'super_admin'])));
  const promises = userSnap.docs.map((d) => sendUserNotification(d.id, type, title, message, relatedId));
  await Promise.all(promises);
}

export async function getIssueReports(): Promise<IssueReport[]> {
  await requireSuperAdmin();
  const q = query(collection(db, 'issueReports'), orderBy('createdAt', 'desc'), limit(500));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as IssueReport));
}

export async function resolveIssueReport(id: string, adminNote: string) {
  await requireSuperAdmin();
  await updateDoc(doc(db, 'issueReports', id), { status: 'resolved', adminNote, updatedAt: Date.now() });
}

export async function deleteIssueReport(id: string) {
  await requireSuperAdmin();
  await deleteDoc(doc(db, 'issueReports', id));
}

export async function addNotification(text: string) {
  await requireSuperAdmin();
  await addDoc(collection(db, 'notifications'), { text, active: true, createdAt: Date.now(), updatedAt: Date.now() });
}

export async function deleteNotification(id: string) {
  await requireSuperAdmin();
  await deleteDoc(doc(db, 'notifications', id));
}

export async function deleteMeeting(id: string) {
  await requireSuperAdmin();
  await deleteDoc(doc(db, 'meetings', id));
}

/**
 * Live meeting list, newest first. Bounded to 50 — the dashboard panels only
 * render a handful of upcoming meetings, and this was previously unbounded.
 */
export function subscribeToMeetings(callback: (meetings: Meeting[]) => void) {
  const q = query(collection(db, 'meetings'), orderBy('date', 'desc'), limit(50));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Meeting)));
  }, (error) => {
    console.error('Meetings snapshot error:', error);
  });
}

// ─── Login Logs ───

export interface LoginLog {
  id: string
  uid: string
  email: string
  displayName: string
  timestamp: number
  ip?: string
}

export async function logLogin(uid: string, email: string, displayName: string, ip?: string) {
  await addDoc(collection(db, 'loginLogs'), {
    uid,
    email,
    displayName: displayName || email.split('@')[0],
    timestamp: Date.now(),
    ip: ip || '',
  });
}

export async function getLoginLogs(limitCount = 50): Promise<LoginLog[]> {
  const q = query(collection(db, 'loginLogs'), orderBy('timestamp', 'desc'), limit(limitCount));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as LoginLog));
}

// ─── Webhook / Google Sheets Sync ───

export async function saveWebhookUrl(url: string) {
  await requireSuperAdmin();
  await setDoc(doc(db, 'config', 'webhook'), { url, updatedAt: Date.now() }, { merge: true });
}

export async function getWebhookUrl(): Promise<string> {
  const snap = await getDoc(doc(db, 'config', 'webhook'));
  return snap.exists() ? (snap.data().url || '') : '';
}

export async function triggerWebhookExport(): Promise<{ ok: boolean; message: string }> {
  const uid = await requireSuperAdmin();

  const webhookSnap = await getDoc(doc(db, 'config', 'webhook'));
  if (!webhookSnap.exists() || !webhookSnap.data().url) {
    return { ok: false, message: 'No webhook URL configured. Save a URL first.' };
  }
  const webhookUrl = webhookSnap.data().url;

  try {
    const [usersSnap, profilesSnap, meetingsSnap, requestsSnap, dealsSnap, attendanceSnap, notifsSnap, logsSnap, issueSnap] = await Promise.all([
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'profiles')),
      getDocs(collection(db, 'meetings')),
      getDocs(collection(db, 'requests')),
      getDocs(collection(db, 'deals')),
      getDocs(collection(db, 'attendance')),
      getDocs(collection(db, 'notifications')),
      getDocs(collection(db, 'loginLogs')),
      getDocs(collection(db, 'issueReports')),
    ]);

    const payload = {
      exportedAt: Date.now(),
      exportedBy: uid,
      users: usersSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      profiles: profilesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      meetings: meetingsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      requests: requestsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      deals: dealsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      attendance: attendanceSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      notifications: notifsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      loginLogs: logsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      issueReports: issueSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    };

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      return { ok: false, message: `Webhook responded with status ${res.status}: ${await res.text().catch(() => '')}` };
    }

    return { ok: true, message: `Exported ${payload.users.length} users, ${payload.profiles.length} profiles, ${payload.meetings.length} meetings, ${payload.requests.length} requests, ${payload.deals.length} deals, ${payload.attendance.length} attendance records, ${payload.notifications.length} notifications, ${payload.loginLogs.length} login logs, ${payload.issueReports.length} issue reports.` };
  } catch (e) {
    return { ok: false, message: 'Webhook request failed: ' + (e instanceof Error ? e.message : e) };
  }
}

// ─── User Notifications ───

export async function sendUserNotification(uid: string, type: UserNotification['type'], title: string, message: string, relatedId: string) {
  await addDoc(collection(db, 'userNotifications'), {
    uid, type, title, message, relatedId, read: false, createdAt: Date.now(), updatedAt: Date.now(),
  });
}

export async function getMyNotifications(): Promise<UserNotification[]> {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  const q = query(collection(db, 'userNotifications'), where('uid', '==', user.uid), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as UserNotification));
}

export interface ImportProfileEntry {
  ownerName: string;
  ownerSurname?: string;
  phone: string;
  companyName: string;
  categories?: string[];
  companySize?: string;
  location?: string;
  contactEmail?: string;
  website?: string;
  description?: string;
  membershipStatus?: 'active' | 'inactive' | 'expired';
  membershipExpiry?: number;
  countryCode?: string;
}

export async function bulkImportProfiles(entries: ImportProfileEntry[]): Promise<{ success: number; errors: string[] }> {
  const errors: string[] = [];
  let success = 0;

  // Validate first, then batch. The old loop did `await getDoc` + `await setDoc`
  // per row, so a 200-row CSV cost 400 strictly serialized round-trips. Existence
  // is now one `in` query per 30-uid chunk, and the writes commit in batches of
  // 500 (Firestore's hard limit).
  const valid: { rowIndex: number; uid: string; entry: ImportProfileEntry }[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!entry.phone || !entry.ownerName || !entry.companyName) {
      errors.push(`Row ${i + 1}: Missing required fields (phone, ownerName, companyName)`);
      continue;
    }
    valid.push({ rowIndex: i, uid: entry.phone.replace(/\D/g, ''), entry });
  }

  const existingUids = new Set<string>();
  const CHUNK = 30;
  for (let i = 0; i < valid.length; i += CHUNK) {
    const chunk = valid.slice(i, i + CHUNK).map((v) => v.uid);
    if (chunk.length === 0) continue;
    const snap = await getDocs(query(collection(db, 'profiles'), where('__name__', 'in', chunk)));
    for (const d of snap.docs) existingUids.add(d.id);
  }

  const BATCH_LIMIT = 500;
  let pending = writeBatch(db);
  let pendingCount = 0;

  for (const { rowIndex, uid, entry } of valid) {
    try {
      if (existingUids.has(uid)) {
        errors.push(`Row ${rowIndex + 1}: Phone ${entry.phone} already exists (uid: ${uid})`);
        continue;
      }
      pending.set(doc(db, 'profiles', uid), {
        uid,
        ownerName: entry.ownerName,
        ownerSurname: entry.ownerSurname || '',
        phone: entry.phone.replace(/^\+91[-\s]?/, ''),
        countryCode: entry.countryCode || '+91',
        companyName: entry.companyName,
        categories: entry.categories || [],
        companySize: entry.companySize || '',
        location: entry.location || '',
        contactEmail: entry.contactEmail || '',
        website: entry.website || '',
        description: entry.description || '',
        photoURL: '',
        keywords: [],
        catalogURLs: [],
        qrCodeURL: `${window.location.origin}/profile/${uid}`,
        verified: false,
        membershipStatus: entry.membershipStatus || 'inactive',
        membershipExpiry: entry.membershipExpiry || 0,
        membershipDate: 0,
        paidDate: 0,
        dripSentDays: [],
        editCount: 0,
        locked: false,
        lastRequestsViewedAt: 0,
        referredByPhone: '',
        referredByName: '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      pendingCount++;
      success++;

      // Firestore rejects a batch over 500 writes, so commit and start a new one.
      if (pendingCount >= BATCH_LIMIT) {
        await pending.commit();
        pending = writeBatch(db);
        pendingCount = 0;
      }
    } catch (e) {
      errors.push(`Row ${rowIndex + 1}: ${e instanceof Error ? e.message : e}`);
    }
  }

  if (pendingCount > 0) await pending.commit();

  return { success, errors };
}

export async function ensureOnlineStats(): Promise<void> {
  const ref = doc(db, 'stats', 'online');
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  const q = query(collection(db, 'users'), where('onlineStatus', '==', 'online'));
  const usersSnap = await getDocs(q);
  await setDoc(ref, { count: usersSnap.size });
}

export async function getOnlineUsersCount(): Promise<number> {
  await ensureOnlineStats();
  const snap = await getDoc(doc(db, 'stats', 'online'));
  return (snap.data()?.count as number) || 0;
}

export async function getOnlineUsers(): Promise<UserProfile[]> {
  const snap = await getDocs(query(collection(db, 'users'), where('onlineStatus', '==', 'online')));
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() } as UserProfile));
}
