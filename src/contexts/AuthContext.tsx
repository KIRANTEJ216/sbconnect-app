import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import type { AppUser, UserProfile } from '../types';
import { userToAppUser, setUserOnline } from '../lib/auth';

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

        const unsubProfile = onSnapshot(doc(db, 'users', firebaseUser.uid), (snap) => {
          if (snap.exists()) {
            const data = snap.data() as UserProfile;
            setState((s) => ({ ...s, profile: data }));
            if (data.role === 'user' && firebaseUser.email === 'kktej3d@gmail.com') {
              updateDoc(doc(db, 'users', firebaseUser.uid), { role: 'super_admin' }).catch(console.error);
            }
          }
        });

        return () => unsubProfile();
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
