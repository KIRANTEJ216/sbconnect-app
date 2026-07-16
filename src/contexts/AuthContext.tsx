import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, onSnapshot, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import type { AppUser, UserProfile } from '../types';
import { userToAppUser, setUserOnline, setUserOffline } from '../lib/auth';
import { isAdminEmail, isSuperAdminEmail } from '../lib/admin';

interface AuthState {
  user: AppUser | null;
  profile: UserProfile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthState>({ user: null, profile: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, profile: null, loading: true });

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (firebaseUser: User | null) => {
      if (firebaseUser) {
        const appUser = userToAppUser(firebaseUser);
        setState((s) => ({ ...s, user: appUser, loading: false }));
        setUserOnline(firebaseUser.uid);

        const handleUnload = () => setUserOffline(firebaseUser.uid);
        window.addEventListener('beforeunload', handleUnload);

        const unsubProfile = onSnapshot(doc(db, 'users', firebaseUser.uid), (snap) => {
          if (snap.exists()) {
            const data = snap.data() as UserProfile;
            setState((s) => ({ ...s, profile: data }));
            const email = firebaseUser.email;
            if (email && isAdminEmail(email) && data.role === 'user') {
              getDoc(doc(db, 'users', firebaseUser.uid)).then((snap2) => {
                const fresh = snap2.data() as UserProfile | undefined;
                if (fresh && fresh.role === 'user') {
                  const role = isSuperAdminEmail(email) ? 'super_admin' : 'admin';
                  updateDoc(doc(db, 'users', firebaseUser.uid), { role }).catch(console.error);
                }
              });
            }
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
