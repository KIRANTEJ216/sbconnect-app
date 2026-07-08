import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getAllUsers, getUserByEmail, setUserRole, getUnverifiedProfiles, verifyBusinessProfile, getLoginLogs, createMeeting, getMeetings, getMeetingAttendance, addNotification, getMeetingRSVPs, getAllProfiles, deleteNotification, deleteMeeting, getAllRequests } from '../lib/firestore';
import type { LoginLog } from '../lib/firestore';
import { formatDate, formatTime, formatCurrency } from '../lib/format';
import { isSuperAdmin } from '../lib/admin';
import type { BusinessProfile, Meeting, Attendance, MeetingRSVP, UserProfile, Request } from '../types';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { AnimatedPage } from '../components/motion/AnimatedPage';
import { TiltCard } from '../components/motion/TiltCard';
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

function CollapsibleSection({ title, icon, badge, defaultOpen = true, children }: { title: string; icon?: React.ReactNode; badge?: React.ReactNode; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <TiltCard>
      <Card>
        <div className="stat-accent-top">
          <CardHeader>
            <button
              onClick={() => setOpen((v) => !v)}
              className="flex items-center justify-between w-full text-left cursor-pointer group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {icon && <span className="text-lg shrink-0">{icon}</span>}
                <h3 className="font-semibold text-charcoal tracking-tight">{title}</h3>
                {badge}
              </div>
              <div className={`w-6 h-6 rounded-lg bg-muted-bg flex items-center justify-center transition-colors duration-200 group-hover:bg-primary-light shrink-0 ml-2 ${open ? 'bg-primary-light' : ''}`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`text-muted transition-transform duration-200 ${open ? 'rotate-180 text-primary' : ''}`}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </button>
          </CardHeader>
        </div>
        <div className={`transition-all duration-300 overflow-hidden ${open ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'}`}>
          <CardContent>
            {children}
          </CardContent>
        </div>
      </Card>
    </TiltCard>
  );
}

