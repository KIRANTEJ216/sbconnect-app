import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, onSnapshot, updateDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import type { AppUser, UserProfile } from '../types';
import { userToAppUser, setUserOnline, setUserOffline } from '../lib/auth';

const SUPER_ADMIN_EMAILS = ['kktej3d@gmail.com'];

interface AuthState {
  user: AppUser | null;
  profile: UserProfile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthState>({ user: null, profile: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, profile: null, loading: true });

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser: User | null) => {
      if (firebaseUser) {
        const appUser = userToAppUser(firebaseUser);
        setState((s) => ({ ...s, user: appUser, loading: false }));
        await setUserOnline(firebaseUser.uid);

        const handleUnload = () => setUserOffline(firebaseUser.uid);
        window.addEventListener('beforeunload', handleUnload);

        const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (snap.exists()) {
          const data = snap.data() as UserProfile;
          if (SUPER_ADMIN_EMAILS.includes(data.email?.toLowerCase() ?? '') && data.role !== 'super_admin') {
            await updateDoc(doc(db, 'users', firebaseUser.uid), { role: 'super_admin' });
            data.role = 'super_admin';
          }
          setState((s) => ({ ...s, profile: data }));
        }

        const unsubProfile = onSnapshot(doc(db, 'users', firebaseUser.uid), (snap) => {
          if (snap.exists()) {
            setState((s) => ({ ...s, profile: snap.data() as UserProfile }));
          }
        });

        return () => {
          unsubProfile();
          window.removeEventListener('beforeunload', handleUnload);
        };
      } else {
        setState({ user: null, profile: null, loading: false });
      }
    });

    return () => unsubAuth();
  }, []);

  return (
    <AuthContext.Provider value={state}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
