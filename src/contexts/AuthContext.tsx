import { createContext, useContext, useEffect, useState, useMemo } from 'react';
import type { ReactNode } from 'react';
import { onAuthStateChanged, onIdTokenChanged, type User } from 'firebase/auth';
import { doc, onSnapshot, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import type { AppUser, UserProfile } from '../types';
import { userToAppUser, setUserOnline, signOut } from '../lib/auth';
import { isAdminEmail, isSuperAdminEmail } from '../lib/admin';

const SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000;

interface AuthState {
  user: AppUser | null;
  profile: UserProfile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthState>({ user: null, profile: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, profile: null, loading: true });

  useEffect(() => {
    const unsubToken = onIdTokenChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const token = await firebaseUser.getIdTokenResult();
        const authTime = new Date(token.issuedAtTime).getTime();
        if (Date.now() - authTime > SESSION_TIMEOUT_MS) {
          await signOut();
          return;
        }
      }
    });

    const unsubAuth = onAuthStateChanged(auth, (firebaseUser: User | null) => {
      if (firebaseUser) {
        const appUser = userToAppUser(firebaseUser);
        setState((s) => ({ ...s, user: appUser, loading: false }));
        setUserOnline(firebaseUser.uid);

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

        return () => unsubProfile();
      } else {
        setState({ user: null, profile: null, loading: false });
      }
    });

    return () => { unsubAuth(); unsubToken(); };
  }, []);

  const value = useMemo(() => state, [state]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
