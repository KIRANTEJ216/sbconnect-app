import { collection, getDocs, query, limit, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import { getAuth } from 'firebase/auth';
import { loadErrors } from './errorTracker';

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  label: string;
  detail: string;
  timestamp: number;
}

export interface HealthReport {
  generatedAt: number;
  overall: 'healthy' | 'degraded' | 'unhealthy';
  checks: HealthCheckResult[];
  counts: Record<string, number>;
  warnings: string[];
  errors: { message: string; source: string; time: string }[];
}

async function checkFirestoreRead(): Promise<HealthCheckResult> {
  try {
    const snap = await getDocs(query(collection(db, 'meetings'), limit(1)));
    return { status: 'healthy', label: 'Firestore Read', detail: `Can read meetings (${snap.size} found)`, timestamp: Date.now() };
  } catch (e) {
    return { status: 'unhealthy', label: 'Firestore Read', detail: `Read failed: ${e instanceof Error ? e.message : e}`, timestamp: Date.now() };
  }
}

async function checkFirestoreWrite(): Promise<HealthCheckResult> {
  const testId = `_health_${Date.now()}`;
  try {
    const ref = doc(db, '_health', testId);
    await setDoc(ref, { checkedAt: Date.now() });
    await getDoc(ref);
    await deleteDoc(ref);
    return { status: 'healthy', label: 'Firestore Write', detail: 'Write, readback, and delete succeeded', timestamp: Date.now() };
  } catch (e) {
    return { status: 'unhealthy', label: 'Firestore Write', detail: `Write/delete failed: ${e instanceof Error ? e.message : e}`, timestamp: Date.now() };
  }
}

function checkAuth(): HealthCheckResult {
  try {
    const auth = getAuth();
    const user = auth.currentUser;
    if (user) {
      return { status: 'healthy', label: 'Authentication', detail: `Authenticated as ${user.email || user.uid}`, timestamp: Date.now() };
    }
    return { status: 'degraded', label: 'Authentication', detail: 'No authenticated user', timestamp: Date.now() };
  } catch (e) {
    return { status: 'unhealthy', label: 'Authentication', detail: `Auth check failed: ${e instanceof Error ? e.message : e}`, timestamp: Date.now() };
  }
}

async function getCollectionCount(col: string): Promise<number> {
  try {
    const snap = await getDocs(collection(db, col));
    return snap.size;
  } catch {
    return -1;
  }
}

async function checkMembershipIntegrity(): Promise<HealthCheckResult> {
  try {
    const snap = await getDocs(collection(db, 'profiles'));
    let missingExpiry = 0;
    let expiredCount = 0;
    const now = Date.now();
    snap.docs.forEach((d) => {
      const data = d.data();
      if (!data.membershipExpiry) missingExpiry++;
      else if (data.membershipExpiry < now) expiredCount++;
    });
    const total = snap.size;
    const warnings: string[] = [];
    if (missingExpiry > 0) warnings.push(`${missingExpiry}/${total} profiles missing expiry`);
    if (expiredCount > 0) warnings.push(`${expiredCount}/${total} memberships expired`);
    const status = missingExpiry > 0 ? 'degraded' : 'healthy';
    const detail = `${total} profiles — ${expiredCount} expired, ${missingExpiry} missing expiry`;
    return { status, label: 'Membership Integrity', detail, timestamp: Date.now() };
  } catch (e) {
    return { status: 'unhealthy', label: 'Membership Integrity', detail: `Check failed: ${e instanceof Error ? e.message : e}`, timestamp: Date.now() };
  }
}

async function checkRSVPs(): Promise<HealthCheckResult> {
  try {
    const meetingsSnap = await getDocs(collection(db, 'meetings'));
    const meetingIds = new Set(meetingsSnap.docs.map((d) => d.id));
    let totalRsvps = 0;
    for (const m of meetingsSnap.docs) {
      const rsvpSnap = await getDocs(collection(db, 'meetings', m.id, 'rsvps'));
      totalRsvps += rsvpSnap.size;
    }
    return {
      status: 'healthy',
      label: 'RSVP Integrity',
      detail: `${totalRsvps} RSVPs across ${meetingIds.size} meetings — no orphaned records checked`,
      timestamp: Date.now(),
    };
  } catch (e) {
    return { status: 'unhealthy', label: 'RSVP Integrity', detail: `Check failed: ${e instanceof Error ? e.message : e}`, timestamp: Date.now() };
  }
}

