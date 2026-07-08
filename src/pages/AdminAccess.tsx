import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardContent } from '../components/ui/Card';
import { AnimatedPage } from '../components/motion/AnimatedPage';

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export default function AdminAccess() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<'initial' | 'code' | 'done'>('initial');
  const [code, setCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const isAlreadyAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';

  const handleRequestCode = async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const { doc, setDoc } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      const newCode = generateCode();
      const expiresAt = Date.now() + 5 * 60 * 1000;
      await setDoc(doc(db, 'adminCodes', user.uid), {
        uid: user.uid,
        email: user.email,
        code: newCode,
        expiresAt,
        used: false,
        createdAt: Date.now(),
      });
      setGeneratedCode(newCode);
      setStep('code');
      setMessage('Your verification code is ready.');
    } catch (err: any) {
      setError(err?.message || 'Failed to generate code. Try again.');
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
      const { doc, getDoc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      const snap = await getDoc(doc(db, 'adminCodes', user.uid));
      if (!snap.exists()) {
        setError('No code found. Request a new one.');
        setLoading(false);
        return;
      }
      const data = snap.data();
      if (data.used) {
        setError('Code already used. Request a new one.');
        setLoading(false);
        return;
      }
      if (Date.now() > data.expiresAt) {
        setError('Code expired. Request a new one.');
        setLoading(false);
        return;
      }
      if (data.code !== code) {
        setError('Incorrect code. Try again.');
        setLoading(false);
        return;
      }
      await updateDoc(doc(db, 'adminCodes', user.uid), { used: true });
      await updateDoc(doc(db, 'users', user.uid), { role: 'admin' });
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
                  <h1 className="text-2xl font-bold text-charcoal tracking-tight">Request Admin Access</h1>
                  <p className="text-sm text-steel mt-2">
                    Generate a verification code to upgrade your account to admin.
                  </p>
                </div>
                {error && <p className="text-sm text-danger bg-danger-light px-4 py-2.5 rounded-xl mb-4">{error}</p>}
                <Button onClick={handleRequestCode} loading={loading} className="w-full">
                  Generate Code
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
                  <h2 className="text-xl font-bold text-charcoal tracking-tight">Your Verification Code</h2>
                  <p className="text-sm text-steel mt-2">Enter this code below to verify. Code expires in 5 minutes.</p>
                  <div className="text-3xl font-bold tracking-[12px] text-primary bg-primary-light rounded-2xl py-4 px-6 mt-4 font-mono select-all">
                    {generatedCode}
                  </div>
                  <p className="text-xs text-muted mt-2">Copy this code and enter it below</p>
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
