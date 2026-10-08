import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
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
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const redirectTo = searchParams.get('redirect') || '/dashboard';

  useEffect(() => {
    if (user) {
      navigate(redirectTo, { replace: true });
    }
  }, [user, navigate, redirectTo]);

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
      if (u) {
        fetch('https://api.ipify.org?format=json')
          .then((r) => r.json())
          .then((d) => logLogin(u.uid, u.email || email, u.displayName || '', d.ip))
          .catch(() => logLogin(u.uid, u.email || email, u.displayName || ''));
      }
      navigate(redirectTo, { replace: true });
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
      {/* Brand panel — a deep gradient field so the logo (navy artwork) has real
          contrast. The logo sits on a raised glass plate rather than floating
          directly on colour, which gives it depth without recolouring the asset. */}
      <div className="hidden lg:flex w-[46%] xl:w-1/2 relative overflow-hidden bg-ink">
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(150deg, #2A11A6 0%, #4A1FBF 38%, #7C2FB8 68%, #B536C5 100%)'
        }} />
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(ellipse 70% 55% at 18% 12%, rgba(255,255,255,0.16) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 88% 92%, rgba(212,168,83,0.20) 0%, transparent 65%)'
        }} />
        {/* Hairline arcs — geometry, not decoration-for-its-sake. */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.14]" aria-hidden="true">
          <circle cx="18%" cy="78%" r="380" fill="none" stroke="white" strokeWidth="1" />
          <circle cx="82%" cy="16%" r="240" fill="none" stroke="white" strokeWidth="1" />
          <circle cx="52%" cy="46%" r="520" fill="none" stroke="white" strokeWidth="1" />
        </svg>

        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 w-full">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-input bg-white/12 backdrop-blur-sm border border-white/20 grid place-items-center">
              <span className="text-white text-h3 font-bold leading-none">S</span>
            </div>
            <span className="text-white/90 text-sm font-semibold tracking-tight">SB Connect</span>
          </div>

          <div className="max-w-md">
            <div className="flex w-fit items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 backdrop-blur-sm mb-7">
              <span className="w-1.5 h-1.5 rounded-full bg-gold-bright" />
              <span className="text-micro font-semibold text-white/90 tracking-[0.08em] uppercase">
                Member Network
              </span>
            </div>

            {/* Raised plate keeps the navy logo legible on the gradient. */}
            <div className="flex w-fit items-center justify-center bg-white rounded-2xl px-10 py-8 shadow-luxury">
              <img
                src="/sbconnect-logo.png"
                alt="SB Connect"
                className="h-24 w-auto object-contain"
              />
            </div>

            <h2 className="mt-8 text-white text-fluid-h1 font-bold tracking-tight leading-[1.1]">
              Only Business,
              <br />
              No Politics.
            </h2>
            <p className="mt-4 text-white/70 text-body leading-relaxed max-w-sm">
              Refer business, track the revenue it generates, and keep every
              introduction accounted for across the chapter.
            </p>

            <dl className="mt-10 grid grid-cols-3 gap-4 max-w-sm">
              {[
                { k: 'Revenue', v: 'Tracked' },
                { k: 'Referrals', v: 'Credited' },
                { k: 'Meetings', v: 'Verified' },
              ].map((s) => (
                <div key={s.k} className="border-l-2 border-white/20 pl-3">
                  <dt className="text-micro text-white/55 tracking-[0.06em] uppercase">{s.k}</dt>
                  <dd className="text-sm font-semibold text-white mt-0.5">{s.v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <p className="text-micro text-white/40">
            &copy; {new Date().getFullYear()} SB Connect
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="w-full lg:w-[54%] xl:w-1/2 flex items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-[26rem]">
          <div className="lg:hidden flex flex-col items-center mb-9 text-center">
            <img
              src="/sbconnect-logo.png"
              alt="SB Connect"
              className="h-14 w-auto object-contain mb-4"
            />
            <p className="text-h3 font-bold tracking-tight text-charcoal">Only Business, No Politics.</p>
            <p className="text-sm text-muted mt-1.5 max-w-[16rem]">
              Refer business and track the revenue it generates.
            </p>
          </div>

          <div className="mb-8">
            <h1 className="text-h1 font-bold text-charcoal">Welcome back</h1>
            <p className="text-body text-muted mt-1.5">Sign in to your account</p>
          </div>

          <Card className="shadow-lg">
            <CardContent className="p-6 sm:p-7">
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label="Email or phone"
                  type="text"
                  autoComplete="username"
                  placeholder="you@company.com"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                />
                <Input
                  label="Password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />

                {error && (
                  <p role="alert" className="text-sm text-danger-strong bg-danger-light border border-danger/15 px-3.5 py-2.5 rounded-input">
                    {error}
                  </p>
                )}

                <Button type="submit" loading={loading} className="w-full !h-11">
                  Sign in
                </Button>
              </form>

              <div className="mt-6 pt-5 border-t border-border space-y-2.5 text-center">
                <Link
                  to="/reset-password"
                  className="block text-sm text-steel hover:text-primary transition-colors"
                >
                  Forgot password?
                </Link>
                <p className="text-sm text-muted">
                  Don't have an account?{' '}
                  <Link to="/register" className="text-primary hover:text-primary-hover font-semibold transition-colors">
                    Register
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>

          <p className="text-center text-micro text-faint mt-6">
            By signing in you agree to the chapter's code of conduct.
          </p>
        </div>
      </div>
    </div>
    </AnimatedPage>
  );
}
