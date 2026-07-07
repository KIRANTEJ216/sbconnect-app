import {
  doc, setDoc, getDoc, getDocs, updateDoc,
  collection, query, where, orderBy, increment, arrayUnion,
  addDoc, onSnapshot, runTransaction, writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import type {
  BusinessProfile, Request, Conversation, Message,
  Interest, Deal, LeaderboardEntry, UserProfile,
} from '../types';

export async function createBusinessProfile(
  uid: string,
  data: Omit<BusinessProfile, 'uid' | 'photoURL' | 'catalogPDFURL' | 'qrCodeURL' | 'verified' | 'membershipStatus' | 'membershipExpiry' | 'editCount' | 'locked' | 'createdAt' | 'updatedAt'>,
) {
  const profile: BusinessProfile = {
    ...data,
    uid,
    photoURL: '',
    catalogPDFURL: '',
    verified: false,
    qrCodeURL: `${window.location.origin}/profile/${uid}`,
    membershipStatus: 'active',
    membershipExpiry: Date.now() + 365 * 24 * 60 * 60 * 1000,
    editCount: 0,
    locked: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await setDoc(doc(db, 'profiles', uid), profile);
  return profile;
}

const DEFAULTS = {
  photoURL: '',
  catalogPDFURL: '',
  qrCodeURL: '',
  verified: false,
  membershipStatus: 'active' as const,
  ownerName: '',
  phone: '',
  categories: [] as string[],
  companySize: '',
  location: '',
  contactEmail: '',
  website: '',
  description: '',
  editCount: 0,
  locked: false,
};

function fillDefaults(data: Record<string, unknown>): BusinessProfile {
  return { ...DEFAULTS, ...data } as BusinessProfile;
}

export async function getBusinessProfile(uid: string): Promise<BusinessProfile | null> {
  const snap = await getDoc(doc(db, 'profiles', uid));
  if (!snap.exists()) return null;
  return fillDefaults(snap.data());
}

export async function updateBusinessProfile(uid: string, data: Partial<BusinessProfile>) {
  await updateDoc(doc(db, 'profiles', uid), { ...data, updatedAt: Date.now() });
}

export async function getAllProfiles(): Promise<BusinessProfile[]> {
  const snap = await getDocs(collection(db, 'profiles'));
  return snap.docs.map((d) => fillDefaults(d.data()));
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
  });
  return ref.id;
}

export async function getRequests(category?: string): Promise<Request[]> {
  const constraints = [];
  if (category) constraints.push(where('category', '==', category));
  constraints.push(orderBy('createdAt', 'desc'));
  const q = query(collection(db, 'requests'), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Request));
}

export async function getRequest(id: string): Promise<Request | null> {
  const snap = await getDoc(doc(db, 'requests', id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Request;
}

export async function closeRequest(id: string) {
  await updateDoc(doc(db, 'requests', id), { status: 'closed' });
}

export async function getAllRequests(): Promise<Request[]> {
  const snap = await getDocs(collection(db, 'requests'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Request));
}

export async function getUserRequests(uid: string): Promise<Request[]> {
  const q = query(collection(db, 'requests'), where('uid', '==', uid));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Request));
}

// ─── Interest & Deals ───

export async function expressInterest(requestId: string, uid: string, companyName: string, message: string) {
  const ref = await addDoc(collection(db, 'requests', requestId, 'interests'), {
    requestId,
    uid,
    companyName,
    message,
    createdAt: Date.now(),
  });
  await updateDoc(doc(db, 'requests', requestId), {
    interestCount: increment(1),
    interestedUids: arrayUnion(uid),
  });
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
  const dealRef = await addDoc(collection(db, 'deals'), {
    requestId,
    requestTitle,
    giverUid,
    giverCompanyName,
    receiverUid,
    receiverCompanyName,
    amount,
    createdAt: Date.now(),
  });
  await updateDoc(doc(db, 'requests', requestId), {
    status: 'closed',
    awardedTo: receiverUid,
  });
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
  const ref = await addDoc(collection(db, 'deals'), {
    requestId: '',
    requestTitle: description || 'Direct Deal',
    giverUid,
    giverCompanyName,
    receiverUid,
    receiverCompanyName,
    amount,
    createdAt: Date.now(),
  });
  return ref.id;
}

export async function getTotalBusinessValue(): Promise<number> {
  const snap = await getDocs(collection(db, 'deals'));
  let total = 0;
  for (const d of snap.docs) {
    const amount = parseFloat(String(d.data().amount || '0').replace(/[^0-9.]/g, '')) || 0;
    total += amount;
  }
  return total;
}

