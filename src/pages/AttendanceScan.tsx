import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getBusinessProfile, markAttendance } from '../lib/firestore';
import { formatDate } from '../lib/format';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { AnimatedPage } from '../components/motion/AnimatedPage';

export default function AttendanceScan() {
  const { user, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const meetingId = searchParams.get('meetingId');

  const [status, setStatus] = useState<'loading' | 'success' | 'already' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [meetingDate, setMeetingDate] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      const url = meetingId ? `/login?redirect=/attendance/scan?meetingId=${meetingId}` : '/login';
      navigate(url, { replace: true });
      return;
    }
    if (!meetingId) {
      setStatus('error');
      setMessage('Invalid QR code. No meeting ID found.');
      return;
    }

    async function doMark() {
      try {
        const currentUser = user!;
        const bp = await getBusinessProfile(currentUser.uid);
        const result = await markAttendance(meetingId!, currentUser.uid, currentUser.displayName || currentUser.email || '', bp?.companyName || '');
        setMeetingDate(formatDate(Date.now()));
        if (result.alreadyMarked) {
          setStatus('already');
          setMessage('You have already marked attendance for this meeting.');
        } else {
          setStatus('success');
          setMessage('Attendance marked successfully!');
        }
      } catch (err) {
        console.error(err);
        setStatus('error');
        setMessage('Failed to mark attendance. Please try again.');
      }
    }
    doMark();
  }, [user, authLoading, meetingId, navigate]);

  if (authLoading) {
    return (
      <AnimatedPage>
        <div className="max-w-md mx-auto py-20 text-center">
          <div className="skeleton h-8 w-48 mx-auto" />
        </div>
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage>
      <div className="max-w-md mx-auto py-16">
        <Card>
          <CardContent className="p-10 text-center">
            {status === 'loading' && (
              <>
                <div className="w-16 h-16 bg-primary-light rounded-2xl flex items-center justify-center mx-auto mb-5">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-primary" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" /><line x1="4.93" y1="4.93" x2="7.76" y2="7.76" /><line x1="16.24" y1="16.24" x2="19.07" y2="19.07" /><line x1="2" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="22" y2="12" /><line x1="4.93" y1="19.07" x2="7.76" y2="16.24" /><line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-charcoal tracking-tight">Marking Attendance...</h2>
              </>
            )}

            {status === 'success' && (
              <>
                <div className="w-16 h-16 bg-success-light rounded-2xl flex items-center justify-center mx-auto mb-5">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-success" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-charcoal tracking-tight mb-2">Attendance Marked!</h2>
                <p className="text-sm text-steel mb-6">{message}</p>
                {meetingDate && <p className="text-xs text-muted font-mono">{meetingDate}</p>}
              </>
            )}

            {status === 'already' && (
              <>
                <div className="w-16 h-16 bg-warning-light rounded-2xl flex items-center justify-center mx-auto mb-5">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-warning" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-charcoal tracking-tight mb-2">Already Marked</h2>
                <p className="text-sm text-steel">{message}</p>
              </>
            )}

            {status === 'error' && (
              <>
                <div className="w-16 h-16 bg-danger-light rounded-2xl flex items-center justify-center mx-auto mb-5">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-danger" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-charcoal tracking-tight mb-2">Error</h2>
                <p className="text-sm text-steel mb-6">{message}</p>
              </>
            )}

            <div className="mt-8 flex justify-center gap-3">
              <Button variant="outline" onClick={() => navigate('/attendance')}>
                View Attendance
              </Button>
              <Button onClick={() => navigate('/dashboard')}>
                Go to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AnimatedPage>
  );
}
