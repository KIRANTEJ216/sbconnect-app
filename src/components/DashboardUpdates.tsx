import { useState, useEffect } from 'react';
import { submitRSVP } from '../lib/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useMeetings, useUserRSVPs, useBusinessProfile } from '../hooks/useFirebaseQuery';
import { Card, CardContent } from './ui/Card';

export function DashboardUpdates() {
  const { user, profile } = useAuth();
  const { data: myRsvps } = useUserRSVPs(user?.uid);
  const { data: meetings = [] } = useMeetings();
  const { data: businessProfile } = useBusinessProfile(user?.uid);
  const [rsvpMap, setRsvpMap] = useState<Record<string, 'yes' | 'no' | 'maybe'>>({});
  const [guestMap, setGuestMap] = useState<Record<string, number>>({});
  const [rsvpSaving, setRsvpSaving] = useState<string | null>(null);
  const [pendingGuest, setPendingGuest] = useState<Record<string, number>>({});
  const [editingGuest, setEditingGuest] = useState<string | null>(null);

  useEffect(() => {
    if (!myRsvps) return;
    const map: Record<string, 'yes' | 'no' | 'maybe'> = {};
    const gMap: Record<string, number> = {};
    myRsvps.forEach((r) => {
      map[r.meetingId] = r.response;
      gMap[r.meetingId] = r.guestCount || 0;
    });
    setRsvpMap(map);
    setGuestMap(gMap);
  }, [myRsvps]);

  const handleRSVP = async (meetingId: string, response: 'yes' | 'no', guestCount: number = 0) => {
    if (!user || !profile) return;
    setRsvpSaving(meetingId);
    try {
      await submitRSVP(meetingId, user.uid, profile.displayName || user.email || 'Unknown', businessProfile?.companyName || '', response, guestCount);
      setRsvpMap((prev) => ({ ...prev, [meetingId]: response }));
      setGuestMap((prev) => ({ ...prev, [meetingId]: guestCount }));
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
    <Card className="stat-accent-top">
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
                  {current === 'yes' ? (
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-success-light text-success">
                        Attend{guestMap[m.id] ? ` +${guestMap[m.id]}` : ''}
                      </span>
                      <button
                        onClick={() => setEditingGuest(editingGuest === m.id ? null : m.id)}
                        className="text-[10px] text-muted hover:text-charcoal transition-colors cursor-pointer p-0.5"
                        title="Change guest count"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      {editingGuest === m.id && (
                        <select
                          value={guestMap[m.id] || 0}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            setGuestMap((prev) => ({ ...prev, [m.id]: val }));
                          }}
                          onBlur={() => {
                            setEditingGuest(null);
                            handleRSVP(m.id, 'yes', guestMap[m.id] || 0);
                          }}
                          className="text-[10px] px-1 py-0.5 rounded border border-border bg-surface text-charcoal"
                          autoFocus
                        >
                          {Array.from({ length: 11 }, (_, i) => (
                            <option key={i} value={i}>{i}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  ) : current === 'no' ? (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-danger-light text-danger">
                      Not Going
                    </span>
                  ) : (
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            const gc = pendingGuest[m.id] || 0;
                            handleRSVP(m.id, 'yes', gc);
                          }}
                          disabled={rsvpSaving === m.id}
                          className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-success-light text-success hover:bg-success border border-success/20 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => handleRSVP(m.id, 'no', 0)}
                          disabled={rsvpSaving === m.id}
                          className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-danger-light text-danger hover:bg-danger/10 border border-danger/20 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          No
                        </button>
                      </div>
                      <select
                        value={pendingGuest[m.id] || 0}
                        onChange={(e) => setPendingGuest((prev) => ({ ...prev, [m.id]: parseInt(e.target.value) }))}
                        className="text-[9px] px-1 py-0.5 rounded border border-border bg-surface text-muted"
                      >
                        {Array.from({ length: 11 }, (_, i) => (
                          <option key={i} value={i}>Bringing: {i}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            )})}
          </div>
        </CardContent>
      </Card>
  );
}
