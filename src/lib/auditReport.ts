import {
  getAllProfiles,
  getAllUsers,
  getMeetings,
  getDeals,
  getLoginLogs,
  getTotalBusinessValue,
  getLeaderboard,
} from './firestore';
import { getAttendanceCompliance } from './firestore';
import type { MeetingRSVP } from '../types';

export async function generateAuditReport() {
  const startedAt = Date.now();

  const [profiles, users, meetings, deals, logs, totalBusinessValue, leaderboard] = await Promise.all([
    getAllProfiles(999),
    getAllUsers(999),
    getMeetings(999),
    getDeals(),
    getLoginLogs(999),
    getTotalBusinessValue(),
    getLeaderboard(),
  ]);

  const activeProfiles = profiles.filter((p) => p.membershipStatus === 'active');
  const expiredProfiles = profiles.filter((p) => p.membershipStatus !== 'active');
  const verifiedProfiles = profiles.filter((p) => p.verified);
  const unverifiedProfiles = profiles.filter((p) => !p.verified);

  const complianceResults: {
    uid: string;
    companyName: string;
    ownerName: string;
    compliant: boolean;
    attendedCount: number;
    requiredCount: number;
  }[] = [];

  for (const p of profiles) {
    try {
      const c = await getAttendanceCompliance(p.uid);
      complianceResults.push({
        uid: p.uid,
        companyName: p.companyName,
        ownerName: p.ownerName,
        compliant: c.compliant,
        attendedCount: c.attendedCount,
        requiredCount: c.requiredCount,
      });
    } catch {
      // skip
    }
  }

  const nonCompliant = complianceResults.filter((c) => !c.compliant);

  const dealsByMember: Record<string, { companyName: string; dealsGiven: number; dealsReceived: number; totalAmount: number }> = {};
  for (const d of deals) {
    const amount = parseFloat(String(d.amount || '0').replace(/[^0-9.]/g, '')) || 0;
    if (!dealsByMember[d.giverUid]) {
      const p = profiles.find((bp) => bp.uid === d.giverUid);
      dealsByMember[d.giverUid] = { companyName: p?.companyName || d.giverCompanyName, dealsGiven: 0, dealsReceived: 0, totalAmount: 0 };
    }
    dealsByMember[d.giverUid].dealsGiven++;
    dealsByMember[d.giverUid].totalAmount += amount;
    if (!dealsByMember[d.receiverUid]) {
      const p = profiles.find((bp) => bp.uid === d.receiverUid);
      dealsByMember[d.receiverUid] = { companyName: p?.companyName || d.receiverCompanyName, dealsGiven: 0, dealsReceived: 0, totalAmount: 0 };
    }
    dealsByMember[d.receiverUid].dealsReceived++;
  }

  const admins = users.filter((u) => u.role === 'admin' || u.role === 'super_admin');

  const memberRsvpMap: Record<string, { meetingId: string; meetingLabel: string; response: string; respondedAt: number }[]> = {};
  for (const m of meetings) {
    try {
      const { getDocs, collection } = await import('firebase/firestore');
      const { db } = await import('./firebase');
      const snap = await getDocs(collection(db, 'meetings', m.id, 'rsvps'));
      snap.docs.forEach((d) => {
        const data = d.data() as MeetingRSVP;
        if (!memberRsvpMap[data.uid]) memberRsvpMap[data.uid] = [];
        memberRsvpMap[data.uid].push({
          meetingId: m.id,
          meetingLabel: m.label,
          response: data.response,
          respondedAt: data.respondedAt,
        });
      });
    } catch { /* skip */ }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    generatedAtReadable: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
    generatedBy: 'SB Connect Admin',
    summary: {
      totalMembers: profiles.length,
      activeMembers: activeProfiles.length,
      expiredMembers: expiredProfiles.length,
      verifiedMembers: verifiedProfiles.length,
      unverifiedMembers: unverifiedProfiles.length,
      totalUsers: users.length,
      adminCount: admins.length,
      totalMeetings: meetings.length,
      totalMeetingsHeld: meetings.filter((m) => !m.active).length,
      upcomingMeetings: meetings.filter((m) => m.active).length,
      totalDeals: deals.length,
      totalBusinessValue: totalBusinessValue,
      totalLogins: logs.length,
    },
    compliance: {
      totalChecked: complianceResults.length,
      compliant: complianceResults.filter((c) => c.compliant).length,
      nonCompliantCount: nonCompliant.length,
      nonCompliantMembers: nonCompliant.map((c) => ({
        companyName: c.companyName,
        ownerName: c.ownerName,
        attendedCount: c.attendedCount,
        requiredCount: c.requiredCount,
      })),
    },
    members: profiles.map((p) => {
      const daysLeft = Math.floor((p.membershipExpiry - Date.now()) / (1000 * 60 * 60 * 24));
      const comp = complianceResults.find((c) => c.uid === p.uid);
      const rsvps = memberRsvpMap[p.uid] || [];
      return {
        companyName: p.companyName,
        ownerName: [p.ownerName, p.ownerSurname].filter(Boolean).join(' '),
        email: p.contactEmail,
        phone: p.phone,
        location: p.location,
        categories: p.categories,
        verified: p.verified,
        membershipStatus: p.membershipStatus,
        memberSince: new Date(p.membershipDate > 0 ? p.membershipDate : p.createdAt).toLocaleDateString('en-IN'),
        membershipExpiry: new Date(p.membershipExpiry).toLocaleDateString('en-IN'),
        daysLeft: daysLeft > 0 ? daysLeft : 0,
        expired: daysLeft <= 0,
        attendanceCompliant: comp?.compliant ?? false,
        meetingsAttended: comp?.attendedCount ?? 0,
        rsvps: rsvps.length,
      };
    }),
    meetings: meetings.map((m) => ({
      label: m.label,
      date: m.date,
      location: m.location,
      active: m.active,
      createdAt: new Date(m.createdAt).toLocaleString('en-IN'),
    })),
    deals,
    dealsByMember: Object.entries(dealsByMember).map(([uid, d]) => ({
      uid,
      companyName: d.companyName,
      dealsGiven: d.dealsGiven,
      dealsReceived: d.dealsReceived,
      totalAmount: d.totalAmount,
    })),
    leaderboard,
    loginActivity: logs.map((l) => ({
      name: l.displayName,
      email: l.email,
      time: new Date(l.timestamp).toLocaleString('en-IN'),
    })),
    admins: admins.map((a) => ({
      email: a.email,
      displayName: a.displayName,
      role: a.role,
    })),
    metadata: {
      generatedAt: new Date().toISOString(),
      reportDuration: Date.now() - startedAt,
    },
  };

  return report;
}

export function downloadReport(report: object) {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const filename = `sbconnect-audit-report-${dateStr}.json`;

  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return filename;
}
