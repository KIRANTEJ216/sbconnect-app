import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  doc, setDoc, getDoc, getDocs, collection, query, where,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import type { UserProfile } from '../types';

export async function signIn(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signUp(
  email: string,
  password: string,
  displayName: string,
  surname: string,
  phone: string,
) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(credential.user, { displayName });
  await setDoc(doc(db, 'users', credential.user.uid), {
    uid: credential.user.uid,
    email,
    phone,
    displayName,
    surname,
    photoURL: '',
    onlineStatus: 'online',
    role: 'user',
    lastSeen: Date.now(),
    createdAt: Date.now(),
  });
  return credential;
}

export async function resetPassword(email: string) {
  return sendPasswordResetEmail(auth, email);
}

export async function signOut() {
  const user = auth.currentUser;
  if (user) {
    await setDoc(
      doc(db, 'users', user.uid),
      { onlineStatus: 'offline', lastSeen: Date.now() },
      { merge: true },
    );
  }
  return firebaseSignOut(auth);
}

export async function resolvePhoneToEmail(phone: string): Promise<string | null> {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  const q1 = query(collection(db, 'users'), where('phone', '==', digits));
  const snap1 = await getDocs(q1);
  if (!snap1.empty) return snap1.docs[0].data().email as string;
  const q2 = query(collection(db, 'users'), where('phone', '==', `+91-${digits}`));
  const snap2 = await getDocs(q2);
  if (!snap2.empty) return snap2.docs[0].data().email as string;
  return null;
}

export async function setUserOnline(uid: string) {
  await setDoc(
    doc(db, 'users', uid),
    { onlineStatus: 'online', lastSeen: Date.now() },
    { merge: true },
  );
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  return snap.data() as UserProfile;
}

export function userToAppUser(user: User) {
  return {
    uid: user.uid,
    email: user.email,
    phone: user.phoneNumber,
    displayName: user.displayName,
    photoURL: user.photoURL,
  };
}
