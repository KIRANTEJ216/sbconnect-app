import {
  ref, uploadBytes, getDownloadURL, deleteObject,
} from 'firebase/storage';
import { storage } from './firebase';

export async function uploadProfilePhoto(uid: string, file: File): Promise<string> {
  const storageRef = ref(storage, `profiles/${uid}/photo.${file.name.split('.').pop()}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export async function uploadProfileCatalog(uid: string, file: File): Promise<string> {
  const storageRef = ref(storage, `profiles/${uid}/catalog.pdf`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export async function deleteProfilePhoto(uid: string) {
  const storageRef = ref(storage, `profiles/${uid}/photo`);
  await deleteObject(storageRef).catch(() => {});
}

export async function deleteProfileCatalog(uid: string) {
  const storageRef = ref(storage, `profiles/${uid}/catalog.pdf`);
  await deleteObject(storageRef).catch(() => {});
}
