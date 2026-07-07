import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signIn, resolvePhoneToEmail } from '../lib/auth';
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
    if (user) navigate('/dashboard', { replace: true });
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
    <div className="min-h-[100dvh] flex items-center justify-center bg-canvas px-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-10">
          <div className="text-center mb-10">
            <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-btn">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
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
    </div>
    </AnimatedPage>
  );
}
