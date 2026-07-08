import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMeetings } from '../lib/firestore';
import type { Meeting } from '../types';
import { Card, CardContent } from './ui/Card';

export function DashboardUpdates() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);

  useEffect(() => {
    getMeetings().then(setMeetings).catch(console.error);
  }, []);

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const currentMonthUpcoming = meetings.filter((m) => {
    const d = new Date(m.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear && d.getTime() > now.getTime();
  }).slice(0, 3);

  if (currentMonthUpcoming.length === 0) return null;

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
            {currentMonthUpcoming.map((m) => (
              <div key={m.id} className="flex items-center justify-between p-2 rounded-lg bg-canvas border border-border">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-charcoal truncate">{m.label}</p>
                  <p className="text-[10px] text-muted font-mono">{new Date(m.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                </div>
                <Link to="/attendance" className="text-[10px] text-primary font-medium hover:underline shrink-0 ml-2">
                  RSVP
                </Link>
              </div>
            ))}
          </div>
        </CardContent>
      </div>
    </Card>
  );
}
