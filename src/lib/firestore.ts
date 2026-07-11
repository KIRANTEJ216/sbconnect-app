import {
  doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc,
  collection, query, where, orderBy, limit, increment, arrayUnion,
  addDoc, onSnapshot, runTransaction, writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { getAuth } from 'firebase/auth';

async function requireSuperAdmin(): Promise<string> {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  const email = user.email?.toLowerCase().trim() || '';
  const SUPER_ADMIN_EMAILS = ['kktej3d@gmail.com'];
  if (SUPER_ADMIN_EMAILS.includes(email)) {
    // Ensure super admin role is set in Firestore
    await ensureUserRole(user.uid, 'super_admin', email);
    return user.uid;
  }
  const snap = await getDoc(doc(db, 'users', user.uid));
  const profile = snap.data();
  const role = profile?.role;
  if (role !== 'super_admin') throw new Error('Super admin access required');
  return user.uid;
}

async function ensureUserRole(uid: string, role: string, email: string) {
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) {
    await setDoc(userRef, { uid, email, role, createdAt: Date.now() });
  } else if (snap.data().role !== role) {
    await updateDoc(userRef, { role });
  }
}
import type {
  BusinessProfile, Request, Conversation, Message,
  Interest, Deal, LeaderboardEntry, UserProfile,
  Meeting, Attendance, AppNotification, MeetingRSVP, IssueReport, IssueReply, UserNotification,
} from '../types';

export async function createBusinessProfile(
  uid: string,
  data: Omit<BusinessProfile, 'uid' | 'photoURL' | 'catalogURLs' | 'qrCodeURL' | 'verified' | 'membershipStatus' | 'membershipExpiry' | 'membershipDate' | 'paidDate' | 'dripSentDays' | 'editCount' | 'locked' | 'lastRequestsViewedAt' | 'createdAt' | 'updatedAt' | 'ownerSurname'>,
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
};

function fillDefaults(data: Record<string, unknown>): BusinessProfile {
  const migrated = { ...data } as Record<string, unknown>;
  if (migrated.catalogPDFURL && !migrated.catalogURLs) {
    migrated.catalogURLs = [migrated.catalogPDFURL as string];
  }
  delete migrated.catalogPDFURL;
  return { ...DEFAULTS, ...migrated } as unknown as BusinessProfile;
}

