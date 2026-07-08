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
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-danger-light text-danger border border-danger/20 text-sm">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <span>Attendance warning: {missing} more meeting{missing > 1 ? 's' : ''} required in 6-month window.</span>
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-danger-light rounded-2xl flex items-center justify-center shrink-0">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-danger" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-charcoal tracking-tight mb-1">Meeting Attendance Required</h3>
            <p className="text-sm text-steel leading-relaxed">
              You have attended <strong>{compliance.attendedCount}</strong> of {compliance.requiredCount} required meetings in the last {compliance.monthsWindow} months.
              {missing > 0 && (
                <> You need to attend <strong>{missing} more meeting{missing > 1 ? 's' : ''}</strong> to remain an active member.</>
              )}
            </p>
            <p className="text-sm text-steel mt-2">
              If you do not meet this requirement, you will need to <strong>renew your membership for ₹1,000</strong> to rejoin the community.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
