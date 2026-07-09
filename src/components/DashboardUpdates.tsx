import { useState, useEffect } from 'react';
import { submitRSVP, getBusinessProfile } from '../lib/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useMeetings, useUserRSVPs } from '../hooks/useFirebaseQuery';
import { Card, CardContent } from './ui/Card';

export function DashboardUpdates() {
  const { user, profile } = useAuth();
  const { data: meetings = [] } = useMeetings();
  const { data: myRsvps = [], refetch: refetchRsvps } = useUserRSVPs(user?.uid);
  const [rsvpMap, setRsvpMap] = useState<Record<string, 'yes' | 'no' | 'maybe'>>({});
  const [rsvpSaving, setRsvpSaving] = useState<string | null>(null);

  useEffect(() => {
    const map: Record<string, 'yes' | 'no' | 'maybe'> = {};
    myRsvps.forEach((r) => { map[r.meetingId] = r.response; });
    setRsvpMap(map);
  }, [myRsvps]);

  const handleRSVP = async (meetingId: string, response: 'yes' | 'no') => {
    if (!user) return;
    setRsvpSaving(meetingId);
    try {
      const bp = profile ? await getBusinessProfile(user.uid).catch(() => null) : null;
      const companyName = bp?.companyName || profile?.displayName || user.displayName || user.email || '';
      await submitRSVP(meetingId, user.uid, user.displayName || user.email || 'Unknown', companyName, response);
      setRsvpMap((prev) => ({ ...prev, [meetingId]: response }));
      refetchRsvps();
    } catch (e) { console.error('RSVP failed', e); }
    setRsvpSaving(null);
  };

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const currentMonthUpcoming = meetings.filter((m) => {
    const d = new Date(m.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear && d.getTime() > now.getTime();
  }).slice(0, 3);

  return (
    <Card>
      <div className="stat-accent-top">
        <CardContent className="p-3">
          <h3 className="font-semibold text-charcoal tracking-tight text-sm mb-2 flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            Upcoming Meetings
          </h3>
          <div className="space-y-1.5">
            {currentMonthUpcoming.length === 0 ? (
              <p className="text-xs text-muted text-center py-4">No upcoming meetings this month.</p>
            ) : currentMonthUpcoming.map((m) => {
              const current = rsvpMap[m.id];
              return (
              <div key={m.id} className="flex items-center justify-between p-2 rounded-lg bg-canvas border border-border">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-charcoal truncate">{m.label}</p>
                  <p className="text-[10px] text-muted font-mono">{new Date(m.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  {current ? (
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      current === 'yes' ? 'bg-success-light text-success' : 'bg-danger-light text-danger'
                    }`}>
                      {current === 'yes' ? 'Going' : 'Not Going'}
                    </span>
                  ) : (
                    <>
                      <button
                        onClick={() => handleRSVP(m.id, 'yes')}
                        disabled={rsvpSaving === m.id}
                        className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-success-light text-success hover:bg-success border border-success/20 transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => handleRSVP(m.id, 'no')}
                        disabled={rsvpSaving === m.id}
                        className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-danger-light text-danger hover:bg-danger/10 border border-danger/20 transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        No
                      </button>
                    </>
                  )}
                </div>
              </div>
            )})}
          </div>
        </CardContent>
      </div>
    </Card>
  );
}