export default function Admin() {
  const { user, profile } = useAuth();
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

  const [meetingRsvpMap, setMeetingRsvpMap] = useState<Record<string, MeetingRSVP[]>>({});
  const [rsvpMapLoading, setRsvpMapLoading] = useState(false);

  const [superEmail, setSuperEmail] = useState('');
  const [superSearching, setSuperSearching] = useState(false);
  const [superMsg, setSuperMsg] = useState('');
  const [admins, setAdmins] = useState<UserProfile[]>([]);
  const [adminsLoading, setAdminsLoading] = useState(false);
  const [removingAdmin, setRemovingAdmin] = useState<string | null>(null);

  const isSuper = isSuperAdmin(user?.email, profile?.role);

  useEffect(() => {
    loadPending();
    loadProfiles();
    loadMeetings();
    loadNotifs();
    loadLogs();
    loadRequests();
    loadAllMeetingRsvps();
    if (isSuper) loadAdmins();
  }, [isSuper]);

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

  async function loadAllMeetingRsvps() {
    setRsvpMapLoading(true);
    try {
      const allMeetings = await getMeetings();
      const map: Record<string, MeetingRSVP[]> = {};
      await Promise.all(allMeetings.map(async (m) => {
        map[m.id] = await getMeetingRSVPs(m.id);
      }));
      setMeetingRsvpMap(map);
    } catch (e) { console.error(e); }
    setRsvpMapLoading(false);
  }

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

  return (
    <AnimatedPage>
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-charcoal tracking-tight">Admin Panel</h1>
        <p className="text-steel mt-1">Manage users, roles, profiles, meetings & notifications</p>
      </div>

      {/* ── Verification Requests ── */}
      <CollapsibleSection
        title={`Verification Requests${pending.length > 0 ? ` (${pending.length})` : ''}`}
        icon="🛡️"
        badge={pending.length > 0 ? <span className="w-2 h-2 rounded-full bg-warning shrink-0" /> : undefined}
        defaultOpen={pending.length > 0}
      >
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
                  <Button size="sm" onClick={() => handleApprove(p.uid)} loading={approving === p.uid}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Approve
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>

      {/* ── Send Update / Notification ── */}
      <CollapsibleSection title="Send Update" icon="🔔">
        <div className="space-y-4">
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
          {notifMsg && <p className={`text-sm ${notifMsg.includes('Failed') ? 'text-danger' : 'text-success'}`}>{notifMsg}</p>}

          {allNotifs.length > 0 && (
            <div className="divide-y divide-border max-h-48 overflow-y-auto border border-border rounded-xl">
              {allNotifs.map((n) => (
                <div key={n.id} className="flex items-center justify-between px-4 py-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${n.active ? 'bg-success' : 'bg-muted/40'}`} />
                    <span className={`text-sm truncate ${n.active ? 'text-charcoal' : 'text-muted line-through'}`}>{n.text}</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={async () => { if (confirm('Delete this notification?')) { await deleteNotification(n.id); loadNotifs(); } }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* ── Meeting Management ── */}
      <CollapsibleSection title="Meeting Management" icon="📅">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <Input label="Meeting Date" type="date" value={newMeetingDate} onChange={(e) => setNewMeetingDate(e.target.value)} />
            <Input label="Meeting Label" value={newMeetingLabel} onChange={(e) => setNewMeetingLabel(e.target.value)} placeholder="e.g. July 2026 Meeting" />
            <Input label="Location" value={newMeetingLocation} onChange={(e) => setNewMeetingLocation(e.target.value)} placeholder="e.g. Community Hall" />
            <div className="flex items-end">
              <Button onClick={handleCreateMeeting} loading={creating} className="w-full sm:w-auto">Create Meeting</Button>
            </div>
          </div>
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
                    <Button size="sm" variant="danger" onClick={async () => { if (confirm(`Delete "${m.label}"?`)) { await deleteMeeting(m.id); loadMeetings(); } }}>Delete</Button>
                  </div>
                </div>
              ))
            )}
          </div>

          {selectedMeeting && selectedMeetingData && (
            <div className="space-y-3">
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
      </CollapsibleSection>

      {/* ── Meeting Attendance ── */}
      <CollapsibleSection title={`Meeting Attendance (${meetings.length})`} icon="✅" defaultOpen={false}>
        {rsvpMapLoading ? (
          <div className="skeleton h-48 rounded-xl" />
        ) : meetings.length === 0 ? (
          <p className="text-sm text-muted text-center py-8">No meetings created yet.</p>
        ) : (
          <>
          <div className="flex justify-end gap-2 mb-3">
            <Button size="sm" variant="outline" onClick={() => {
              const sorted = [...meetings].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
              const headers = ['Meeting', 'Date', 'Confirmed Count', 'Confirmed Names'];
              const rows: string[][] = [];
              sorted.forEach((m) => {
                const rsvps = meetingRsvpMap[m.id] || [];
                const yesRsvps = rsvps.filter((r) => r.response === 'yes');
                rows.push([
                  m.label,
                  new Date(m.date).toLocaleDateString('en-IN'),
                  String(yesRsvps.length),
                  yesRsvps.map((r) => r.displayName).join('; '),
                ]);
              });
              const csv = [headers, ...rows].map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'meeting-attendance.csv';
              a.click();
              URL.revokeObjectURL(url);
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export CSV
            </Button>
            <Button size="sm" variant="outline" onClick={loadAllMeetingRsvps} loading={rsvpMapLoading}>Refresh</Button>
          </div>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-3 font-medium text-muted font-mono tracking-tight text-xs">Meeting</th>
                  <th className="px-4 py-3 font-medium text-muted font-mono tracking-tight text-xs">Date</th>
                  <th className="px-4 py-3 font-medium text-muted font-mono tracking-tight text-xs">Confirmed</th>
                  <th className="px-4 py-3 font-medium text-muted font-mono tracking-tight text-xs">Attendees</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {meetings.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((m) => {
                  const rsvps = meetingRsvpMap[m.id] || [];
                  const yesRsvps = rsvps.filter((r) => r.response === 'yes');
                  return (
                    <tr key={m.id} className="hover:bg-canvas/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-charcoal text-xs">{m.label}</td>
                      <td className="px-4 py-3 text-steel text-xs font-mono">{new Date(m.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</td>
                      <td className="px-4 py-3">
                        <span className="text-base font-bold text-success">{yesRsvps.length}</span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {yesRsvps.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {yesRsvps.map((r) => (
                              <span key={r.id} className="px-2 py-0.5 rounded-full bg-success-light text-success border border-success/20 text-[11px] font-medium">
                                {r.displayName}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </CollapsibleSection>

      {/* ── Business Directory ── */}
      <CollapsibleSection title={`Business Directory (${profiles.length})`} icon="👥">
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
          <div className="overflow-x-auto -mx-4 sm:mx-0">
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
                    <td className="px-4 py-3 text-steel text-xs max-w-[120px] truncate hidden sm:table-cell">{(p.keywords ?? []).slice(0, 3).join(', ')}{(p.keywords ?? []).length > 3 ? '...' : ''}</td>
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
      </CollapsibleSection>

      {/* ── Membership Expiry ── */}
      <CollapsibleSection title={`Membership Expiry (${profiles.length})`} icon="💳" defaultOpen={false}>
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
      </CollapsibleSection>

      {/* ── Login Activity ── */}
      <CollapsibleSection title={`Login Activity (${logs.length})`} icon="🕐" defaultOpen={false}>
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
      </CollapsibleSection>

      {/* ── Request Activity ── */}
      <CollapsibleSection title={`Request Activity (${requests.length})`} icon="📋" defaultOpen={false}>
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
                        <Badge variant={req.status === 'open' ? 'success' : 'neutral'}>{req.status === 'open' ? 'Open' : 'Closed'}</Badge>
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
      </CollapsibleSection>

      {/* ── Add Admin (super only) ── */}
      {isSuper && (
        <CollapsibleSection title={`Admins (${admins.length})`} icon="🔑" defaultOpen={false}>
          <div className="flex flex-col sm:flex-row gap-3 items-end mb-4">
            <div className="flex-1 w-full">
              <Input label="Add by email" type="email" value={superEmail} onChange={(e) => setSuperEmail(e.target.value)} placeholder="user@example.com" />
            </div>
            <Button onClick={handleSuperAdd} loading={superSearching} className="w-full sm:w-auto">Add Admin</Button>
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
                  {a.role !== 'super_admin' && (
                    <Button size="sm" variant="outline" onClick={() => handleRemoveAdmin(a.uid)} loading={removingAdmin === a.uid}>Remove</Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted text-center py-4">No admins found.</p>
          )}
        </CollapsibleSection>
      )}
    </div>
    </AnimatedPage>
  );
}
