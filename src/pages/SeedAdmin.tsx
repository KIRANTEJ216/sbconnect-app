import { useEffect, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { getAllUsers } from '../lib/firestore';
import { AnimatedPage } from '../components/motion/AnimatedPage';
import { getAuth } from 'firebase/auth';

export default function SeedAdmin() {
  const { user, profile } = useAuth();
  const [status, setStatus] = useState<'idle' | 'done' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!user || !profile) return;

    getAllUsers(1000).then(users => {
      const hasSuperAdmin = users.some(u => u.role === 'super_admin');

      if (hasSuperAdmin) {
        setMsg('Super admin already exists. This page is disabled.');
        setStatus('error');
        return;
      }

      if (profile.role === 'super_admin') {
        setMsg('You are already super_admin.');
        setStatus('done');
        return;
      }

      // Bootstrap: no super_admin exists yet, so promote this user directly
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setMsg('Not authenticated.');
        setStatus('error');
        return;
      }

      setDoc(doc(db, 'users', user.uid), { role: 'super_admin' }, { merge: true })
        .then(() => {
          setMsg('You are now super_admin! Reload the page.');
          setStatus('done');
        })
        .catch((err) => {
          console.error(err);
          setMsg('Failed to set role. Check console.');
          setStatus('error');
        });
    }).catch(() => {
      setMsg('Failed to check existing admins.');
      setStatus('error');
    });
  }, [user, profile]);

  return (
    <AnimatedPage>
    <div className="max-w-md mx-auto text-center py-20">
      <h1 className="text-fluid-h1 font-bold text-charcoal tracking-tight">Initial Super Admin Setup</h1>
      <p className={`mt-4 text-sm ${status === 'error' ? 'text-danger' : status === 'done' ? 'text-success' : 'text-steel'}`}>
        {msg || 'Checking...'}
      </p>
    </div>
    </AnimatedPage>
  );
}
