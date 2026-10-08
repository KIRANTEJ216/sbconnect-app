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
    // Firebase DISCARDS whatever the `next` callback returns, so a cleanup
    // returned from inside it never runs. These teardown handles must live in
    // the effect scope and be released from the single unmount cleanup below —
    // otherwise every sign-in leaks an onSnapshot plus a beforeunload handler,
    // and token refresh multiplies it.
    let unsubProfile: (() => void) | null = null;
    let handleUnload: (() => void) | null = null;
    let signedInUid: string | null = null;
    let disposed = false;

    const releaseListeners = () => {
      unsubProfile?.();
      unsubProfile = null;
      if (handleUnload) {
        window.removeEventListener('beforeunload', handleUnload);
        handleUnload = null;
      }
    };

    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser: User | null) => {
      // A previous session's listeners must go before the next one attaches.
      releaseListeners();

      if (disposed) return;

      if (firebaseUser) {
        const appUser = userToAppUser(firebaseUser);
        setState((s) => ({ ...s, user: appUser, loading: false }));
        await setUserOnline(firebaseUser.uid);
        if (disposed) return;

        handleUnload = () => {
          void setUserOffline(firebaseUser.uid);
        };
        window.addEventListener('beforeunload', handleUnload);

        const uid = firebaseUser.uid;
        signedInUid = uid;

        const snap = await getDoc(doc(db, 'users', uid));
        // Bail out if the user signed out (or signed in as someone else) while
        // this await was in flight, otherwise we resurrect stale profile state.
        if (disposed || signedInUid !== uid) return;

        if (snap.exists()) {
          const data = snap.data() as UserProfile;
          if (SUPER_ADMIN_EMAILS.includes(data.email?.toLowerCase() ?? '') && data.role !== 'super_admin') {
            await updateDoc(doc(db, 'users', uid), { role: 'super_admin' });
            if (disposed || signedInUid !== uid) return;
            data.role = 'super_admin';
          }
          setState((s) => ({ ...s, profile: data }));
        }

        unsubProfile = onSnapshot(doc(db, 'users', uid), (profileSnap) => {
          if (disposed || signedInUid !== uid) return;
          if (profileSnap.exists()) {
            setState((s) => ({ ...s, profile: profileSnap.data() as UserProfile }));
          }
        });
      } else {
        signedInUid = null;
        setState({ user: null, profile: null, loading: false });
      }
    });

    return () => {
      disposed = true;
      releaseListeners();
      unsubAuth();
    };
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
