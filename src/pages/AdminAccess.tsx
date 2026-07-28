import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardContent } from '../components/ui/Card';
import { AnimatedPage } from '../components/motion/AnimatedPage';

export default function AdminAccess() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<'initial' | 'code' | 'done'>('initial');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const isAlreadyAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';

  const sendAdminCode = httpsCallable(functions, 'sendAdminCode');
  const verifyAdminCode = httpsCallable(functions, 'verifyAdminCode');

  const handleRequestCode = async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      await sendAdminCode();
      setStep('code');
      setMessage('Verification code sent to your email.');
    } catch (err: any) {
      setError(err?.message || 'Failed to send code. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (code.length !== 6) {
      setError('Enter the 6-digit code to continue.');
      return;
    }
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      await verifyAdminCode({ code });
      setStep('done');
      setMessage('You are now an admin! Redirecting...');
      setTimeout(() => navigate('/admin', { replace: true }), 2000);
    } catch (err: any) {
      setError(err?.message || 'Verification failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  if (isAlreadyAdmin) {
    return (
      <AnimatedPage>
        <div className="max-w-md mx-auto text-center py-20">
          <Card>
            <CardContent className="p-10">
              <div className="w-16 h-16 bg-success-light rounded-2xl flex items-center justify-center mx-auto mb-5">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-success" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-charcoal tracking-tight mb-2">You're already an admin</h2>
              <Button onClick={() => navigate('/admin')}>Go to Admin Panel</Button>
            </CardContent>
          </Card>
        </div>
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage>
      <div className="max-w-md mx-auto py-12">
        <Card>
          <CardContent className="p-8 sm:p-10">
            {step === 'initial' && (
              <>
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-primary-light rounded-2xl flex items-center justify-center mx-auto mb-5">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-primary" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  </div>
                  <h1 className="text-fluid-h1 font-bold text-charcoal tracking-tight">Request Admin Access</h1>
                  <p className="text-sm text-steel mt-2">
                    A verification code will be sent to your email to upgrade your account to admin.
                  </p>
                </div>
                {error && <p className="text-sm text-danger bg-danger-light px-4 py-2.5 rounded-xl mb-4">{error}</p>}
                <Button onClick={handleRequestCode} loading={loading} className="w-full">
                  Send Code to Email
                </Button>
              </>
            )}

            {step === 'code' && (
              <>
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-primary-light rounded-2xl flex items-center justify-center mx-auto mb-5">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-primary" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                      <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-bold text-charcoal tracking-tight">Check Your Email</h2>
                  <p className="text-sm text-steel mt-2">Enter the 6-digit code sent to your email. Code expires in 5 minutes.</p>
                </div>
                {error && <p className="text-sm text-danger bg-danger-light px-4 py-2.5 rounded-xl mb-4">{error}</p>}
                <div className="space-y-4">
                  <Input
                    label="6-digit code"
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    className="text-center text-2xl tracking-[8px] font-mono"
                  />
                  <Button onClick={handleVerifyCode} loading={loading} className="w-full">
                    Verify & Become Admin
                  </Button>
                  <button
                    onClick={() => { setStep('initial'); setError(''); }}
                    className="w-full text-sm text-muted hover:text-primary transition-colors cursor-pointer"
                  >
                    Request a new code
                  </button>
                </div>
              </>
            )}

            {step === 'done' && (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-success-light rounded-2xl flex items-center justify-center mx-auto mb-5">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-success" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-charcoal tracking-tight mb-2">Verified!</h2>
                <p className="text-sm text-steel">{message}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AnimatedPage>
  );
}
