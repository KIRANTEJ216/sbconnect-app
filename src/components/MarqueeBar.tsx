import { useEffect, useState } from 'react';
import { subscribeToNotifications, getMeetings } from '../lib/firestore';
import type { AppNotification, Meeting } from '../types';

export function MarqueeBar() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);

  useEffect(() => {
    const unsub = subscribeToNotifications((notifs) => {
      setNotifications(notifs);
    });
    return unsub;
  }, []);

  useEffect(() => {
    getMeetings().then(setMeetings).catch(console.error);
  }, []);

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const currentMonthMeetings = meetings.filter((m) => {
    const d = new Date(m.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const texts = notifications.map((n) => n.text);
  if (currentMonthMeetings.length > 0) {
    currentMonthMeetings.forEach((m) => {
      const label = `📅 ${m.label} — ${new Date(m.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}${m.location ? ` at ${m.location}` : ''}`;
      if (!texts.includes(label)) texts.push(label);
    });
  }

  if (texts.length === 0) return null;

  const single = texts[0];

  return (
    <div className="bg-primary/5 border-b border-primary/10 overflow-hidden py-2">
      <div className="relative w-full h-6">
        <div className="marquee-bounce whitespace-nowrap text-xs text-primary font-medium">
          {single}
        </div>
      </div>
    </div>
  );
}
