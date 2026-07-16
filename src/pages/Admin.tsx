import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { getAllUsers, getUserByEmail, setUserRole, getUnverifiedProfiles, verifyBusinessProfile, deleteBusinessProfile, getLoginLogs, createMeeting, getMeetings, getMeetingAttendance, addNotification, getMeetingRSVPs, getAllProfiles, deleteNotification, deleteMeeting, getAllRequests, deleteRequest, closeRequest, awardDeal, getDeals, getLeaderboard, getIssueReports, resolveIssueReport, deleteIssueReport, addIssueReply, saveWebhookUrl, getWebhookUrl, triggerWebhookExport, sendUserNotification, updateMembershipDates, bulkImportProfiles, getRevenueConfig, setRevenueConfig } from '../lib/firestore';
import type { LoginLog, ImportProfileEntry } from '../lib/firestore';
import { generateAuditReport, downloadReport } from '../lib/auditReport';
import { runHealthCheck, type HealthReport } from '../lib/healthCheck';
import { loadErrors, clearErrors, getRecentErrors } from '../lib/errorTracker';
import { useAllRsvpsByMeeting } from '../hooks/useFirebaseQuery';
import { formatDate, formatTime, formatCurrency, getFinancialYear } from '../lib/format';
import { isSuperAdmin } from '../lib/admin';
import type { BusinessProfile, Meeting, Attendance, MeetingRSVP, UserProfile, Request, IssueReport, Deal, LeaderboardEntry, RevenueConfig } from '../types';
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
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<BusinessProfile[]>([]);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [approving, setApproving] = useState<string | null>(null);
  const [approveMsg, setApproveMsg] = useState('');
  const [paidDialogUid, setPaidDialogUid] = useState<string | null>(null);
  const [paidDateValue, setPaidDateValue] = useState('');
  const [paidSaving, setPaidSaving] = useState(false);

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
  const [deals, setDeals] = useState<Deal[]>([]);
  const [allLeaderboard, setAllLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [dealsLoading, setDealsLoading] = useState(false);
  const [deletingRequestId, setDeletingRequestId] = useState<string | null>(null);
  const [closingRequestId, setClosingRequestId] = useState<string | null>(null);
  const [awardingRequest, setAwardingRequest] = useState<Request | null>(null);
  const [awardAmount, setAwardAmount] = useState('');
  const [awardingTo, setAwardingTo] = useState('');
  const [awardingLoading, setAwardingLoading] = useState(false);
  const [revenueConfig, setRevenueConfigState] = useState<RevenueConfig | null>(null);
  const [revTargetInput, setRevTargetInput] = useState('');
  const [revSaving, setRevSaving] = useState(false);
  const [revMsg, setRevMsg] = useState('');

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
    loadDeals();
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
    try {
      const all = await getAllProfiles();
      all.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setProfiles(all);
    }
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

  async function loadDeals() {
    setDealsLoading(true);
    try {
      const [d, lb, rc] = await Promise.all([getDeals(), getLeaderboard(), getRevenueConfig()]);
      setDeals(d);
      setAllLeaderboard(lb);
      if (rc) {
        setRevenueConfigState(rc);
        setRevTargetInput(String(rc.target));
      }
    } catch (e) { console.error(e); }
    setDealsLoading(false);
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
    setApproveMsg('');
    try {
      await verifyBusinessProfile(uid);
      setPending((prev) => prev.filter((p) => p.uid !== uid));
      setApproveMsg('Profile verified successfully!');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to verify profile';
      console.error(e);
      setApproveMsg(msg);
    }
    setApproving(null);
  };

  const handlePaidSubmit = async () => {
    if (!paidDialogUid || !paidDateValue) return;
    setPaidSaving(true);
    try {
      await updateMembershipDates(paidDialogUid, new Date(paidDateValue).getTime());
      setProfiles((prev) => prev.map((p) =>
        p.uid === paidDialogUid
          ? { ...p, paidDate: new Date(paidDateValue).getTime(), membershipDate: new Date(paidDateValue).getTime(), membershipExpiry: new Date(paidDateValue).getTime() + 364 * 86400000, membershipStatus: 'active' as const, dripSentDays: [] }
          : p
      ));
      setPaidDialogUid(null);
      setPaidDateValue('');
    } catch (e) { console.error(e); }
    setPaidSaving(false);
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

  const handleSaveRevenue = async () => {
    if (!canWrite || !user) return;
    setRevSaving(true);
    setRevMsg('');
    try {
      const target = parseFloat(revTargetInput.replace(/[^0-9.]/g, ''));
      if (isNaN(target) || target <= 0) { setRevMsg('Enter a valid target amount.'); setRevSaving(false); return; }
      const fy = getFinancialYear().fyLabel;
      await setRevenueConfig(target, fy, user.uid);
      setRevenueConfigState({ target, financialYear: fy, updatedBy: user.uid, updatedAt: Date.now() });
      queryClient.invalidateQueries({ queryKey: ['revenueConfig'] });
      setRevMsg('Revenue target saved.');
    } catch (e) {
      setRevMsg('Failed to save: ' + (e instanceof Error ? e.message : e));
    }
    setRevSaving(false);
  };

  const tabs = [
    { id: 'members', label: 'Members', icon: '👥' },
    { id: 'meetings', label: 'Meetings', icon: '📅' },
    { id: 'updates', label: 'Updates', icon: '🔔' },
    { id: 'requests', label: 'Requests', icon: '📋' },
    { id: 'reports', label: 'Reports', icon: '📊' },
    { id: 'security', label: 'Security', icon: '🔑' },
    { id: 'referrals', label: 'Referrals', icon: '📢' },
    { id: 'deals', label: 'Deals', icon: '📈' },
    { id: 'import', label: 'Import', icon: '📥' },
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
                  {approveMsg && (
                    <div className={`px-4 py-2 rounded-lg text-sm font-medium ${approveMsg.includes('Failed') || approveMsg.includes('Error') || approveMsg.includes('required') ? 'bg-danger-light/30 border border-danger/20 text-danger' : 'bg-success-light/30 border border-success/20 text-success'}`}>
                      {approveMsg}
                    </div>
                  )}
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
                  <table className="w-full text-sm min-w-[600px]">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th className="px-4 py-3 font-medium text-muted font-mono tracking-tight text-xs">Company</th>
                        <th className="px-4 py-3 font-medium text-muted font-mono tracking-tight text-xs">Name</th>
                        <th className="px-4 py-3 font-medium text-muted font-mono tracking-tight text-xs hidden sm:table-cell">Surname</th>
                        <th className="px-4 py-3 font-medium text-muted font-mono tracking-tight text-xs hidden sm:table-cell">Phone</th>
                        <th className="px-4 py-3 font-medium text-muted font-mono tracking-tight text-xs hidden sm:table-cell">Email</th>
                        <th className="px-4 py-3 font-medium text-muted font-mono tracking-tight text-xs hidden lg:table-cell">Referred By</th>
                        <th className="px-4 py-3 font-medium text-muted font-mono tracking-tight text-xs hidden lg:table-cell">Registered</th>
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
                          <td className="px-4 py-3 text-steel text-xs hidden lg:table-cell">{p.referredByName || '—'}</td>
                          <td className="px-4 py-3 text-muted text-xs font-mono hidden lg:table-cell whitespace-nowrap">{formatDate(p.createdAt)}</td>
                          <td className="px-4 py-3"><Badge variant={p.verified ? 'success' : 'neutral'}>{p.verified ? 'Verified' : 'Pending'}</Badge></td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1.5">
                            <Button size="sm" variant="outline" onClick={() => navigate(`/profile/${p.uid}`)}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </Button>
                            {canWrite && !p.paidDate && (
                              <Button size="sm" variant="primary" onClick={() => { setPaidDialogUid(p.uid); setPaidDateValue(new Date().toISOString().split('T')[0]); }}>
                                Set Paid
                              </Button>
                            )}
                            {canWrite && (
                              <Button size="sm" variant="danger" onClick={async () => { if (!confirm(`Delete business profile for "${p.companyName}"? This cannot be undone.`)) return; try { await deleteBusinessProfile(p.uid); loadProfiles(); } catch (e) { alert('Failed: ' + (e instanceof Error ? e.message : e)); } }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                              </Button>
                            )}
                            </div>
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
                        const hasMembership = p.membershipExpiry > 0;
                        const days = hasMembership ? Math.floor((p.membershipExpiry - Date.now()) / (1000 * 60 * 60 * 24)) : 0;
                        const isExpired = hasMembership && days <= 0;
                        const isWarning = hasMembership && days <= 60 && days > 0;
                        return (
                          <tr key={p.uid} className="hover:bg-canvas/50 transition-colors">
                            <td className="px-4 py-3 font-medium text-charcoal text-xs max-w-[140px] truncate">{p.companyName}</td>
                            <td className="px-4 py-3 text-steel text-xs">{`${p.ownerName} ${p.ownerSurname || ''}`.trim() || '—'}</td>
                            <td className="px-4 py-3 text-steel text-xs font-mono hidden sm:table-cell">{p.membershipDate > 0 ? formatDate(p.membershipDate) : '—'}</td>
                            <td className="px-4 py-3 text-steel text-xs font-mono">{hasMembership ? formatDate(p.membershipExpiry) : '—'}</td>
                            <td className="px-4 py-3 text-xs font-mono">
                              <span className={`font-semibold ${isExpired ? 'text-danger' : isWarning ? 'text-warning' : 'text-success'}`}>
                                {isExpired ? 'Expired' : hasMembership ? days : '—'}
                              </span>
                            </td>
                            <td className="px-4 py-3"><Badge variant={isExpired ? 'danger' : isWarning ? 'neutral' : 'success'}>{hasMembership ? (isExpired ? 'Expired' : p.membershipStatus) : 'Inactive'}</Badge></td>
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

          {paidDialogUid && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setPaidDialogUid(null)}>
              <div className="bg-surface border border-border rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
                <h3 className="font-semibold text-charcoal tracking-tight mb-1">Set Payment Date</h3>
                <p className="text-xs text-steel mb-4">Membership will be active for 364 days from this date.</p>
                <Input label="Date Paid" type="date" value={paidDateValue} onChange={(e) => setPaidDateValue(e.target.value)} />
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" className="flex-1" onClick={() => setPaidDialogUid(null)}>Cancel</Button>
                  <Button className="flex-1" onClick={handlePaidSubmit} loading={paidSaving} disabled={!paidDateValue}>Confirm</Button>
                </div>
              </div>
            </div>
          )}
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
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      <div className="bg-primary-light/40 rounded-xl p-3 text-center">
                        <p className="text-2xl font-bold text-primary">{meetingRsvps.filter((r) => r.response === 'yes').length} / {profiles.length}</p>
                        <p className="text-[11px] text-steel font-medium mt-0.5">Confirmed / Total Members</p>
                      </div>
                      <div className="bg-accent-light/40 rounded-xl p-3 text-center">
                        <p className="text-2xl font-bold text-accent">{meetingRsvps.filter((r) => r.response === 'yes').reduce((sum, r) => sum + 1 + (r.guestCount || 0), 0)}</p>
                        <p className="text-[11px] text-steel font-medium mt-0.5">Estimated Headcount</p>
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
                              const headers = ['Name', 'Company', 'Response', 'Guests', 'Responded At'];
                              const rows = meetingRsvps.map((r) => [
                                r.displayName,
                                r.companyName || '',
                                r.response,
                                String(r.guestCount || 0),
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
                                  <span className="truncate">{r.displayName}{r.response === 'yes' && r.guestCount ? ` +${r.guestCount}` : ''}</span>
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
                    const allRows: { meeting: string; date: string; member: string; company: string; response: string; guests: string; respondedAt: string }[] = [];
                    Object.entries(meetingRsvpMap).forEach(([meetingId, rsvps]) => {
                      const m = meetings.find((x) => x.id === meetingId);
                      rsvps.forEach((r) => {
                        allRows.push({
                          meeting: m?.label || meetingId,
                          date: m ? new Date(m.date).toLocaleDateString('en-IN') : '',
                          member: r.displayName,
                          company: r.companyName || '',
                          response: r.response,
                          guests: String(r.guestCount || 0),
                          respondedAt: new Date(r.respondedAt).toLocaleString('en-IN'),
                        });
                      });
                    });
                    allRows.sort((a, b) => new Date(b.respondedAt).getTime() - new Date(a.respondedAt).getTime());
                    const headers = ['Meeting', 'Date', 'Member', 'Company', 'Response', 'Guests', 'Responded At'];
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
                  <table className="w-full text-sm min-w-[750px]">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th className="px-4 py-3 font-medium text-muted font-mono tracking-tight text-xs">Meeting</th>
                        <th className="px-4 py-3 font-medium text-muted font-mono tracking-tight text-xs">Date</th>
                        <th className="px-4 py-3 font-medium text-muted font-mono tracking-tight text-xs">Member</th>
                        <th className="px-4 py-3 font-medium text-muted font-mono tracking-tight text-xs">Company</th>
                        <th className="px-4 py-3 font-medium text-muted font-mono tracking-tight text-xs">Response</th>
                        <th className="px-4 py-3 font-medium text-muted font-mono tracking-tight text-xs">Guests</th>
                        <th className="px-4 py-3 font-medium text-muted font-mono tracking-tight text-xs">Responded At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {meetings.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((m) => {
                        const rsvps = meetingRsvpMap[m.id] || [];
                        if (rsvps.length === 0) {
                          return (
                            <tr key={m.id} className="hover:bg-canvas/50 transition-colors">
                              <td className="px-4 py-3 font-medium text-charcoal text-xs" colSpan={7}>
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
                            <td className="px-4 py-3 text-xs text-steel font-mono">{r.guestCount || '0'}</td>
                            <td className="px-4 py-3 text-xs text-muted font-mono whitespace-nowrap">{new Date(r.respondedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                          </tr>
                        ));
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-end gap-4 mt-3 px-4 py-3 rounded-xl bg-gradient-to-r from-primary-light/40 via-accent-light/20 to-success-light/30 border border-primary/10">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    </span>
                    <span className="text-sm font-bold text-charcoal">
                      {Object.values(meetingRsvpMap).reduce((sum, r) => sum + r.length, 0)}
                    </span>
                    <span className="text-xs text-steel font-medium">Total RSVPs</span>
                  </div>
                  <div className="w-px h-6 bg-border" />
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    </span>
                    <span className="text-sm font-bold text-charcoal">
                      {Object.values(meetingRsvpMap).reduce((sum, rsvps) => sum + rsvps.reduce((s, r) => s + (r.response === 'yes' ? 1 + (r.guestCount || 0) : 0), 0), 0)}
                    </span>
                    <span className="text-xs text-steel font-medium">Estimated Headcount</span>
                  </div>
                </div>
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
                      <th className="px-4 py-3 font-medium text-muted font-mono tracking-tight text-xs">Date</th>
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
                          <td className="px-4 py-3 text-xs text-muted font-mono whitespace-nowrap">{formatDate(req.createdAt)}</td>
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
                    <table className="w-full text-sm min-w-[550px]">
                      <thead>
                        <tr className="border-b border-border text-left">
                          <th className="px-4 py-2 font-medium text-muted font-mono tracking-tight text-xs">Name</th>
                          <th className="px-4 py-2 font-medium text-muted font-mono tracking-tight text-xs">Email</th>
                          <th className="px-4 py-2 font-medium text-muted font-mono tracking-tight text-xs">Time</th>
                          <th className="px-4 py-2 font-medium text-muted font-mono tracking-tight text-xs">IP</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {logs.map((log) => (
                          <tr key={log.id} className="hover:bg-canvas/50 transition-colors">
                            <td className="px-4 py-2 text-charcoal text-xs">{log.displayName}</td>
                            <td className="px-4 py-2 text-steel text-xs font-mono">{log.email}</td>
                            <td className="px-4 py-2 text-muted font-mono text-[11px] whitespace-nowrap">{formatDate(log.timestamp)} {formatTime(log.timestamp)}</td>
                            <td className="px-4 py-2 text-muted font-mono text-[11px]">{log.ip || '—'}</td>
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

      {/* ── Referrals Tab ── */}
      {activeTab === 'referrals' && (
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-charcoal">Referral Leaderboard</h2>
                <span className="text-xs text-muted bg-canvas px-2.5 py-1 rounded-lg">
                  {profiles.filter((p) => p.referredByPhone).length} referred
                </span>
              </div>
              {profilesLoading ? (
                <p className="text-sm text-muted text-center py-8">Loading...</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-2 text-xs font-medium text-muted uppercase tracking-wider">#</th>
                        <th className="text-left py-3 px-2 text-xs font-medium text-muted uppercase tracking-wider">Referrer</th>
                        <th className="text-left py-3 px-2 text-xs font-medium text-muted uppercase tracking-wider">Phone</th>
                        <th className="text-right py-3 px-2 text-xs font-medium text-muted uppercase tracking-wider">Referrals</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const grouped = new Map<string, { count: number }>();
                        const referrerMap = new Map<string, BusinessProfile | undefined>();
                        for (const p of profiles) {
                          const phone = p.referredByPhone;
                          if (!phone) continue;
                          if (!referrerMap.has(phone)) {
                            referrerMap.set(phone, profiles.find((bp) => bp.phone === phone));
                          }
                          grouped.set(phone, { count: (grouped.get(phone)?.count ?? 0) + 1 });
                        }
                        const entries = [...grouped.entries()].sort((a, b) => b[1].count - a[1].count);
                        if (entries.length === 0) {
                          return (
                            <tr>
                              <td colSpan={4} className="text-center text-muted py-8">No referrals yet.</td>
                            </tr>
                          );
                        }
                        return entries.map(([phone, { count }], i) => {
                          const referrer = referrerMap.get(phone);
                          const name = referrer ? `${referrer.ownerName} ${referrer.ownerSurname}`.trim() : null;
                          return (
                            <tr key={phone} className="border-b border-border last:border-0 hover:bg-canvas/50 transition-colors">
                              <td className="py-3 px-2 text-muted text-xs">{i + 1}</td>
                              <td className="py-3 px-2 font-medium text-charcoal">
                                {name || <span className="text-muted italic">No profile</span>}
                              </td>
                              <td className="py-3 px-2 text-muted font-mono text-xs">{phone}</td>
                              <td className="py-3 px-2 text-right">
                                <span className="inline-flex items-center justify-center min-w-[2rem] h-6 px-2 rounded-full bg-primary-light text-primary text-xs font-semibold">{count}</span>
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Deals Tab ── */}
      {activeTab === 'deals' && (
        <div className="space-y-6">
          {/* Revenue Target Config (super admin) */}
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-charcoal tracking-tight">🎯 Revenue Target</h3>
            </CardHeader>
            <CardContent className="p-5 space-y-3">
              {revenueConfig && (
                <div className="flex items-center justify-between gap-4 mb-3 flex-wrap">
                  <div>
                    <p className="text-xs text-muted">Current Target · {getFinancialYear().fyLabel}</p>
                    <p className="text-lg font-bold text-charcoal">{formatCurrency(String(revenueConfig.target))}</p>
                  </div>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-charcoal mb-1">Target Amount (₹)</label>
                <input type="text" value={revTargetInput} onChange={(e) => setRevTargetInput(e.target.value)} placeholder="350000000" className="w-full rounded-xl border border-border px-3 py-2 text-sm" />
              </div>
              <div className="flex items-center gap-3">
                {canWrite && <Button onClick={handleSaveRevenue} loading={revSaving}>Save Target</Button>}
                {revMsg && <span className={`text-xs ${revMsg.includes('saved') ? 'text-success' : 'text-danger'}`}>{revMsg}</span>}
              </div>
            </CardContent>
          </Card>

          {/* Full Leaderboard */}
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-charcoal tracking-tight">📊 Full Leaderboard ({allLeaderboard.length})</h3>
            </CardHeader>
            <CardContent>
              {dealsLoading ? (
                <div className="skeleton h-48 rounded-xl" />
              ) : allLeaderboard.length === 0 ? (
                <p className="text-sm text-muted text-center py-8">No deals recorded yet.</p>
              ) : (
                <div className="overflow-x-auto max-h-64 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th className="px-4 py-3 font-medium text-muted font-mono tracking-tight text-xs">#</th>
                        <th className="px-4 py-3 font-medium text-muted font-mono tracking-tight text-xs">Company</th>
                        <th className="px-4 py-3 font-medium text-muted font-mono tracking-tight text-xs">Owner</th>
                        <th className="px-4 py-3 font-medium text-muted font-mono tracking-tight text-xs text-right">Revenue</th>
                        <th className="px-4 py-3 font-medium text-muted font-mono tracking-tight text-xs text-right">Deals</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {allLeaderboard.map((entry, i) => (
                        <tr key={entry.uid} className="hover:bg-canvas/50 transition-colors">
                          <td className="px-4 py-2.5 text-xs text-muted">{i + 1}</td>
                          <td className="px-4 py-2.5 text-xs font-medium text-charcoal">{entry.companyName}</td>
                          <td className="px-4 py-2.5 text-xs text-steel">{entry.ownerName || '—'}</td>
                          <td className="px-4 py-2.5 text-xs font-semibold text-charcoal text-right">{formatCurrency(String(entry.totalRevenue))}</td>
                          <td className="px-4 py-2.5 text-xs text-right">
                            <span className="inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5 rounded-full bg-primary-light text-primary text-[10px] font-semibold">{entry.dealCount}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* All Deals */}
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-charcoal tracking-tight">📝 All Deals ({deals.length})</h3>
            </CardHeader>
            <CardContent>
              {dealsLoading ? (
                <div className="skeleton h-48 rounded-xl" />
              ) : deals.length === 0 ? (
                <p className="text-sm text-muted text-center py-8">No deals recorded yet.</p>
              ) : (
                <div className="overflow-x-auto max-h-80 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th className="px-4 py-3 font-medium text-muted font-mono tracking-tight text-xs">Date</th>
                        <th className="px-4 py-3 font-medium text-muted font-mono tracking-tight text-xs">Giver</th>
                        <th className="px-4 py-3 font-medium text-muted font-mono tracking-tight text-xs">Receiver</th>
                        <th className="px-4 py-3 font-medium text-muted font-mono tracking-tight text-xs">Request</th>
                        <th className="px-4 py-3 font-medium text-muted font-mono tracking-tight text-xs text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {deals.sort((a, b) => b.createdAt - a.createdAt).map((d) => (
                        <tr key={d.id} className="hover:bg-canvas/50 transition-colors">
                          <td className="px-4 py-2.5 text-xs text-muted font-mono whitespace-nowrap">{formatDate(d.createdAt)}</td>
                          <td className="px-4 py-2.5 text-xs font-medium text-charcoal">{d.giverCompanyName}</td>
                          <td className="px-4 py-2.5 text-xs font-medium text-charcoal">{d.receiverCompanyName}</td>
                          <td className="px-4 py-2.5 text-xs text-steel max-w-[160px] truncate" title={d.requestTitle}>{d.requestTitle}</td>
                          <td className="px-4 py-2.5 text-xs font-semibold text-charcoal text-right">{formatCurrency(d.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Import Tab ── */}
      {activeTab === 'import' && (
        <ImportProfiles />
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
                  <input type="text" value={awardAmount} onChange={(e) => setAwardAmount(e.target.value)} placeholder="0" className="w-full rounded-xl border border-border px-3 py-2 text-sm" />
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

function ImportProfiles() {
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: number; errors: string[] } | null>(null);

  const profileFields = [
    { value: 'ownerName', label: 'Owner Name *' },
    { value: 'ownerSurname', label: 'Owner Surname' },
    { value: 'phone', label: 'Phone *' },
    { value: 'companyName', label: 'Company Name *' },
    { value: 'contactEmail', label: 'Email' },
    { value: 'location', label: 'Location' },
    { value: 'website', label: 'Website' },
    { value: 'description', label: 'Description' },
    { value: 'categories', label: 'Categories (comma-separated)' },
    { value: 'companySize', label: 'Company Size' },
    { value: 'membershipStatus', label: 'Membership Status' },
    { value: 'countryCode', label: 'Country Code' },
    { value: '__skip', label: '— Skip this column —' },
  ];

  function parseCSVLine(line: string): string[] {
    const out: string[] = [];
    let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (q && line[i + 1] === '"') { cur += '"'; i++; }
        else q = !q;
      } else if (c === ',' && !q) { out.push(cur.trim()); cur = ''; }
      else cur += c;
    }
    out.push(cur.trim());
    return out;
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.endsWith('.csv')) {
      setResult({ success: 0, errors: ['Only CSV files are supported. Please convert your Excel file to CSV first.'] });
      return;
    }
    setFile(f);
    setResult(null);

    const text = await f.text();
    const lines = text.split('\n').filter((l) => l.trim());
    if (lines.length < 2) { setResult({ success: 0, errors: ['CSV file is empty or has no data rows.'] }); return; }
    const headers = parseCSVLine(lines[0]);
    const data: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const row: Record<string, string> = {};
      headers.forEach((h, j) => { row[h] = values[j] ?? ''; });
      data.push(row);
    }
    setRows(data);

    const keys = data.length > 0 ? Object.keys(data[0]) : [];
    const auto: Record<string, string> = {};
    for (const h of keys) {
      const hl = h.toLowerCase().replace(/[\s_-]/g, '');
      if (hl.includes('ownername') || hl.includes('ownerfirst') || hl.includes('firstname') || hl.includes('firstName')) auto[h] = 'ownerName';
      else if (hl.includes('ownersurname') || hl.includes('ownerlast') || hl.includes('lastname') || hl.includes('surname')) auto[h] = 'ownerSurname';
      else if (hl.includes('companyname') || hl.includes('businessname') || hl.includes('businessName') || hl.includes('companyName')) auto[h] = 'companyName';
      else if (hl.includes('phone') || hl.includes('mobile') || hl.includes('contactno') || hl.includes('contactNo')) auto[h] = 'phone';
      else if (hl.includes('email') || hl.includes('contactemail') || hl.includes('e-mail')) auto[h] = 'contactEmail';
      else if (hl.includes('location') || hl.includes('city') || hl.includes('address')) auto[h] = 'location';
      else if (hl.includes('website') || hl.includes('web') || hl.includes('url')) auto[h] = 'website';
      else if (hl.includes('description') || hl.includes('desc') || hl.includes('about')) auto[h] = 'description';
      else if (hl.includes('categor') || hl.includes('industry') || hl.includes('sector')) auto[h] = 'categories';
      else if (hl.includes('companysize') || hl.includes('size') || hl.includes('employees')) auto[h] = 'companySize';
      else if (hl.includes('membershipstatus') || hl.includes('status')) auto[h] = 'membershipStatus';
      else if (hl.includes('countrycode') || hl.includes('countryCode') || hl.includes('country')) auto[h] = 'countryCode';
      else auto[h] = '__skip';
    }
    setMapping(auto);
  };

  const handleImport = async () => {
    if (!rows.length) return;
    setImporting(true);
    setResult(null);
    const fieldToColumn = Object.entries(mapping).reduce((acc, [col, field]) => {
      if (field !== '__skip') acc[field] = col;
      return acc;
    }, {} as Record<string, string>);

    const entries: ImportProfileEntry[] = rows.map((row) => {
      const get = (field: string) => row[fieldToColumn[field]] ?? '';

      let categories: string[] | undefined;
      const rawCat = get('categories');
      if (rawCat) categories = rawCat.split(',').map((s) => s.trim()).filter(Boolean);

      let membershipExpiry: number | undefined;
      const rawExpiry = row[fieldToColumn['membershipExpiry'] ?? ''];
      if (rawExpiry) {
        const parsed = Date.parse(rawExpiry);
        if (!isNaN(parsed)) membershipExpiry = parsed;
      }

      return {
        ownerName: get('ownerName'),
        ownerSurname: get('ownerSurname') || undefined,
        phone: get('phone'),
        companyName: get('companyName'),
        contactEmail: get('contactEmail') || undefined,
        location: get('location') || undefined,
        website: get('website') || undefined,
        description: get('description') || undefined,
        categories,
        companySize: get('companySize') || undefined,
        membershipStatus: (get('membershipStatus') || 'inactive') as 'active' | 'inactive' | 'expired',
        membershipExpiry,
        countryCode: get('countryCode') || undefined,
      };
    });

    const res = await bulkImportProfiles(entries);
    setResult(res);
    setImporting(false);
  };

  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h3 className="font-semibold text-charcoal tracking-tight">📥 Import Business Profiles</h3>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <p className="text-sm text-steel">
            Upload a CSV file to bulk-import business profiles.
            Required columns: <strong>Owner Name</strong>, <strong>Phone</strong>, <strong>Company Name</strong>. For Excel files, export as CSV first.
          </p>
          <label className="flex items-center justify-center w-full h-28 border-2 border-dashed border-border rounded-xl bg-canvas/30 hover:bg-canvas/50 cursor-pointer transition-colors">
            <div className="text-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-1 text-muted">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <p className="text-xs text-muted">{file ? file.name : 'Click to select file'}</p>
            </div>
            <input type="file" accept=".csv" onChange={handleFile} className="hidden" />
          </label>

          {rows.length > 0 && (
            <>
              <div>
                <h4 className="text-sm font-semibold text-charcoal mb-2">Column Mapping ({rows.length} rows)</h4>
                <div className="space-y-2">
                  {headers.map((h) => (
                    <div key={h} className="flex items-center gap-3 text-sm">
                      <span className="w-1/3 text-xs text-steel font-medium truncate" title={h}>{h}</span>
                      <select
                        value={mapping[h] ?? '__skip'}
                        onChange={(e) => setMapping((prev) => ({ ...prev, [h]: e.target.value }))}
                        className="flex-1 rounded-lg border border-border px-3 py-1.5 text-xs bg-white"
                      >
                        {profileFields.map((f) => (
                          <option key={f.value} value={f.value}>{f.label}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-charcoal mb-2">Preview (first 5 rows)</h4>
                <div className="overflow-x-auto border border-border rounded-xl">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted-bg border-b border-border">
                        {headers.map((h) => (
                          <th key={h} className="px-3 py-2 text-left font-medium text-muted whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {rows.slice(0, 5).map((row, i) => (
                        <tr key={i}>
                          {headers.map((h) => (
                            <td key={h} className="px-3 py-2 text-steel whitespace-nowrap max-w-[150px] truncate" title={row[h]}>{row[h]}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button
                  variant="primary"
                  onClick={handleImport}
                  loading={importing}
                  disabled={importing || !rows.length}
                >
                  Import {rows.length} Profile{rows.length !== 1 ? 's' : ''}
                </Button>
                <Button variant="outline" onClick={() => { setFile(null); setRows([]); setMapping({}); setResult(null); }}>
                  Clear
                </Button>
              </div>
            </>
          )}

          {result && (
            <div className={`p-4 rounded-xl ${result.errors.length === 0 ? 'bg-success-light/20 border border-success/20' : 'bg-warning-light/20 border border-warning/20'}`}>
              <p className="text-sm font-semibold text-charcoal">
                {result.success > 0 ? `✓ ${result.success} profile${result.success !== 1 ? 's' : ''} imported successfully.` : 'No profiles imported.'}
              </p>
              {result.errors.length > 0 && (
                <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                  {result.errors.map((err, i) => (
                    <p key={i} className="text-xs text-danger">{err}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
