import { useAttendanceCompliance } from '../hooks/useFirebaseQuery';
import { Card, CardContent } from './ui/Card';

interface StrikeWarningProps {
  uid: string;
  compact?: boolean;
}

export function StrikeWarning({ uid, compact }: StrikeWarningProps) {
  const { data: compliance, isLoading } = useAttendanceCompliance(uid);

  if (isLoading) return null;
  if (!compliance) return null;
  if (compliance.compliant) return null;

  const missing = compliance.requiredCount - compliance.attendedCount;

  if (compact) {
    return (
      <p className="text-xs text-danger font-medium text-center">
        ⚠️ Attendance warning — {missing} more meeting{missing > 1 ? 's' : ''} required in 6-month window
      </p>
    );
  }

  return (
    <Card className="stat-accent-top overflow-hidden">
      <CardContent className="p-3 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-danger-light rounded-2xl flex items-center justify-center shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-danger" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-charcoal tracking-tight">Meeting Attendance Required</h3>
              <span className="px-2 py-0.5 rounded-full bg-danger/10 border border-danger/20 text-[10px] font-bold text-danger tracking-tight">
                {missing} {missing > 1 ? 'Meetings' : 'Meeting'} Needed
              </span>
            </div>
            <p className="text-sm text-steel leading-relaxed">
              You have attended <strong className="text-danger">{compliance.attendedCount}</strong> of <strong>{compliance.requiredCount}</strong> required meetings in the last {compliance.monthsWindow} months.
              {missing > 0 && (
                <> You need to attend <strong className="text-danger">{missing} more meeting{missing > 1 ? 's' : ''}</strong> to remain an active member.</>
              )}
            </p>
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-danger-light border border-danger/15">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-danger shrink-0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <p className="text-xs text-steel">
                Non-compliance requires <strong className="text-danger">renewing at ₹1,000</strong> to rejoin the community
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
