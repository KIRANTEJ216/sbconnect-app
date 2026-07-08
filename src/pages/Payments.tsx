import { Card, CardContent } from '../components/ui/Card';
import { AnimatedPage } from '../components/motion/AnimatedPage';

export default function Payments() {
  return (
    <AnimatedPage>
      <div className="max-w-2xl mx-auto text-center py-16">
        <Card>
          <CardContent className="p-12 sm:p-16">
            <div className="w-20 h-20 bg-primary-light rounded-3xl flex items-center justify-center mx-auto mb-6">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-primary" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="5" width="22" height="14" rx="2" ry="2" />
                <line x1="1" y1="10" x2="23" y2="10" />
                <circle cx="12" cy="15" r="1" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-charcoal tracking-tight mb-3">Payments</h1>
            <p className="text-steel text-base mb-4">Razorpay payment integration coming soon.</p>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-muted-bg rounded-xl text-sm text-muted font-medium">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Coming Soon
            </div>
            <p className="text-xs text-muted mt-8 max-w-sm mx-auto">
              Soon you'll be able to pay membership fees, renew subscriptions, and make secure payments through Razorpay.
            </p>
          </CardContent>
        </Card>
      </div>
    </AnimatedPage>
  );
}
