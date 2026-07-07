import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signIn, resolvePhoneToEmail } from '../lib/auth';
import { auth } from '../lib/firebase';
import { logLogin } from '../lib/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { AnimatedPage } from '../components/motion/AnimatedPage';

export default function Login() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let email = identifier.includes('@') ? identifier : null;
      if (!email) {
        email = await resolvePhoneToEmail(identifier);
        if (!email) {
          setError('No account found with that phone number.');
          setLoading(false);
          return;
        }
      }
      await signIn(email, password);
      const u = auth.currentUser;
      if (u) logLogin(u.uid, u.email || email, u.displayName || '').catch(() => {});
    } catch (err: any) {
      const code = err.code;
      if (code === 'auth/user-not-found') setError('No account found with that email.');
      else if (code === 'auth/wrong-password') setError('Incorrect password.');
      else if (code === 'auth/invalid-credential') setError('Invalid email or password.');
      else if (code === 'auth/invalid-email') setError('Invalid email format.');
      else setError('Failed to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatedPage>
    <div className="min-h-[100dvh] flex bg-canvas">
      <div className="hidden lg:flex w-1/2 items-center justify-center p-12 relative overflow-hidden" style={{
        background: 'linear-gradient(135deg, #F5F0E8 0%, #F0E8F5 30%, #FAF5F0 60%, #F5F0F5 100%)'
      }}>
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(ellipse 60% 50% at 20% 30%, rgba(42,17,166,0.06) 0%, transparent 100%), radial-gradient(ellipse 50% 50% at 80% 60%, rgba(181,54,197,0.05) 0%, transparent 100%), radial-gradient(ellipse 40% 40% at 50% 80%, rgba(212,168,83,0.04) 0%, transparent 100%)`
        }} />
        <div className="absolute top-12 left-12 w-32 h-32 border border-primary/5 rounded-full" />
        <div className="absolute bottom-24 right-16 w-48 h-48 border border-secondary/5 rounded-full" />
        <div className="absolute top-1/3 right-8 w-16 h-16 bg-primary/3 rounded-full" />
        <div className="relative z-10 flex flex-col items-center animate-[fade-in_0.8s_ease-out]">
          <img
            src="/sbconnect-logo.png"
            alt="SB Connect"
            className="w-72 h-auto object-contain drop-shadow-lg animate-[float_6s_ease-in-out_infinite]"
          />
          <p className="text-steel/80 text-sm font-mono tracking-tight mt-6 animate-[fade-in_1s_ease-out_0.3s_both]">No Politics Only Business</p>
        </div>
      </div>
      <div className="w-full lg:w-1/2 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex flex-col items-center mb-10">
            <img
              src="/sbconnect-logo.png"
              alt="SB Connect"
              className="w-40 h-auto object-contain mb-4"
            />
          </div>
          <Card>
            <CardContent className="p-10">
              <div className="text-center mb-10">
                <h1 className="text-2xl font-bold text-charcoal tracking-tight">Welcome back</h1>
                <p className="text-sm text-steel mt-1.5">Sign in to your account</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <Input
                  label="Email or Phone"
                  type="text"
                  placeholder="you@example.com"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                />
                <Input
                  label="Password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />

                {error && (
                  <p className="text-sm text-danger bg-danger-light px-4 py-2.5 rounded-xl">{error}</p>
                )}

                <Button type="submit" loading={loading} className="w-full">
                  Sign in
                </Button>
              </form>

              <div className="mt-8 text-center space-y-3">
                <Link
                  to="/reset-password"
                  className="text-sm text-muted hover:text-primary transition-colors"
                >
                  Forgot password?
                </Link>
                <p className="text-sm text-muted">
                  Don't have an account?{' '}
                  <Link to="/register" className="text-primary hover:text-primary-hover font-medium transition-colors">
                    Register
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>
          <p className="text-center text-xs text-muted mt-6 lg:hidden">No Politics Only Business</p>
        </div>
      </div>
    </div>
    </AnimatedPage>
  );
}
