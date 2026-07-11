import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getAllUsers, getUserByEmail, setUserRole, getUnverifiedProfiles, verifyBusinessProfile, getLoginLogs, createMeeting, getMeetings, getMeetingAttendance, addNotification, getMeetingRSVPs, getAllProfiles, deleteNotification, deleteMeeting, getAllRequests, deleteRequest, closeRequest, awardDeal, getIssueReports, resolveIssueReport, deleteIssueReport, addIssueReply, saveWebhookUrl, getWebhookUrl, triggerWebhookExport, sendUserNotification } from '../lib/firestore';
import { generateAuditReport, downloadReport } from '../lib/auditReport';
import { runHealthCheck, type HealthReport } from '../lib/healthCheck';
import { loadErrors, clearErrors, getRecentErrors } from '../lib/errorTracker';
import type { LoginLog } from '../lib/firestore';
import { useAllRsvpsByMeeting } from '../hooks/useFirebaseQuery';
import { formatDate, formatTime, formatCurrency } from '../lib/format';
import { isSuperAdmin } from '../lib/admin';
import type { BusinessProfile, Meeting, Attendance, MeetingRSVP, UserProfile, Request, IssueReport } from '../types';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { AnimatedPage } from '../components/motion/AnimatedPage';

import { QRCodeSVG } from 'qrcode.react';

function exportMembershipCSV(profiles: BusinessProfile[]) {
  const headers = ['Owner Name', 'Owner Surname', 'Business Name', 'Phone', 'Email', 'Member Since', 'Expiry Date', 'Days Remaining', 'Status'];
  const rows = profiles.map((p) => {
    const days = Math.floor((p.membershipExpiry - Date.now()) / (1000 * 60 * 60 * 24));
    return [
      p.ownerName,
      p.ownerSurname || '',
      p.companyName,
      p.phone,
      p.contactEmail,
      p.membershipDate > 0 ? new Date(p.membershipDate).toLocaleDateString('en-IN') : new Date(p.createdAt).toLocaleDateString('en-IN'),
      new Date(p.membershipExpiry).toLocaleDateString('en-IN'),
      String(days),
      p.membershipStatus,
    ];
  });
  const csv = [headers, ...rows].map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'membership-payments.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function exportProfilesCSV(profiles: BusinessProfile[]) {
  const headers = ['Owner Name', 'Owner Surname', 'Business Name', 'Keywords', 'Phone', 'Email', 'Membership Status', 'Membership Expiry'];
  const rows = profiles.map((p) => [
    p.ownerName,
    p.ownerSurname || '',
    p.companyName,
    (p.keywords ?? []).join('; '),
    p.phone,
    p.contactEmail,
    p.membershipStatus,
    p.membershipExpiry ? new Date(p.membershipExpiry).toLocaleDateString('en-IN') : '',
  ]);
  const csv = [headers, ...rows].map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'business-directory.csv';
  a.click();
  URL.revokeObjectURL(url);
}



