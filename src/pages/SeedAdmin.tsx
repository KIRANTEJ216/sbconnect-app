import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { setUserRole } from '../lib/firestore';
import { AnimatedPage } from '../components/motion/AnimatedPage';

export default function SeedAdmin() {
  const { user, profile } = useAuth();
  const [status, setStatus] = useState<'idle' | 'done' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!user || !profile) return;
    if (profile.role === 'super_admin') {
      setMsg('You are already super_admin.');
      setStatus('done');
      return;
    }
    if (user.email !== 'kktej3d@gmail.com') {
      setMsg('This page is only for kktej3d@gmail.com.');
      setStatus('error');
      return;
    }
    setUserRole(user.uid, 'super_admin')
      .then(() => {
        setMsg('✅ You are now super_admin! Reload the page.');
        setStatus('done');
      })
      .catch((err) => {
        console.error(err);
        setMsg('Failed to set role. Check console.');
        setStatus('error');
      });
  }, [user, profile]);

  return (
    <AnimatedPage>
    <div className="max-w-md mx-auto text-center py-20">
      <h1 className="text-xl font-bold text-charcoal tracking-tight">Seed Admin</h1>
      <p className={`mt-4 text-sm ${status === 'error' ? 'text-danger' : status === 'done' ? 'text-success' : 'text-steel'}`}>
        {msg || 'Checking...'}
      </p>
    </div>
    </AnimatedPage>
  );
}
