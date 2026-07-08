import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getBusinessProfile, getUserAttendance, getMeetings, getActiveMeeting, markAttendance } from '../lib/firestore';
import { formatDate } from '../lib/format';
import type { Meeting, Attendance as AttendanceType } from '../types';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { TiltCard } from '../components/motion/TiltCard';
import { AnimatedPage } from '../components/motion/AnimatedPage';
import { StrikeWarning } from '../components/StrikeWarning';

export default function Attendance() {
  const { user } = useAuth();
  const [myAttendance, setMyAttendance] = useState<AttendanceType[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [activeMeeting, setActiveMeeting] = useState<Meeting | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [markMsg, setMarkMsg] = useState('');

  useEffect(() => {
    if (!user) return;
    async function load() {
      try {
        const [attend, meets] = await Promise.all([
          getUserAttendance(user!.uid),
          getMeetings(),
        ]);
        setMyAttendance(attend);
        setMeetings(meets);
        const active = await getActiveMeeting();
        setActiveMeeting(active);
        const bp = await getBusinessProfile(user!.uid);
        if (bp) setCompanyName(bp.companyName);
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    }
    load();
  }, [user]);

  const handleMarkAttendance = async () => {
    if (!user || !activeMeeting) return;
    setMarking(true);
    setMarkMsg('');
    try {
      const result = await markAttendance(activeMeeting.id, user!.uid, user!.displayName || user!.email || '', companyName);
      if (result.alreadyMarked) {
        setMarkMsg('You already marked attendance for this meeting.');
      } else {
        setMarkMsg('Attendance marked successfully!');
        const updated = await getUserAttendance(user!.uid);
        setMyAttendance(updated);
      }
    } catch (err) {
      console.error(err);
      setMarkMsg('Failed to mark attendance.');
    }
    setMarking(false);
  };

  const attendedMeetingIds = new Set(myAttendance.map((a) => a.meetingId));
  const now = Date.now();

  const upcoming = meetings.find((m) => new Date(m.date).getTime() >= now - 86400000 && !attendedMeetingIds.has(m.id));

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-48 rounded-[2.5rem]" />
        <div className="skeleton h-64 rounded-[2.5rem]" />
      </div>
    );
  }

  return (
    <AnimatedPage>
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-charcoal tracking-tight">Meeting Attendance</h1>
          <p className="text-steel mt-1.5">Mark your presence and RSVP for upcoming meetings</p>
        </div>

        {user && <StrikeWarning uid={user!.uid} />}

        {activeMeeting && !attendedMeetingIds.has(activeMeeting.id) && (
          <TiltCard>
            <Card>
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 bg-success-light rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-success" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-charcoal tracking-tight mb-2">Meeting Today</h2>
                <p className="text-sm text-steel mb-6">{activeMeeting.label} — {formatDate(activeMeeting.createdAt)}</p>
                <Button onClick={handleMarkAttendance} loading={marking}>
                  Mark Attendance
                </Button>
                {markMsg && (
                  <p className={`text-sm mt-3 ${markMsg.includes('already') || markMsg.includes('Failed') ? 'text-danger' : 'text-success'}`}>
                    {markMsg}
                  </p>
                )}
              </CardContent>
            </Card>
          </TiltCard>
        )}

        {activeMeeting && attendedMeetingIds.has(activeMeeting.id) && (
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 bg-success-light rounded-xl flex items-center justify-center shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-success" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-charcoal">Attendance Marked for Today's Meeting</p>
                <p className="text-sm text-steel">{activeMeeting.label}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {upcoming && !activeMeeting && (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-warning-light rounded-xl flex items-center justify-center shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-warning" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-charcoal">Next Meeting</p>
                  <p className="text-sm text-steel">{upcoming.label} — {formatDate(new Date(upcoming.date).getTime())}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <TiltCard>
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-charcoal tracking-tight">My Attendance History</h3>
            </CardHeader>
            <CardContent>
              {myAttendance.length === 0 ? (
                <p className="text-sm text-muted text-center py-8">No meetings attended yet.</p>
              ) : (
                <div className="divide-y divide-border">
                  {myAttendance.map((a) => {
                    const meeting = meetings.find((m) => m.id === a.meetingId);
                    return (
                      <div key={a.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-success-light rounded-xl flex items-center justify-center">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-success" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-charcoal">{meeting?.label || 'Meeting'}</p>
                            <p className="text-xs text-muted font-mono">{formatDate(a.scannedAt)}</p>
                          </div>
                        </div>
                        <Badge variant="success">Present</Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TiltCard>
      </div>
    </AnimatedPage>
  );
}
