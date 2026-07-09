import {
  ref, uploadBytes, getDownloadURL, deleteObject,
} from 'firebase/storage';
import { storage } from './firebase';

function isFirebaseStorageURL(url: string): boolean {
  return url.startsWith('https://firebasestorage.googleapis.com');
}

export async function uploadProfilePhoto(uid: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop();
  const storageRef = ref(storage, `profiles/${uid}/photo.${ext}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export async function uploadCatalogFiles(uid: string, files: File[]): Promise<string[]> {
  const urls: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const ext = file.name.split('.').pop();
    const storageRef = ref(storage, `profiles/${uid}/catalog/${i}.${ext}`);
    await uploadBytes(storageRef, file);
    urls.push(await getDownloadURL(storageRef));
  }
  return urls;
}

export async function deleteStorageFile(url: string): Promise<void> {
  if (!url || !isFirebaseStorageURL(url)) return;
  try {
    const storageRef = ref(storage, url);
    await deleteObject(storageRef);
  } catch (e) {
    if (e instanceof Error && e.message.includes('object-not-found')) return;
    throw e;
  }
}

export async function replaceProfilePhoto(uid: string, file: File, currentPhotoURL: string): Promise<string> {
  if (currentPhotoURL) await deleteStorageFile(currentPhotoURL);
  return uploadProfilePhoto(uid, file);
}