async function checkAttendanceAgainstMeetings(): Promise<HealthCheckResult> {
  try {
    const meetingsSnap = await getDocs(collection(db, 'meetings'));
    const meetingIds = new Set(meetingsSnap.docs.map((d) => d.id));
    const attSnap = await getDocs(collection(db, 'attendance'));
    let orphaned = 0;
    let total = 0;
    attSnap.docs.forEach((d) => {
      total++;
      if (!meetingIds.has(d.data().meetingId)) orphaned++;
    });
    const status = orphaned > 0 ? 'degraded' : 'healthy';
    return {
      status,
      label: 'Attendance Integrity',
      detail: `${total} records — ${orphaned} orphaned (no matching meeting)`,
      timestamp: Date.now(),
    };
  } catch (e) {
    return { status: 'unhealthy', label: 'Attendance Integrity', detail: `Check failed: ${e instanceof Error ? e.message : e}`, timestamp: Date.now() };
  }
}

async function checkDealAmounts(): Promise<HealthCheckResult> {
  try {
    const snap = await getDocs(collection(db, 'deals'));
    let invalid = 0;
    snap.docs.forEach((d) => {
      const amount = String(d.data().amount || '');
      if (!amount || parseFloat(amount.replace(/[^0-9.]/g, '')) <= 0) invalid++;
    });
    const status = invalid > 0 ? 'degraded' : 'healthy';
    return {
      status,
      label: 'Deal Amounts',
      detail: `${snap.size} deals — ${invalid} with missing/invalid amount`,
      timestamp: Date.now(),
    };
  } catch (e) {
    return { status: 'unhealthy', label: 'Deal Amounts', detail: `Check failed: ${e instanceof Error ? e.message : e}`, timestamp: Date.now() };
  }
}

async function checkRequestCompliance(): Promise<HealthCheckResult> {
  try {
    const snap = await getDocs(collection(db, 'requests'));
    const now = Date.now();
    let overdue = 0;
    snap.docs.forEach((d) => {
      const data = d.data();
      if (data.status === 'open' && data.deadline) {
        const deadline = new Date(data.deadline).getTime();
        if (deadline < now) overdue++;
      }
    });
    const status = overdue > 0 ? 'degraded' : 'healthy';
    return {
      status,
      label: 'Request Deadlines',
      detail: `${snap.size} requests — ${overdue} open past deadline`,
      timestamp: Date.now(),
    };
  } catch (e) {
    return { status: 'unhealthy', label: 'Request Deadlines', detail: `Check failed: ${e instanceof Error ? e.message : e}`, timestamp: Date.now() };
  }
}

function checkErrors(): { message: string; source: string; time: string }[] {
  const recent = loadErrors().filter((e) => e.timestamp > Date.now() - 86400000);
  return recent.slice(0, 20).map((e) => ({
    message: e.message,
    source: e.source,
    time: new Date(e.timestamp).toLocaleString('en-IN'),
  }));
}

export async function runHealthCheck(): Promise<HealthReport> {
  const results = await Promise.all([
    checkFirestoreRead(),
    checkFirestoreWrite(),
    Promise.resolve(checkAuth()),
    checkMembershipIntegrity(),
    checkRSVPs(),
    checkAttendanceAgainstMeetings(),
    checkDealAmounts(),
    checkRequestCompliance(),
  ]);

  const counts: Record<string, number> = {};
  for (const col of ['profiles', 'users', 'meetings', 'attendance', 'deals', 'requests', 'loginLogs']) {
    counts[col] = await getCollectionCount(col);
  }

  const unhealthy = results.filter((r) => r.status === 'unhealthy');
  const degraded = results.filter((r) => r.status === 'degraded');

  const overall: 'healthy' | 'degraded' | 'unhealthy' =
    unhealthy.length > 0 ? 'unhealthy' : degraded.length > 0 ? 'degraded' : 'healthy';

  const warnings: string[] = [];
  results.forEach((r) => {
    if (r.status !== 'healthy') warnings.push(`${r.label}: ${r.detail}`);
  });

  const errors = checkErrors();
  if (errors.length > 0) warnings.push(`${errors.length} tracked errors in the last 24h`);

  return {
    generatedAt: Date.now(),
    overall,
    checks: results,
    counts,
    warnings,
    errors,
  };
}