export async function getBusinessProfile(uid: string): Promise<BusinessProfile | null> {
  const snap = await getDoc(doc(db, 'profiles', uid));
  if (!snap.exists()) return null;
  return fillDefaults(snap.data());
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

export async function getAllProfiles(max = 999): Promise<BusinessProfile[]> {
  const q = query(collection(db, 'profiles'), limit(max));
  const snap = await getDocs(q);
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
  await requireSuperAdmin();
  await updateDoc(doc(db, 'requests', id), { status: 'closed' });
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

// ─── Interest & Deals ───

export async function expressInterest(requestId: string, uid: string, companyName: string, phone: string, message: string) {
  const reqRef = doc(db, 'requests', requestId);
  const result = await runTransaction(db, async (tx) => {
    const snap = await tx.get(reqRef);
    if (!snap.exists()) throw new Error('Request not found');
    const data = snap.data();
    if ((data.interestedUids ?? []).includes(uid)) {
      throw new Error('You have already pitched for this request');
    }
    const requestOwnerUid = data.uid;
    const requestTitle = data.title || '';
    tx.update(reqRef, {
      interestCount: increment(1),
      interestedUids: arrayUnion(uid),
    });
    const ref = doc(collection(db, 'requests', requestId, 'interests'));
    tx.set(ref, {
      requestId,
      uid,
      companyName,
      phone,
      message,
      createdAt: Date.now(),
    });
    return { refId: ref.id, requestOwnerUid, requestTitle };
  });
  sendUserNotification(result.requestOwnerUid, 'admin_message', 'New Pitch', `${companyName} pitched for "${result.requestTitle}": ${message}`, requestId).catch(() => {});
  return result.refId;
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
  await requireSuperAdmin();
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
  await updateDoc(doc(db, 'requests', requestId), { status: 'closed', awardedTo: receiverUid });
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

export async function verifyBusinessProfile(uid: string) {
  await requireSuperAdmin();
  await updateDoc(doc(db, 'profiles', uid), { verified: true });
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
  });
  const qrCodeURL = `${window.location.origin}/attendance/scan?meetingId=${ref.id}`;
  await updateDoc(ref, { qrCodeURL });
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

export async function submitRSVP(meetingId: string, uid: string, displayName: string, companyName: string, response: 'yes' | 'no' | 'maybe') {
  const existing = query(
    collection(db, 'meetings', meetingId, 'rsvps'),
    where('uid', '==', uid),
  );
  const snap = await getDocs(existing);
  if (!snap.empty) {
    await updateDoc(doc(db, 'meetings', meetingId, 'rsvps', snap.docs[0].id), { response, respondedAt: Date.now() });
    return { updated: true };
  }
  await addDoc(collection(db, 'meetings', meetingId, 'rsvps'), {
    meetingId, uid, displayName, companyName, response, respondedAt: Date.now(),
  });
  return { updated: false };
}

export async function getUserRSVPs(uid: string): Promise<MeetingRSVP[]> {
  const meetings = await getMeetings();
  const results = await Promise.all(meetings.map((m) => getMeetingRSVPs(m.id)));
  return results.flat().filter((r) => r.uid === uid).sort((a, b) => b.respondedAt - a.respondedAt);
}

export async function getMeetingRSVPs(meetingId: string): Promise<MeetingRSVP[]> {
  const snap = await getDocs(collection(db, 'meetings', meetingId, 'rsvps'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as MeetingRSVP));
}

// ─── Notifications ───

export function subscribeToNotifications(callback: (notifs: AppNotification[]) => void) {
  const q = query(collection(db, 'notifications'), where('active', '==', true), orderBy('createdAt', 'desc'));
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
  };
  await updateDoc(doc(db, 'issueReports', issueId), {
    replies: arrayUnion(reply),
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

export async function getUserIssueReports(uid: string): Promise<IssueReport[]> {
  const q = query(collection(db, 'issueReports'), where('uid', '==', uid), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as IssueReport));
}

export async function notifyAdmins(type: UserNotification['type'], title: string, message: string, relatedId: string) {
  const userSnap = await getDocs(query(collection(db, 'users'), where('role', 'in', ['admin', 'super_admin'])));
  const promises = userSnap.docs.map((d) => sendUserNotification(d.id, type, title, message, relatedId));
  await Promise.all(promises);
}

export async function getIssueReports(): Promise<IssueReport[]> {
  await requireSuperAdmin();
  const q = query(collection(db, 'issueReports'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as IssueReport));
}

export async function resolveIssueReport(id: string, adminNote: string) {
  await requireSuperAdmin();
  await updateDoc(doc(db, 'issueReports', id), { status: 'resolved', adminNote });
}

export async function deleteIssueReport(id: string) {
  await requireSuperAdmin();
  await deleteDoc(doc(db, 'issueReports', id));
}

export async function addNotification(text: string) {
  await requireSuperAdmin();
  await addDoc(collection(db, 'notifications'), { text, active: true, createdAt: Date.now() });
}

export async function toggleNotification(id: string, active: boolean) {
  await updateDoc(doc(db, 'notifications', id), { active });
}

export async function deleteNotification(id: string) {
  await requireSuperAdmin();
  await deleteDoc(doc(db, 'notifications', id));
}

export async function deleteMeeting(id: string) {
  await requireSuperAdmin();
  await deleteDoc(doc(db, 'meetings', id));
}

export function subscribeToMeetings(callback: (meetings: Meeting[]) => void) {
  const q = query(collection(db, 'meetings'), orderBy('date', 'desc'));
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
}

export async function logLogin(uid: string, email: string, displayName: string) {
  await addDoc(collection(db, 'loginLogs'), {
    uid,
    email,
    displayName: displayName || email.split('@')[0],
    timestamp: Date.now(),
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
    uid, type, title, message, relatedId, read: false, createdAt: Date.now(),
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

export async function markNotificationRead(id: string) {
  await updateDoc(doc(db, 'userNotifications', id), { read: true });
}
