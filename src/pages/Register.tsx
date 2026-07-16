import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signUp } from '../lib/auth';
import { useAuth } from '../contexts/AuthContext';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { AnimatedPage } from '../components/motion/AnimatedPage';

export default function Register() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [surname, setSurname] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  useEffect(() => {
    if (user) navigate('/create-profile', { replace: true });
  }, [user, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (!termsAccepted) {
      setError('You must accept the Terms & Conditions to create an account.');
      return;
    }

    setLoading(true);
    try {
      const displayName = `${firstName} ${surname}`.trim();
      await signUp(email, password, displayName, surname, phone);
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') setError('An account with this email already exists.');
      else setError('Failed to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatedPage>
    <div className="min-h-[100dvh] flex items-center justify-center bg-canvas px-4 py-8">
      <Card className="w-full max-w-md">
        <CardContent className="p-10">
          <div className="text-center mb-10">
            <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-btn">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <h1 className="text-fluid-h1 font-bold text-charcoal tracking-tight">Create your account</h1>
            <p className="text-sm text-steel mt-1.5">Join the business community</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Full Name"
                type="text"
                placeholder="Ravi"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
              <Input
                label="Surname"
                type="text"
                placeholder="Sharma"
                value={surname}
                onChange={(e) => setSurname(e.target.value)}
                required
              />
            </div>
            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              label="Phone"
              type="tel"
              placeholder="+91-9876543210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
            <Input
              label="Password"
              type="password"
              placeholder="Min. 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Input
              label="Confirm Password"
              type="password"
              placeholder="Repeat your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />

            {error && (
              <p className="text-sm text-danger bg-danger-light px-4 py-2.5 rounded-xl">{error}</p>
            )}

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-border text-primary focus:ring-primary/30 accent-primary shrink-0"
              />
              <span className="text-xs text-steel leading-relaxed select-none">
                I consent to SB Connect collecting my name, phone number, and email for the purpose of community networking, event participation, and connecting with other members.{' '}
                <button
                  type="button"
                  onClick={() => setShowTerms(!showTerms)}
                  className="text-primary hover:text-primary-hover font-medium underline underline-offset-2 transition-colors cursor-pointer"
                >
                  {showTerms ? 'Hide' : 'View'} Terms &amp; Conditions
                </button>
              </span>
            </label>

            {showTerms && (
              <div className="text-xs text-steel bg-muted-bg rounded-xl p-4 space-y-2 leading-relaxed border border-border">
                <p className="font-semibold text-charcoal">Terms &amp; Conditions</p>
                <p><strong>1. Information We Collect</strong> — When you register, we collect your full name, phone number, and email address. You may optionally add a business profile with additional details such as company name, location, website, and business category.</p>
                <p><strong>2. How We Use Your Information</strong> — Your name and business profile are visible to other members in the directory for networking purposes. Your email and phone are used for event RSVPs, meeting coordination, and community communication. We do not share your data with third parties outside this platform.</p>
                <p><strong>3. Your Rights</strong> — You may request deletion of your account and associated data by contacting the admin. Profile information can be edited at any time from your profile page.</p>
                <p><strong>4. Acceptance</strong> — By checking the consent box and creating an account, you agree to these terms. If you do not agree, please do not register.</p>
              </div>
            )}

            <Button type="submit" loading={loading} className="w-full" disabled={!termsAccepted}>
              Create Account
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-muted">
            Already have an account?{' '}
            <Link to="/login" className="text-primary hover:text-primary-hover font-medium transition-colors">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
    </AnimatedPage>
  );
}