export default function Admin() {
  const { user, profile } = useAuth();
  const canWrite = isSuperAdmin(user?.email, profile?.role);
  const navigate = useNavigate();
  const [pending, setPending] = useState<BusinessProfile[]>([]);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [approving, setApproving] = useState<string | null>(null);

  const [profiles, setProfiles] = useState<BusinessProfile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(true);

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [newMeetingDate, setNewMeetingDate] = useState('');
  const [newMeetingLabel, setNewMeetingLabel] = useState('');
  const [newMeetingLocation, setNewMeetingLocation] = useState('');
  const [creating, setCreating] = useState(false);
  const [meetingMsg, setMeetingMsg] = useState('');
  const [selectedMeeting, setSelectedMeeting] = useState<string | null>(null);
  const [selectedMeetingData, setSelectedMeetingData] = useState<Meeting | null>(null);
  const [meetingAttendance, setMeetingAttendance] = useState<Attendance[]>([]);
  const [meetingRsvps, setMeetingRsvps] = useState<MeetingRSVP[]>([]);
  const [attLoading, setAttLoading] = useState(false);

  const [notifText, setNotifText] = useState('');
  const [addingNotif, setAddingNotif] = useState(false);
  const [notifMsg, setNotifMsg] = useState('');
  const [allNotifs, setAllNotifs] = useState<{ id: string; text: string; active: boolean; createdAt: number }[]>([]);

  const [logs, setLogs] = useState<LoginLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const [requests, setRequests] = useState<Request[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [deletingRequestId, setDeletingRequestId] = useState<string | null>(null);
  const [closingRequestId, setClosingRequestId] = useState<string | null>(null);
  const [awardingRequest, setAwardingRequest] = useState<Request | null>(null);
  const [awardAmount, setAwardAmount] = useState('');
  const [awardingTo, setAwardingTo] = useState('');
  const [awardingLoading, setAwardingLoading] = useState(false);

  const { data: meetingRsvpMap = {} as Record<string, MeetingRSVP[]>, isLoading: rsvpMapLoading, refetch: refetchRsvps } = useAllRsvpsByMeeting();

  const [superEmail, setSuperEmail] = useState('');
  const [superSearching, setSuperSearching] = useState(false);
  const [superMsg, setSuperMsg] = useState('');
  const [admins, setAdmins] = useState<UserProfile[]>([]);
  const [adminsLoading, setAdminsLoading] = useState(false);
  const [removingAdmin, setRemovingAdmin] = useState<string | null>(null);

  const [auditLoading, setAuditLoading] = useState(false);
  const [auditStatus, setAuditStatus] = useState('');

  const [issueReports, setIssueReports] = useState<IssueReport[]>([]);
  const [issueLoading, setIssueLoading] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
  const [replyingId, setReplyingId] = useState<string | null>(null);

  const [healthReport, setHealthReport] = useState<HealthReport | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthStatus, setHealthStatus] = useState('');
  const [trackedErrors, setTrackedErrors] = useState(loadErrors());
  const [activeTab, setActiveTab] = useState('members');

  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookStatus, setWebhookStatus] = useState('');
  const [webhookSaving, setWebhookSaving] = useState(false);
  const [webhookSyncing, setWebhookSyncing] = useState(false);

  const isSuper = isSuperAdmin(user?.email, profile?.role);

  useEffect(() => {
    loadPending();
    loadProfiles();
    loadMeetings();
    loadNotifs();
    loadLogs();
    loadRequests();
    loadIssueReports();
    loadWebhookUrl();
    if (isSuper) loadAdmins();
  }, [isSuper]);

  async function loadIssueReports() {
    try { setIssueReports(await getIssueReports()); }
    catch (e) { console.error(e); }
  }

  async function loadPending() {
    setPendingLoading(true);
    try { setPending(await getUnverifiedProfiles()); }
    catch (e) { console.error(e); }
    setPendingLoading(false);
  }

  async function loadProfiles() {
    setProfilesLoading(true);
    try { setProfiles(await getAllProfiles()); }
    catch (e) { console.error(e); }
    setProfilesLoading(false);
  }

  async function loadMeetings() {
    try { setMeetings(await getMeetings()); }
    catch (e) { console.error(e); }
  }

  async function loadNotifs() {
    try {
      const { getDocs, query, collection, orderBy } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      const snap = await getDocs(query(collection(db, 'notifications'), orderBy('createdAt', 'desc')));
      setAllNotifs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as { id: string; text: string; active: boolean; createdAt: number })));
    } catch (e) { console.error(e); }
  }

  async function loadLogs() {
    setLogsLoading(true);
    try { setLogs(await getLoginLogs()); }
    catch (e) { console.error(e); }
    setLogsLoading(false);
  }

  async function loadRequests() {
    setRequestsLoading(true);
    try { setRequests(await getAllRequests()); }
    catch (e) { console.error(e); }
    setRequestsLoading(false);
  }

  const handleDeleteRequest = async (reqId: string) => {
    if (!confirm('Delete this request permanently?')) return;
    setDeletingRequestId(reqId);
    try {
      await deleteRequest(reqId);
      setRequests((prev) => prev.filter((r) => r.id !== reqId));
    } catch (e) { console.error(e); }
    setDeletingRequestId(null);
  };

  const handleCloseRequest = async (reqId: string) => {
    if (!confirm('Close this request without awarding?')) return;
    setClosingRequestId(reqId);
    try {
      await closeRequest(reqId);
      setRequests((prev) => prev.map((r) => r.id === reqId ? { ...r, status: 'closed' } : r));
    } catch (e) { console.error(e); }
    setClosingRequestId(null);
  };

  const openAwardModal = (req: Request) => {
    setAwardingRequest(req);
    setAwardAmount('');
    setAwardingTo('');
  };

  const confirmAward = async () => {
    if (!awardingRequest || !awardingTo) return;
    setAwardingLoading(true);
    try {
      const giverProfile = profiles.find((p) => p.uid === awardingRequest.uid);
      const receiverProfile = profiles.find((p) => p.uid === awardingTo);
      await awardDeal(
        awardingRequest.id,
        awardingRequest.title,
        awardingRequest.uid,
        giverProfile?.companyName || awardingRequest.companyName,
        awardingTo,
        receiverProfile?.companyName || awardingTo.slice(0, 8),
        awardAmount,
      );
      setRequests((prev) => prev.map((r) => r.id === awardingRequest.id ? { ...r, status: 'closed', awardedTo: awardingTo } : r));
      setAwardingRequest(null);
    } catch (e) { console.error(e); }
    setAwardingLoading(false);
  };

  const handleApprove = async (uid: string) => {
    setApproving(uid);
    try {
      await verifyBusinessProfile(uid);
      setPending((prev) => prev.filter((p) => p.uid !== uid));
    } catch (e) { console.error(e); }
    setApproving(null);
  };

  const handleCreateMeeting = async () => {
    if (!newMeetingDate || !newMeetingLabel.trim() || !user) return;
    setCreating(true);
    setMeetingMsg('');
    try {
      await createMeeting(user.uid, newMeetingDate, newMeetingLabel.trim(), newMeetingLocation.trim());
      await addNotification(`📅 ${newMeetingLabel.trim()} — ${new Date(newMeetingDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}${newMeetingLocation.trim() ? ` at ${newMeetingLocation.trim()}` : ''}`);
      setMeetingMsg('Meeting created!');
      setNewMeetingDate('');
      setNewMeetingLabel('');
      setNewMeetingLocation('');
      loadMeetings();
      loadNotifs();
    } catch (e) { console.error(e); setMeetingMsg('Failed to create meeting.'); }
    setCreating(false);
  };

  const handleViewMeeting = async (meetingId: string) => {
    setSelectedMeeting(meetingId);
    const data = meetings.find((m) => m.id === meetingId) || null;
    setSelectedMeetingData(data);
    setAttLoading(true);
    try {
      const [a, r] = await Promise.all([getMeetingAttendance(meetingId), getMeetingRSVPs(meetingId)]);
      setMeetingAttendance(a);
      setMeetingRsvps(r);
    } catch (e) { console.error(e); }
    setAttLoading(false);
  };

  const handleAddNotif = async () => {
    if (!notifText.trim()) return;
    setAddingNotif(true);
    setNotifMsg('');
    try {
      await addNotification(notifText.trim());
      setNotifMsg('Notification added!');
      setNotifText('');
      loadNotifs();
    } catch (e) { console.error(e); setNotifMsg('Failed to add notification.'); }
    setAddingNotif(false);
  };

  async function loadAdmins() {
    setAdminsLoading(true);
    try {
      const all = await getAllUsers();
      setAdmins(all.filter((u) => u.role === 'admin' || u.role === 'super_admin'));
    } catch (e) { console.error(e); }
    setAdminsLoading(false);
  }

  const handleRemoveAdmin = async (uid: string) => {
    setRemovingAdmin(uid);
    try {
      await setUserRole(uid, 'user');
      setAdmins((prev) => prev.filter((a) => a.uid !== uid));
    } catch (e) { console.error(e); }
    setRemovingAdmin(null);
  };

  const handleSuperAdd = async () => {
    if (!superEmail.trim()) return;
    setSuperSearching(true);
    setSuperMsg('');
    try {
      const u = await getUserByEmail(superEmail.trim());
      if (!u) { setSuperMsg('No user found with that email.'); return; }
      if (u.role === 'admin' || u.role === 'super_admin') { setSuperMsg(`${u.displayName || u.email} is already ${u.role}.`); return; }
      await setUserRole(u.uid, 'admin');
      setSuperMsg(`${u.displayName || u.email} promoted to admin.`);
      setSuperEmail('');
      loadAdmins();
    } catch (err) { console.error(err); setSuperMsg('Failed to find user.'); }
    finally { setSuperSearching(false); }
  };

  async function loadWebhookUrl() {
    try { setWebhookUrl(await getWebhookUrl()); }
    catch (e) { console.error(e); }
  }

  const handleSaveWebhook = async () => {
    setWebhookSaving(true);
    setWebhookStatus('');
    try {
      await saveWebhookUrl(webhookUrl.trim());
      setWebhookStatus('Webhook URL saved.');
    } catch (e) {
      setWebhookStatus('Failed to save: ' + (e instanceof Error ? e.message : e));
    }
    setWebhookSaving(false);
  };

  const handleSyncNow = async () => {
    setWebhookSyncing(true);
    setWebhookStatus('');
    try {
      const res = await triggerWebhookExport();
      setWebhookStatus(res.ok ? '✓ ' + res.message : '✗ ' + res.message);
    } catch (e) {
      setWebhookStatus('Sync failed: ' + (e instanceof Error ? e.message : e));
    }
    setWebhookSyncing(false);
  };

  const tabs = [
    { id: 'members', label: 'Members', icon: '👥' },
    { id: 'meetings', label: 'Meetings', icon: '📅' },
    { id: 'updates', label: 'Updates', icon: '🔔' },
    { id: 'requests', label: 'Requests', icon: '📋' },
    { id: 'reports', label: 'Reports', icon: '📊' },
    { id: 'security', label: 'Security', icon: '🔑' },
  ] as const;

  return (
    <AnimatedPage>
    <div className="max-w-5xl mx-auto">
      <div className="mb-4">
        <h1 className="text-fluid-h1 font-bold text-charcoal tracking-tight">Admin Panel</h1>
        <p className="text-steel mt-1">Manage users, roles, profiles, meetings & notifications</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-0.5 border-b border-border mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors relative ${
              activeTab === tab.id
                ? 'text-primary bg-white border-t border-x border-border shadow-sm'
                : 'text-muted hover:text-charcoal hover:bg-muted-bg'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {!canWrite && (
        <div className="px-4 py-2 bg-warning-light/30 border border-warning/20 rounded-lg text-xs text-warning font-medium flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.29 3.86l-8.09 14A1 1 0 0 0 3 19h18a1 1 0 0 0 .8-1.6l-8.09-14a1 1 0 0 0-1.72 0z" /></svg>
          Read-only view — only Super Admin can modify data.
        </div>
      )}

      {/* ── Members Tab ── */}
      {activeTab === 'members' && (
        <div className="space-y-6">
          {/* Verification Requests */}
          <Card>
            <div className="stat-accent-top">
              <CardHeader>
                <h3 className="font-semibold text-charcoal tracking-tight">🛡️ Verification Requests{pending.length > 0 ? ` (${pending.length})` : ''}</h3>
              </CardHeader>
            </div>
            <CardContent>
              {pendingLoading ? (
                <div className="skeleton h-24 rounded-xl" />
              ) : pending.length === 0 ? (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-success-light/30 border border-success/20">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-success shrink-0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <p className="text-sm text-success font-medium">No pending verification requests.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pending.map((p) => (
                    <div key={p.uid} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-border">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-12 h-12 bg-warning-light rounded-2xl flex items-center justify-center text-warning font-bold shrink-0">
                          {p.companyName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-charcoal text-sm truncate">{p.companyName}</p>
                          <p className="text-xs text-muted font-mono mt-0.5 truncate">{p.contactEmail}</p>
                          <p className="text-xs text-steel mt-0.5">{p.location}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" variant="outline" onClick={() => navigate(`/profile/${p.uid}`)}>View</Button>
                        {canWrite && (
                          <Button size="sm" onClick={() => handleApprove(p.uid)} loading={approving === p.uid}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            Approve
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Business Directory */}
          <Card>
            <div className="stat-accent-top">
              <CardHeader>
                <h3 className="font-semibold text-charcoal tracking-tight">👥 Business Directory ({profiles.length})</h3>
              </CardHeader>
            </div>
            <CardContent>
              {profilesLoading ? (
                <div className="skeleton h-48 rounded-xl" />
              ) : profiles.length === 0 ? (
                <p className="text-sm text-muted text-center py-8">No business profiles yet.</p>
              ) : (
                <>
                <div className="flex justify-end mb-3">
                  <Button size="sm" variant="outline" onClick={() => exportProfilesCSV(profiles)}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Export CSV
                  </Button>
                </div>
                <div className="overflow-x-auto -mx-4 sm:mx-0 max-h-80 overflow-y-auto">
                  <table className="w-full text-sm min-w-[500px]">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th className="px-4 py-3 font-medium text-muted font-mono tracking-tight text-xs">Company</th>
                        <th className="px-4 py-3 font-medium text-muted font-mono tracking-tight text-xs">Name</th>
                        <th className="px-4 py-3 font-medium text-muted font-mono tracking-tight text-xs hidden sm:table-cell">Surname</th>
                        <th className="px-4 py-3 font-medium text-muted font-mono tracking-tight text-xs hidden sm:table-cell">Phone</th>
                        <th className="px-4 py-3 font-medium text-muted font-mono tracking-tight text-xs hidden sm:table-cell">Email</th>
                        <th className="px-4 py-3 font-medium text-muted font-mono tracking-tight text-xs hidden sm:table-cell">Keywords</th>
                        <th className="px-4 py-3 font-medium text-muted font-mono tracking-tight text-xs">Status</th>
                        <th className="px-4 py-3 font-medium text-muted font-mono tracking-tight text-xs">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {profiles.map((p) => (
                        <tr key={p.uid} className="hover:bg-canvas/50 transition-colors">
                          <td className="px-4 py-3 font-medium text-charcoal text-xs max-w-[140px] truncate">{p.companyName}</td>
                          <td className="px-4 py-3 text-steel text-xs">{p.ownerName || '—'}</td>
                          <td className="px-4 py-3 text-steel text-xs hidden sm:table-cell">{p.ownerSurname || '—'}</td>
                          <td className="px-4 py-3 text-steel text-xs font-mono hidden sm:table-cell">{p.phone}</td>
                          <td className="px-4 py-3 text-steel text-xs font-mono truncate max-w-[140px] hidden sm:table-cell">{p.contactEmail}</td>
                          <td className="px-4 py-3 text-steel text-xs max-w-[120px] truncate hidden sm:table-cell">{(p.keywords ?? []).slice(0, 3).join(', ')}{(p.keywords ?? []).length > 3 ? '..' : ''}</td>
                          <td className="px-4 py-3"><Badge variant={p.verified ? 'success' : 'neutral'}>{p.verified ? 'Verified' : 'Pending'}</Badge></td>
                          <td className="px-4 py-3">
                            <Button size="sm" variant="outline" onClick={() => navigate(`/profile/${p.uid}`)}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Membership Expiry */}
          <Card>
            <div className="stat-accent-top">
              <CardHeader>
                <h3 className="font-semibold text-charcoal tracking-tight">💳 Membership Expiry ({profiles.length})</h3>
              </CardHeader>
            </div>
            <CardContent>
              {profilesLoading ? (
                <div className="skeleton h-48 rounded-xl" />
              ) : (
                <>
                <div className="flex justify-end mb-3">
                  <Button size="sm" variant="outline" onClick={() => exportMembershipCSV(profiles)}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Export CSV
                  </Button>
                </div>
                <div className="overflow-x-auto -mx-4 sm:mx-0 max-h-80 overflow-y-auto">
                  <table className="w-full text-sm min-w-[600px]">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th className="px-4 py-3 font-medium text-muted font-mono tracking-tight text-xs">Business</th>
                        <th className="px-4 py-3 font-medium text-muted font-mono tracking-tight text-xs">Owner</th>
                        <th className="px-4 py-3 font-medium text-muted font-mono tracking-tight text-xs hidden sm:table-cell">Member Since</th>
                        <th className="px-4 py-3 font-medium text-muted font-mono tracking-tight text-xs">Expires</th>
                        <th className="px-4 py-3 font-medium text-muted font-mono tracking-tight text-xs">Days Left</th>
                        <th className="px-4 py-3 font-medium text-muted font-mono tracking-tight text-xs">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {profiles.map((p) => {
                        const days = Math.floor((p.membershipExpiry - Date.now()) / (1000 * 60 * 60 * 24));
                        const isExpired = days <= 0;
                        const isWarning = days <= 60 && days > 0;
                        return (
                          <tr key={p.uid} className="hover:bg-canvas/50 transition-colors">
                            <td className="px-4 py-3 font-medium text-charcoal text-xs max-w-[140px] truncate">{p.companyName}</td>
                            <td className="px-4 py-3 text-steel text-xs">{`${p.ownerName} ${p.ownerSurname || ''}`.trim() || '—'}</td>
                            <td className="px-4 py-3 text-steel text-xs font-mono hidden sm:table-cell">{formatDate(p.membershipDate > 0 ? p.membershipDate : p.createdAt)}</td>
                            <td className="px-4 py-3 text-steel text-xs font-mono">{formatDate(p.membershipExpiry)}</td>
                            <td className="px-4 py-3 text-xs font-mono">
                              <span className={`font-semibold ${isExpired ? 'text-danger' : isWarning ? 'text-warning' : 'text-success'}`}>
                                {isExpired ? 'Expired' : days}
                              </span>
                            </td>
                            <td className="px-4 py-3"><Badge variant={isExpired ? 'danger' : isWarning ? 'neutral' : 'success'}>{isExpired ? 'Expired' : p.membershipStatus}</Badge></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Meetings Tab ── */}
      {activeTab === 'meetings' && (
        <div className="space-y-6">
          {/* Meeting Management */}
          <Card>
            <div className="stat-accent-top">
              <CardHeader>
                <h3 className="font-semibold text-charcoal tracking-tight">📅 Meeting Management</h3>
              </CardHeader>
            </div>
            <CardContent>
              <div className="space-y-4">
                {canWrite && (
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <Input label="Meeting Date" type="date" value={newMeetingDate} onChange={(e) => setNewMeetingDate(e.target.value)} />
                    <Input label="Meeting Label" value={newMeetingLabel} onChange={(e) => setNewMeetingLabel(e.target.value)} placeholder="e.g. July 2026 Meeting" />
                    <Input label="Location" value={newMeetingLocation} onChange={(e) => setNewMeetingLocation(e.target.value)} placeholder="e.g. Community Hall" />
                    <div className="flex items-end">
                      <Button onClick={handleCreateMeeting} loading={creating} className="w-full sm:w-auto">Create Meeting</Button>
                    </div>
                  </div>
                )}
                {meetingMsg && <p className={`text-sm ${meetingMsg.includes('Failed') ? 'text-danger' : 'text-success'}`}>{meetingMsg}</p>}

                <div className="divide-y divide-border max-h-64 overflow-y-auto border border-border rounded-xl">
                  {meetings.length === 0 ? (
                    <p className="text-sm text-muted py-8 text-center">No meetings created yet.</p>
                  ) : (
                    meetings.map((m) => (
                      <div key={m.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-charcoal">{m.label}</p>
                          <p className="text-xs text-muted font-mono">{m.date}{m.location ? ` · ${m.location}` : ''}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={m.active ? 'success' : 'neutral'}>{m.active ? 'Active' : 'Inactive'}</Badge>
                          <Button size="sm" variant="outline" onClick={() => handleViewMeeting(m.id)} loading={attLoading && selectedMeeting === m.id}>View</Button>
                          {canWrite && <Button size="sm" variant="danger" onClick={async () => { if (!confirm(`Delete "${m.label}"?`)) return; try { await deleteMeeting(m.id); loadMeetings(); } catch (e) { alert('Failed to delete: ' + (e instanceof Error ? e.message : e)); } }}>Delete</Button>}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {selectedMeeting && selectedMeetingData && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-primary-light/40 rounded-xl p-3 text-center">
                        <p className="text-2xl font-bold text-primary">{meetingRsvps.filter((r) => r.response === 'yes').length} / {profiles.length}</p>
                        <p className="text-[11px] text-steel font-medium mt-0.5">Confirmed / Total Members</p>
                      </div>
                      <div className="bg-success-light/30 rounded-xl p-3 text-center">
                        <p className="text-2xl font-bold text-success">{meetingAttendance.length}</p>
                        <p className="text-[11px] text-steel font-medium mt-0.5">Attendance Marked</p>
                      </div>
                      <div className="bg-canvas rounded-xl p-3 text-center">
                        <p className="text-2xl font-bold text-charcoal">{meetingRsvps.length}</p>
                        <p className="text-[11px] text-steel font-medium mt-0.5">Total RSVPs</p>
                      </div>
                      <div className="bg-danger-light/30 rounded-xl p-3 text-center">
                        <p className="text-2xl font-bold text-danger">{meetingRsvps.filter((r) => r.response === 'no').length}</p>
                        <p className="text-[11px] text-steel font-medium mt-0.5">Not Going</p>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className="bg-surface border border-border rounded-xl p-4 flex flex-col items-center shrink-0">
                        <p className="text-xs font-medium text-muted font-mono mb-2 text-center">Scan to mark attendance</p>
                        <QRCodeSVG value={selectedMeetingData.qrCodeURL} size={140} />
                        <p className="text-[11px] text-muted text-center mt-2 font-mono">{selectedMeetingData.label}</p>
                      </div>
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="bg-canvas rounded-xl p-3">
                          <p className="text-xs font-medium text-muted font-mono mb-2">Attendance ({meetingAttendance.length})</p>
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {meetingAttendance.length === 0 ? (
                              <p className="text-xs text-muted text-center py-4">No attendance recorded yet.</p>
                            ) : (
                              meetingAttendance.map((a) => (
                                <div key={a.id} className="flex justify-between text-xs text-charcoal py-1">
                                  <span className="truncate">{a.displayName}</span>
                                  <span className="text-muted font-mono shrink-0 ml-2">{formatDate(a.scannedAt)}</span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                        <div className="bg-canvas rounded-xl p-3">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-medium text-muted font-mono">
                              RSVPs — <span className="text-success">Yes: {meetingRsvps.filter((r) => r.response === 'yes').length}</span> · <span className="text-danger">No: {meetingRsvps.filter((r) => r.response === 'no').length}</span> · <span className="text-accent">Maybe: {meetingRsvps.filter((r) => r.response === 'maybe').length}</span>
                            </p>
                            <Button size="sm" variant="outline" onClick={() => {
                              const headers = ['Name', 'Company', 'Response', 'Responded At'];
                              const rows = meetingRsvps.map((r) => [
                                r.displayName,
                                r.companyName || '',
                                r.response,
                                formatDate(r.respondedAt),
                              ]);
                              const csv = [headers, ...rows].map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
                              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `rsvp-${selectedMeetingData?.label.replace(/\s+/g, '-') || 'meeting'}.csv`;
                              a.click();
                              URL.revokeObjectURL(url);
                            }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                              CSV
                            </Button>
                          </div>
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {meetingRsvps.length === 0 ? (
                              <p className="text-xs text-muted text-center py-4">No RSVPs yet.</p>
                            ) : (
                              meetingRsvps.map((r) => (
                                <div key={r.id} className="flex items-center justify-between text-xs text-charcoal py-1">
                                  <span className="truncate">{r.displayName}</span>
                                  <Badge variant={r.response === 'yes' ? 'success' : r.response === 'no' ? 'neutral' : 'accent'}>{r.response}</Badge>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Meeting Attendance */}
          <Card>
            <div className="stat-accent-top">
              <CardHeader>
                <h3 className="font-semibold text-charcoal tracking-tight">✅ Meeting Attendance ({meetings.length})</h3>
              </CardHeader>
            </div>
            <CardContent>
              {rsvpMapLoading ? (
                <div className="skeleton h-48 rounded-xl" />
              ) : meetings.length === 0 ? (
                <p className="text-sm text-muted text-center py-8">No meetings created yet.</p>
              ) : (
                <>
                <div className="flex justify-end gap-2 mb-3">
                  <Button size="sm" variant="outline" onClick={() => {
                    const allRows: { meeting: string; date: string; member: string; company: string; response: string; respondedAt: string }[] = [];
                    Object.entries(meetingRsvpMap).forEach(([meetingId, rsvps]) => {
                      const m = meetings.find((x) => x.id === meetingId);
                      rsvps.forEach((r) => {
                        allRows.push({
                          meeting: m?.label || meetingId,
                          date: m ? new Date(m.date).toLocaleDateString('en-IN') : '',
                          member: r.displayName,
                          company: r.companyName || '',
                          response: r.response,
                          respondedAt: new Date(r.respondedAt).toLocaleString('en-IN'),
                        });
                      });
                    });
                    allRows.sort((a, b) => new Date(b.respondedAt).getTime() - new Date(a.respondedAt).getTime());
                    const headers = ['Meeting', 'Date', 'Member', 'Company', 'Response', 'Responded At'];
                    const csv = [headers, ...allRows.map((r) => Object.values(r).map((c) => `"${c.replace(/"/g, '""')}"`))].map((r) => r.join(',')).join('\n');
                    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'meeting-attendance-detailed.csv';
                    a.click();
                    URL.revokeObjectURL(url);
                  }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Export CSV
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => refetchRsvps()} loading={rsvpMapLoading}>Refresh</Button>
                </div>
                <div className="overflow-x-auto -mx-4 sm:mx-0 max-h-[600px] overflow-y-auto">
                  <table className="w-full text-sm min-w-[650px]">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th className="px-4 py-3 font-medium text-muted font-mono tracking-tight text-xs">Meeting</th>
                        <th className="px-4 py-3 font-medium text-muted font-mono tracking-tight text-xs">Date</th>
                        <th className="px-4 py-3 font-medium text-muted font-mono tracking-tight text-xs">Member</th>
                        <th className="px-4 py-3 font-medium text-muted font-mono tracking-tight text-xs">Company</th>
                        <th className="px-4 py-3 font-medium text-muted font-mono tracking-tight text-xs">Response</th>
                        <th className="px-4 py-3 font-medium text-muted font-mono tracking-tight text-xs">Responded At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {meetings.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((m) => {
                        const rsvps = meetingRsvpMap[m.id] || [];
                        if (rsvps.length === 0) {
                          return (
                            <tr key={m.id} className="hover:bg-canvas/50 transition-colors">
                              <td className="px-4 py-3 font-medium text-charcoal text-xs" colSpan={6}>
                                <span className="text-muted italic">{m.label} — No RSVPs yet</span>
                              </td>
                            </tr>
                          );
                        }
                        return rsvps.map((r) => (
                          <tr key={r.id} className="hover:bg-canvas/50 transition-colors">
                            <td className="px-4 py-3 font-medium text-charcoal text-xs whitespace-nowrap">{m.label}</td>
                            <td className="px-4 py-3 text-steel text-xs font-mono whitespace-nowrap">{new Date(m.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                            <td className="px-4 py-3 text-xs text-charcoal">{r.displayName}</td>
                            <td className="px-4 py-3 text-xs text-steel">{r.companyName || '—'}</td>
                            <td className="px-4 py-3">
                              <Badge variant={r.response === 'yes' ? 'success' : r.response === 'no' ? 'neutral' : 'accent'}>
                                {r.response === 'yes' ? 'Going' : r.response === 'no' ? 'Not Going' : 'Maybe'}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-xs text-muted font-mono whitespace-nowrap">{new Date(r.respondedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                          </tr>
                        ));
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-[10px] text-muted text-right mt-2">
                  {Object.values(meetingRsvpMap).reduce((sum, r) => sum + r.length, 0)} total RSVPs across all meetings
                </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Updates Tab ── */}
      {activeTab === 'updates' && (
        <div className="space-y-6">
          {/* Send Update / Notification */}
          <Card>
            <div className="stat-accent-top">
              <CardHeader>
                <h3 className="font-semibold text-charcoal tracking-tight">🔔 Send Update</h3>
              </CardHeader>
            </div>
            <CardContent>
              <div className="space-y-4">
                {canWrite && (
                  <div className="flex flex-col sm:flex-row gap-3 items-end">
                    <div className="flex-1 w-full">
                      <Input
                        label="Notification text"
                        value={notifText}
                        onChange={(e) => setNotifText(e.target.value)}
                        placeholder="e.g. Next meeting on 3rd Sunday!"
                      />
                    </div>
                    <Button onClick={handleAddNotif} loading={addingNotif} className="w-full sm:w-auto">Send Update</Button>
                  </div>
                )}
                {notifMsg && <p className={`text-sm ${notifMsg.includes('Failed') ? 'text-danger' : 'text-success'}`}>{notifMsg}</p>}

                {allNotifs.length > 0 && (
                  <div className="divide-y divide-border max-h-48 overflow-y-auto border border-border rounded-xl">
                    {allNotifs.map((n) => (
                      <div key={n.id} className="flex items-center justify-between px-4 py-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${n.active ? 'bg-success' : 'bg-muted/40'}`} />
                          <span className={`text-sm truncate ${n.active ? 'text-charcoal' : 'text-muted line-through'}`}>{n.text}</span>
                        </div>
                        {canWrite && <Button size="sm" variant="outline" onClick={async () => { if (confirm('Delete this notification?')) { await deleteNotification(n.id); loadNotifs(); } }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </Button>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Issue Reports */}
          <Card>
            <div className="stat-accent-top">
              <CardHeader>
                <h3 className="font-semibold text-charcoal tracking-tight">🐛 Issue Reports ({issueReports.length})</h3>
              </CardHeader>
            </div>
            <CardContent>
              <div className="space-y-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    setIssueLoading(true);
                    try { setIssueReports(await getIssueReports()); } catch { /* error tracked */ }
                    setIssueLoading(false);
                  }}
                  loading={issueLoading}
                >
                  Refresh
                </Button>

                {issueReports.length === 0 ? (
                  <p className="text-sm text-muted text-center py-8">No issue reports yet.</p>
                ) : (
                  <div className="divide-y divide-border max-h-96 overflow-y-auto border border-border rounded-xl">
                    {issueReports.map((r) => (
                      <div key={r.id} className="px-4 py-3 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${r.status === 'open' ? 'bg-danger' : 'bg-success'}`} />
                              <p className="text-sm font-semibold text-charcoal truncate">{r.subject}</p>
                            </div>
                            <p className="text-xs text-steel mt-0.5">{r.companyName || r.userDisplayName || r.userEmail}</p>
                          </div>
                          <Badge variant={r.status === 'open' ? 'danger' : 'success'}>
                            {r.status === 'open' ? 'Open' : 'Resolved'}
                          </Badge>
                        </div>
                        <p className="text-sm text-charcoal pl-4">{r.description}</p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted font-mono pl-4">
                          <span>Page: {r.page}</span>
                          <span>{new Date(r.createdAt).toLocaleString('en-IN')}</span>
                        </div>

                        {r.status === 'open' && (
                          <div className="flex items-center gap-2 pl-4 pt-1">
                            <input
                              type="text"
                              placeholder="Admin note (optional)..."
                              className="flex-1 min-w-0 rounded-[0.5rem] border border-border px-2.5 py-1.5 text-xs bg-surface focus:outline-none focus:ring-2 focus:ring-primary-ring"
                              id={`note-${r.id}`}
                            />
                            {canWrite && (
                              <Button
                                size="xs"
                                variant="primary"
                                onClick={async () => {
                                  const note = (document.getElementById(`note-${r.id}`) as HTMLInputElement)?.value || '';
                                  setResolvingId(r.id);
                                  try {
                                    await resolveIssueReport(r.id, note);
                                    await sendUserNotification(r.uid, 'issue_resolved', 'Issue Resolved', note ? `Your report "${r.subject}" was resolved. Admin note: ${note}` : `Your report "${r.subject}" was resolved.`, r.id);
                                    setIssueReports((prev) => prev.map((x) => x.id === r.id ? { ...x, status: 'resolved', adminNote: note } : x));
                                  } catch { /* error tracked */ }
                                  setResolvingId(null);
                                }}
                                loading={resolvingId === r.id}
                              >
                                Resolve
                              </Button>
                            )}
                            {canWrite && (
                              <Button
                                size="xs"
                                variant="outline"
                                onClick={async () => {
                                  if (!confirm('Delete this report?')) return;
                                  try { await deleteIssueReport(r.id); setIssueReports((prev) => prev.filter((x) => x.id !== r.id)); } catch { /* error tracked */ }
                                }}
                              >
                                Delete
                              </Button>
                            )}
                          </div>
                        )}

                        {(r.replies ?? []).length > 0 && (
                          <div className="pl-4 space-y-1.5 border-l-2 border-border ml-1">
                            {r.replies.map((reply) => (
                              <div key={reply.id} className="flex items-start gap-2">
                                <span className="text-[11px] font-semibold text-steel shrink-0 mt-0.5">{reply.authorName}:</span>
                                <p className="text-xs text-charcoal">{reply.text}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {canWrite && (
                          <div className="flex items-center gap-2 pl-4 pt-1">
                            <input
                              type="text"
                              placeholder="Type a reply..."
                              className="flex-1 min-w-0 rounded-[0.5rem] border border-border px-2.5 py-1.5 text-xs bg-surface focus:outline-none focus:ring-2 focus:ring-primary-ring"
                              value={replyTexts[r.id] ?? ''}
                              onChange={(e) => setReplyTexts((prev) => ({ ...prev, [r.id]: e.target.value }))}
                            />
                            <Button
                              size="xs"
                              variant="primary"
                              loading={replyingId === r.id}
                              onClick={async () => {
                                const text = replyTexts[r.id]?.trim();
                                if (!text) return;
                                setReplyingId(r.id);
                                try {
                                  const reply = await addIssueReply(r.id, text, user!.uid, user?.displayName || user?.email || 'Admin', 'super_admin');
                                  setIssueReports((prev) => prev.map((x) => x.id === r.id ? { ...x, replies: [...(x.replies ?? []), reply] } : x));
                                  setReplyTexts((prev) => ({ ...prev, [r.id]: '' }));
                                } catch { /* error tracked */ }
                                setReplyingId(null);
                              }}
                            >
                              Reply
                            </Button>
                          </div>
                        )}

                        {r.adminNote && r.status === 'resolved' && (
                          <p className="text-xs text-steel italic pl-4">Admin note: {r.adminNote}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Requests Tab ── */}
      {activeTab === 'requests' && (
        <Card>
          <div className="stat-accent-top">
            <CardHeader>
              <h3 className="font-semibold text-charcoal tracking-tight">📋 Request Activity ({requests.length})</h3>
            </CardHeader>
          </div>
          <CardContent>
            {requestsLoading ? (
              <div className="skeleton h-48 rounded-xl" />
            ) : requests.length === 0 ? (
              <p className="text-sm text-muted text-center py-8">No requests posted yet.</p>
            ) : (
              <div className="overflow-x-auto -mx-4 sm:mx-0 max-h-96 overflow-y-auto">
                <table className="w-full text-sm min-w-[600px]">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="px-4 py-3 font-medium text-muted font-mono tracking-tight text-xs">Request</th>
                      <th className="px-4 py-3 font-medium text-muted font-mono tracking-tight text-xs">Posted By</th>
                      <th className="px-4 py-3 font-medium text-muted font-mono tracking-tight text-xs">Status</th>
                      <th className="px-4 py-3 font-medium text-muted font-mono tracking-tight text-xs">Pitched By</th>
                      <th className="px-4 py-3 font-medium text-muted font-mono tracking-tight text-xs">Awarded To</th>
                      <th className="px-4 py-3 font-medium text-muted font-mono tracking-tight text-xs"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {requests
                      .sort((a, b) => b.createdAt - a.createdAt)
                      .map((req) => {
                        const profileLookup = (uid: string) => {
                          const p = profiles.find((bp) => bp.uid === uid);
                          return p ? `${p.ownerName} ${p.ownerSurname}`.trim() || p.companyName : uid.slice(0, 8) + '…';
                        };
                        return (
                        <tr key={req.id} className="hover:bg-canvas/50 transition-colors">
                          <td className="px-4 py-3 max-w-[180px]">
                            <p className="text-xs font-medium text-charcoal truncate">{req.title}</p>
                            <p className="text-[10px] text-muted font-mono mt-0.5">{req.category}{req.budget ? ` · ${formatCurrency(req.budget)}` : ''}</p>
                          </td>
                          <td className="px-4 py-3 text-xs text-steel font-mono">{req.companyName}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Badge variant={req.status === 'open' ? 'success' : 'neutral'}>{req.status === 'open' ? 'Open' : 'Closed'}</Badge>
                              {req.awardedTo && <Badge variant="success">Deal Closed</Badge>}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs">
                            {(req.interestedUids ?? []).length > 0 ? (
                              <div className="flex flex-col gap-0.5">
                                {(req.interestedUids ?? []).map((uid) => (
                                  <span key={uid} className="text-steel">{profileLookup(uid)}</span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs font-medium">
                            {req.awardedTo ? (
                              <span className="text-success">{profileLookup(req.awardedTo)}</span>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5">
                                {canWrite && !req.awardedTo && req.status === 'open' && (
                                  <>
                                    <Button size="xs" variant="primary" onClick={() => openAwardModal(req)}>
                                      Deal Closed
                                    </Button>
                                    <Button size="xs" variant="outline" onClick={() => handleCloseRequest(req.id)} loading={closingRequestId === req.id}>
                                      Close
                                    </Button>
                                    <Button size="xs" variant="outline" onClick={() => handleDeleteRequest(req.id)} loading={deletingRequestId === req.id}>
                                      Delete
                                    </Button>
                                  </>
                                )}
                              {req.awardedTo && (
                                <Badge variant="success">Deal Closed</Badge>
                              )}
                              {!req.awardedTo && req.status === 'closed' && (
                                <Badge variant="neutral">Closed</Badge>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex justify-end mt-3">
              <Button size="sm" variant="outline" onClick={loadRequests} loading={requestsLoading}>Refresh</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Reports Tab ── */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          {/* Audit & Compliance Report */}
          <Card>
            <div className="stat-accent-top">
              <CardHeader>
                <h3 className="font-semibold text-charcoal tracking-tight">📊 Audit & Compliance Report</h3>
              </CardHeader>
            </div>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-steel">
                  Generate a comprehensive audit report including member compliance (3/6 attendance rule), 
                  membership status, meeting attendance, deal activity, login logs, and role overview.
                </p>
                <div className="flex items-center gap-3">
                  <Button
                    onClick={async () => {
                      setAuditLoading(true);
                      setAuditStatus('');
                      try {
                        const report = await generateAuditReport();
                        const filename = downloadReport(report);
                        setAuditStatus(`Report saved as ${filename}`);
                      } catch (e) {
                        setAuditStatus('Failed to generate report: ' + (e instanceof Error ? e.message : e));
                      }
                      setAuditLoading(false);
                    }}
                    loading={auditLoading}
                  >
                    Generate & Download Report
                  </Button>
                </div>
                {auditStatus && (
                  <p className={`text-sm ${auditStatus.includes('Failed') ? 'text-danger' : 'text-success'}`}>
                    {auditStatus}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* System Health */}
          <Card>
            <div className="stat-accent-top">
              <CardHeader>
                <h3 className="font-semibold text-charcoal tracking-tight">🩺 System Health</h3>
              </CardHeader>
            </div>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-steel">
                  Run diagnostics to verify Firestore connectivity, data integrity, membership compliance, and track application errors.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    onClick={async () => {
                      setHealthLoading(true);
                      setHealthStatus('');
                      try {
                        const report = await runHealthCheck();
                        setHealthReport(report);
                        setTrackedErrors(loadErrors());
                        const total = report.checks.length;
                        const ok = report.checks.filter((c) => c.status === 'healthy').length;
                        setHealthStatus(`${ok}/${total} checks passed`);
                      } catch (e) {
                        setHealthStatus('Failed: ' + (e instanceof Error ? e.message : e));
                      }
                      setHealthLoading(false);
                    }}
                    loading={healthLoading}
                  >
                    Run Health Check
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { clearErrors(); setTrackedErrors([]); }}>
                    Clear Error Log
                  </Button>
                </div>
                {healthStatus && (
                  <p className={`text-sm font-medium ${healthStatus.includes('Failed') ? 'text-danger' : healthReport?.overall === 'unhealthy' ? 'text-danger' : healthReport?.overall === 'degraded' ? 'text-warning' : 'text-success'}`}>
                    {healthReport && (
                      <span className="inline-flex items-center gap-2 mr-3">
                        <span className={`w-3 h-3 rounded-full ${healthReport.overall === 'healthy' ? 'bg-success' : healthReport.overall === 'degraded' ? 'bg-warning' : 'bg-danger'}`} />
                        {healthReport.overall === 'healthy' ? 'All Systems OK' : healthReport.overall === 'degraded' ? 'Degraded' : 'Unhealthy'}
                      </span>
                    )}
                    {healthStatus}
                  </p>
                )}

                {healthReport && (
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Collection Counts</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {Object.entries(healthReport.counts).map(([col, count]) => (
                          <div key={col} className="bg-surface border border-border rounded-lg px-3 py-2 text-center">
                            <p className="text-lg font-bold text-charcoal">{count < 0 ? '—' : count}</p>
                            <p className="text-[10px] text-muted font-medium uppercase tracking-wide">{col}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Service Checks</h4>
                      <div className="divide-y divide-border border border-border rounded-xl overflow-hidden">
                        {healthReport.checks.map((check) => (
                          <div key={check.label} className="flex items-start gap-3 px-4 py-2.5">
                            <span className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${
                              check.status === 'healthy' ? 'bg-success' : check.status === 'degraded' ? 'bg-warning' : 'bg-danger'
                            }`} />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-charcoal">{check.label}</p>
                              <p className="text-xs text-steel truncate">{check.detail}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {healthReport.warnings.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                          Warnings ({healthReport.warnings.length})
                        </h4>
                        <div className="space-y-1.5">
                          {healthReport.warnings.map((w, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm text-warning px-3 py-1.5 bg-warning-light/30 rounded-lg border border-warning/20">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 shrink-0"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                              <span>{w}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {trackedErrors.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                          Recent Errors ({getRecentErrors(24).length} in 24h)
                        </h4>
                        <div className="max-h-48 overflow-y-auto divide-y divide-border border border-border rounded-xl">
                          {trackedErrors.slice(0, 20).map((e) => (
                            <div key={e.id} className="px-4 py-2">
                              <div className="flex items-start gap-2">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-danger mt-0.5 shrink-0" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                                <div className="min-w-0">
                                  <p className="text-xs text-steel font-mono break-all">{e.message}</p>
                                  <p className="text-[10px] text-muted mt-0.5">
                                    {e.source} · {new Date(e.timestamp).toLocaleString('en-IN')}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <p className="text-[10px] text-muted text-right">
                      Last checked: {new Date(healthReport.generatedAt).toLocaleString('en-IN')}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Webhook / Google Sheets Sync */}
          <Card>
            <div className="stat-accent-top">
              <CardHeader>
                <h3 className="font-semibold text-charcoal tracking-tight">🔗 Webhook / Google Sheets Sync</h3>
              </CardHeader>
            </div>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-steel">
                  Configure a webhook URL (e.g. Google Apps Script, Zapier, n8n, Make) to receive all app data as JSON. 
                  Click <strong>Sync Now</strong> to send users, profiles, meetings, requests, deals, attendance, 
                  notifications, login logs, and issue reports to the webhook.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 items-end">
                  <div className="flex-1 w-full">
                    <Input
                      label="Webhook URL"
                      type="url"
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      placeholder="https://script.google.com/macros/s/..."
                    />
                  </div>
                  {canWrite && <Button onClick={handleSaveWebhook} loading={webhookSaving} variant="outline" className="w-full sm:w-auto">Save URL</Button>}
                  {canWrite && <Button onClick={handleSyncNow} loading={webhookSyncing} className="w-full sm:w-auto">Sync Now</Button>}
                </div>
                {webhookStatus && (
                  <p className={`text-sm ${webhookStatus.startsWith('✓') ? 'text-success' : webhookStatus.startsWith('✗') || webhookStatus.includes('Failed') ? 'text-danger' : 'text-charcoal'}`}>
                    {webhookStatus}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Security Tab ── */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          {/* Login Activity */}
          <Card>
            <div className="stat-accent-top">
              <CardHeader>
                <h3 className="font-semibold text-charcoal tracking-tight">🕐 Login Activity ({logs.length})</h3>
              </CardHeader>
            </div>
            <CardContent>
              <div className="space-y-3">
                <Button variant="outline" size="sm" onClick={loadLogs} loading={logsLoading}>Refresh</Button>
                <div className="overflow-x-auto -mx-4 sm:mx-0 max-h-64 overflow-y-auto">
                  {logs.length === 0 ? (
                    <p className="text-sm text-muted text-center py-8">No login activity recorded yet.</p>
                  ) : (
                    <table className="w-full text-sm min-w-[400px]">
                      <thead>
                        <tr className="border-b border-border text-left">
                          <th className="px-4 py-2 font-medium text-muted font-mono tracking-tight text-xs">Name</th>
                          <th className="px-4 py-2 font-medium text-muted font-mono tracking-tight text-xs">Email</th>
                          <th className="px-4 py-2 font-medium text-muted font-mono tracking-tight text-xs">Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {logs.map((log) => (
                          <tr key={log.id} className="hover:bg-canvas/50 transition-colors">
                            <td className="px-4 py-2 text-charcoal text-xs">{log.displayName}</td>
                            <td className="px-4 py-2 text-steel text-xs font-mono">{log.email}</td>
                            <td className="px-4 py-2 text-muted font-mono text-[11px] whitespace-nowrap">{formatDate(log.timestamp)} {formatTime(log.timestamp)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Admins (super only) */}
          {isSuper && (
            <Card>
              <div className="stat-accent-top">
                <CardHeader>
                  <h3 className="font-semibold text-charcoal tracking-tight">🔑 Admins ({admins.length})</h3>
                </CardHeader>
              </div>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-3 items-end mb-4">
                  <div className="flex-1 w-full">
                    <Input label="Add by email" type="email" value={superEmail} onChange={(e) => setSuperEmail(e.target.value)} placeholder="user@example.com" />
                  </div>
                    {canWrite && <Button onClick={handleSuperAdd} loading={superSearching} className="w-full sm:w-auto">Add Admin</Button>}
                </div>
                {superMsg && <p className={`text-sm mb-3 ${superMsg.includes('already') || superMsg.includes('No user') || superMsg.includes('Failed') ? 'text-danger' : 'text-success'}`}>{superMsg}</p>}
                {adminsLoading ? (
                  <div className="skeleton h-24 rounded-xl" />
                ) : admins.length > 0 ? (
                  <div className="divide-y divide-border border border-border rounded-xl">
                    {admins.map((a) => (
                      <div key={a.uid} className="flex items-center justify-between px-4 py-2.5">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-charcoal truncate">{a.displayName || a.email}</p>
                          <p className="text-xs text-muted font-mono truncate">{a.email} · <Badge variant={a.role === 'super_admin' ? 'accent' : 'success'}>{a.role.replace('_', ' ')}</Badge></p>
                        </div>
                        {canWrite && a.role !== 'super_admin' && (
                          <Button size="sm" variant="outline" onClick={() => handleRemoveAdmin(a.uid)} loading={removingAdmin === a.uid}>Remove</Button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted text-center py-4">No admins found.</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── Award Deal Modal (always visible) ── */}
      {awardingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setAwardingRequest(null)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-charcoal mb-1">Close Deal</h3>
            <p className="text-xs text-muted mb-4">{awardingRequest.title}</p>
            {(awardingRequest.interestedUids ?? []).length === 0 ? (
              <p className="text-sm text-muted mb-4">No one has pitched for this request yet.</p>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-charcoal mb-1">Award to</label>
                  <select value={awardingTo} onChange={(e) => setAwardingTo(e.target.value)} className="w-full rounded-xl border border-border px-3 py-2 text-sm bg-white">
                    <option value="">Select a business…</option>
                    {(awardingRequest.interestedUids ?? []).map((uid) => {
                      const p = profiles.find((bp) => bp.uid === uid);
                      return <option key={uid} value={uid}>{p ? `${p.companyName} (${p.ownerName} ${p.ownerSurname || ''})` : uid.slice(0, 8)}</option>;
                    })}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-charcoal mb-1">Deal amount</label>
                  <input type="text" value={awardAmount} onChange={(e) => setAwardAmount(e.target.value)} placeholder="₹ 0" className="w-full rounded-xl border border-border px-3 py-2 text-sm" />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => setAwardingRequest(null)}>Cancel</Button>
                  {canWrite && <Button variant="primary" className="flex-1" onClick={confirmAward} loading={awardingLoading} disabled={!awardingTo}>Confirm Deal</Button>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
    </AnimatedPage>
  );
}
