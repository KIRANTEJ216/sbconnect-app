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

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function toINR(n: number): string {
  return n.toLocaleString('en-IN');
}

function htmlEscape(s: string | number | boolean | undefined | null): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function generateReportHTML(report: any): string {
  const g = report.generatedAtReadable || formatDate(new Date());
  const s = report.summary;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>SB Connect Audit Report</title>
<style>
  @page { margin: 20mm 15mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', -apple-system, sans-serif; font-size: 11px; color: #1a1a2e; background: #fff; padding: 20px; }
  h1 { font-size: 20px; color: #1a1a2e; border-bottom: 2px solid #2a11a6; padding-bottom: 6px; margin-bottom: 16px; }
  h2 { font-size: 14px; color: #2a11a6; margin: 16px 0 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
  h3 { font-size: 12px; color: #444; margin: 10px 0 4px; }
  .meta { font-size: 10px; color: #888; margin-bottom: 16px; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .stat { background: #f8f6ff; border: 1px solid #e8e4f0; border-radius: 6px; padding: 8px 10px; }
  .stat .num { font-size: 18px; font-weight: 700; color: #2a11a6; }
  .stat .lbl { font-size: 9px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
  table { width: 100%; border-collapse: collapse; margin: 6px 0; font-size: 10px; }
  th { background: #f0edf7; color: #333; text-align: left; padding: 5px 6px; font-size: 9px; text-transform: uppercase; letter-spacing: 0.3px; border: 1px solid #ddd; }
  td { padding: 4px 6px; border: 1px solid #ddd; vertical-align: top; }
  tr:nth-child(even) { background: #fafafa; }
  .badge { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 9px; font-weight: 600; }
  .badge-active { background: #dcfce7; color: #166534; }
  .badge-expired { background: #fce4ec; color: #c62828; }
  .badge-inactive { background: #f5f5f5; color: #888; }
  .badge-yes { background: #dcfce7; color: #166534; }
  .badge-warn { background: #fff3cd; color: #856404; }
  .footer { margin-top: 20px; font-size: 9px; color: #aaa; text-align: center; border-top: 1px solid #eee; padding-top: 8px; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
<h1>SB Connect — Audit & Compliance Report</h1>
<p class="meta">Generated: ${htmlEscape(g)}</p>

<h2>Summary</h2>
<div class="grid2">
  <div class="stat"><div class="num">${s.totalMembers}</div><div class="lbl">Total Members</div></div>
  <div class="stat"><div class="num">${s.activeMembers}</div><div class="lbl">Active</div></div>
  <div class="stat"><div class="num">${s.expiredMembers}</div><div class="lbl">Expired</div></div>
  <div class="stat"><div class="num">${s.verifiedMembers}</div><div class="lbl">Verified</div></div>
  <div class="stat"><div class="num">${s.unverifiedMembers}</div><div class="lbl">Unverified</div></div>
  <div class="stat"><div class="num">${s.totalUsers}</div><div class="lbl">Total Users</div></div>
  <div class="stat"><div class="num">${s.adminCount}</div><div class="lbl">Admins</div></div>
  <div class="stat"><div class="num">${s.totalMeetingsHeld}</div><div class="lbl">Meetings Held</div></div>
  <div class="stat"><div class="num">${s.upcomingMeetings}</div><div class="lbl">Upcoming</div></div>
  <div class="stat"><div class="num">${s.totalDeals}</div><div class="lbl">Total Deals</div></div>
  <div class="stat"><div class="num">${toINR(s.totalBusinessValue)}</div><div class="lbl">Business Value</div></div>
  <div class="stat"><div class="num">${s.totalLogins}</div><div class="lbl">Logins</div></div>
</div>

${report.compliance ? `
<h2>Attendance Compliance (3/6 Rule)</h2>
<p style="font-size:10px;color:#666;margin-bottom:6px">Checked: ${report.compliance.totalChecked} &middot; Compliant: ${report.compliance.compliant} &middot; Non-compliant: ${report.compliance.nonCompliantCount}</p>
<table>
<tr><th>Company</th><th>Owner</th><th>Attended</th><th>Required</th><th>Status</th></tr>
${report.compliance.nonCompliantMembers.map((m: any) => `<tr><td>${htmlEscape(m.companyName)}</td><td>${htmlEscape(m.ownerName)}</td><td>${m.attendedCount}</td><td>${m.requiredCount}</td><td><span class="badge badge-warn">Non-Compliant</span></td></tr>`).join('')}
</table>` : ''}

<h2>Member Directory (${report.members.length})</h2>
<table>
<tr><th>Company</th><th>Owner</th><th>Status</th><th>Since</th><th>Expiry</th><th>Compliant</th></tr>
${report.members.map((m: any) => `<tr>
  <td>${htmlEscape(m.companyName)}</td>
  <td>${htmlEscape(m.ownerName)}</td>
  <td><span class="badge ${m.membershipStatus === 'active' ? 'badge-active' : m.membershipStatus === 'expired' ? 'badge-expired' : 'badge-inactive'}">${m.membershipStatus}</span></td>
  <td>${htmlEscape(m.memberSince)}</td>
  <td>${m.membershipExpiry && m.membershipExpiry !== '01-01-1970' ? htmlEscape(m.membershipExpiry) : '—'}</td>
  <td>${m.attendanceCompliant ? '✅' : '❌'}</td>
</tr>`).join('')}
</table>

${report.meetings && report.meetings.length > 0 ? `
<h2>Meetings (${report.meetings.length})</h2>
<table>
<tr><th>Label</th><th>Date</th><th>Location</th><th>Status</th></tr>
${report.meetings.map((m: any) => `<tr><td>${htmlEscape(m.label)}</td><td>${htmlEscape(m.date)}</td><td>${htmlEscape(m.location)}</td><td>${m.active ? 'Upcoming' : 'Past'}</td></tr>`).join('')}
</table>` : ''}

${report.deals && report.deals.length > 0 ? `
<h2>Deals (${report.deals.length})</h2>
<table>
<tr><th>Giver</th><th>Receiver</th><th>Amount</th><th>Date</th></tr>
${report.deals.map((d: any) => `<tr><td>${htmlEscape(d.giverCompanyName)}</td><td>${htmlEscape(d.receiverCompanyName)}</td><td>${toINR(parseFloat(String(d.amount||'0').replace(/[^0-9.]/g,''))||0)}</td><td>${htmlEscape(new Date(d.createdAt).toLocaleDateString('en-IN'))}</td></tr>`).join('')}
</table>` : ''}

${report.admins && report.admins.length > 0 ? `
<h2>Admins (${report.admins.length})</h2>
<table>
<tr><th>Name</th><th>Email</th><th>Role</th></tr>
${report.admins.map((a: any) => `<tr><td>${htmlEscape(a.displayName)}</td><td>${htmlEscape(a.email)}</td><td><span class="badge badge-active">${htmlEscape(a.role)}</span></td></tr>`).join('')}
</table>` : ''}

<p class="footer">SB Connect Audit Report &middot; Generated on ${htmlEscape(g)}</p>
</body>
</html>`;
}

export function downloadReport(report: object) {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const filename = `sbconnect-audit-report-${dateStr}`;

  const html = generateReportHTML(report);
  const w = window.open('', '_blank');
  if (!w) {
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename + '.html';
    a.click();
    URL.revokeObjectURL(url);
    return filename + '.html';
  }
  w.document.write(html);
  w.document.close();
  w.document.title = filename;
  w.print();
  return filename + ' (PDF via browser print)';
}