export async function getUserDealStats(uid: string): Promise<{ given: number; got: number; givenCount: number; gotCount: number }> {
  const snap = await getDocs(collection(db, 'deals'));
  let given = 0, got = 0, givenCount = 0, gotCount = 0;
  for (const d of snap.docs) {
    const data = d.data();
    const amount = parseFloat(String(data.amount || '0').replace(/[^0-9.]/g, '')) || 0;
    if (data.giverUid === uid) { given += amount; givenCount++; }
    if (data.receiverUid === uid) { got += amount; gotCount++; }
  }
  return { given, got, givenCount, gotCount };
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const snap = await getDocs(collection(db, 'deals'));
  const deals = snap.docs.map((d) => d.data() as Deal);
  const map = new Map<string, { companyName: string; totalRevenue: number; dealCount: number }>();
  for (const d of deals) {
    const amount = parseFloat(d.amount.replace(/[^0-9.]/g, '')) || 0;
    const entry = map.get(d.giverUid) || { companyName: d.giverCompanyName, totalRevenue: 0, dealCount: 0 };
    entry.totalRevenue += amount;
    entry.dealCount += 1;
    map.set(d.giverUid, entry);
  }
  const uids = Array.from(map.keys());
  const ownerMap = new Map<string, string>();
  const profileSnaps = await Promise.all(uids.map((uid) => getDoc(doc(db, 'profiles', uid))));
  for (const ps of profileSnaps) {
    if (ps.exists()) {
      const data = ps.data();
      ownerMap.set(ps.id, data.ownerName || '');
    }
  }
  return Array.from(map.entries())
    .map(([uid, e]) => ({ uid, companyName: e.companyName, ownerName: ownerMap.get(uid) || '', totalRevenue: e.totalRevenue, dealCount: e.dealCount }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue);
}

export async function getDeals(): Promise<Deal[]> {
  const snap = await getDocs(collection(db, 'deals'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Deal));
}

export async function getUserDeals(uid: string): Promise<Deal[]> {
  const giverQ = query(collection(db, 'deals'), where('giverUid', '==', uid));
  const receiverQ = query(collection(db, 'deals'), where('receiverUid', '==', uid));
  const [giverSnap, receiverSnap] = await Promise.all([getDocs(giverQ), getDocs(receiverQ)]);
  return [
    ...giverSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Deal)),
    ...receiverSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Deal)),
  ];
}

// ─── Chat ───

export async function getOrCreateConversation(uid1: string, uid2: string): Promise<string> {
  const q = query(
    collection(db, 'conversations'),
    where('participants', 'array-contains', uid1),
  );
  const snap = await getDocs(q);
  const existing = snap.docs.find((d) => {
    const p = d.data().participants as string[];
    return p.includes(uid1) && p.includes(uid2);
  });
  if (existing) return existing.id;

  const ref = await addDoc(collection(db, 'conversations'), {
    participants: [uid1, uid2],
    participantNames: {},
    participantPhotos: {},
    lastMessage: '',
    lastMessageAt: Date.now(),
    lastSenderId: '',
    unreadCount: { [uid1]: 0, [uid2]: 0 },
    createdAt: Date.now(),
  });
  return ref.id;
}

export async function sendMessage(conversationId: string, senderId: string, text: string) {
  const convRef = doc(db, 'conversations', conversationId);
  const msgRef = doc(collection(db, 'conversations', conversationId, 'messages'));
  await runTransaction(db, async (transaction) => {
    const convSnap = await transaction.get(convRef);
    if (!convSnap.exists()) throw new Error('Conversation not found');

    const convData = convSnap.data();
    const participants = convData.participants as string[];
    const unreadCount = { ...(convData.unreadCount ?? {}) } as Record<string, number>;
    const otherUid = participants.find((p: string) => p !== senderId);
    if (otherUid) {
      unreadCount[otherUid] = (unreadCount[otherUid] || 0) + 1;
    }

    transaction.set(msgRef, {
      senderId,
      text,
      timestamp: Date.now(),
      read: false,
    });
    transaction.update(convRef, {
      lastMessage: text,
      lastMessageAt: Date.now(),
      lastSenderId: senderId,
      unreadCount,
    });
  });
}

export function subscribeToConversations(uid: string, callback: (convs: Conversation[]) => void) {
  const q = query(
    collection(db, 'conversations'),
    where('participants', 'array-contains', uid),
    orderBy('lastMessageAt', 'desc'),
  );
  return onSnapshot(q, (snap) => {
    const convs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Conversation));
    callback(convs);
  });
}

export function subscribeToMessages(conversationId: string, callback: (msgs: Message[]) => void) {
  const q = query(
    collection(db, 'conversations', conversationId, 'messages'),
    orderBy('timestamp', 'asc'),
  );
  return onSnapshot(q, (snap) => {
    const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Message));
    callback(msgs);
  });
}

export async function markConversationRead(conversationId: string, uid: string) {
  const convRef = doc(db, 'conversations', conversationId);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(convRef);
    if (!snap.exists()) return;
    const unreadCount = { ...snap.data().unreadCount } as Record<string, number>;
    unreadCount[uid] = 0;
    transaction.update(convRef, { unreadCount });
  });
}

export async function markMessageRead(conversationId: string, messageId: string) {
  await updateDoc(doc(db, 'conversations', conversationId, 'messages', messageId), { read: true });
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export async function deleteOldMessages(conversationId: string) {
  const cutoff = Date.now() - THIRTY_DAYS_MS;
  const q = query(
    collection(db, 'conversations', conversationId, 'messages'),
    where('timestamp', '<', cutoff),
  );
  const snap = await getDocs(q);
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

// ─── Admin ───

export async function getAllUsers(): Promise<UserProfile[]> {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map((d) => d.data() as UserProfile);
}

export async function setUserRole(uid: string, role: 'user' | 'admin' | 'super_admin') {
  await updateDoc(doc(db, 'users', uid), { role });
}

export async function getUserByEmail(email: string): Promise<UserProfile | null> {
  const q = query(collection(db, 'users'), where('email', '==', email));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0].data() as UserProfile;
}

export async function verifyBusinessProfile(uid: string) {
  await updateDoc(doc(db, 'profiles', uid), { verified: true });
}

export async function getUnverifiedProfiles(): Promise<BusinessProfile[]> {
  const q = query(collection(db, 'profiles'), where('verified', '==', false));
  const snap = await getDocs(q);
  return snap.docs.map((d) => fillDefaults(d.data()));
}
