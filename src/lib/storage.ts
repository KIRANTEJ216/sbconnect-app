import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './firebase';

export async function uploadProfilePhoto(uid: string, file: File): Promise<string> {
  const storageRef = ref(storage, `profiles/${uid}/photo_${Date.now()}`);
  const snap = await uploadBytes(storageRef, file);
  return getDownloadURL(snap.ref);
}

export async function replaceProfilePhoto(uid: string, file: File, oldPhotoURL: string): Promise<string> {
  if (oldPhotoURL) {
    try {
      const oldRef = ref(storage, oldPhotoURL);
      await deleteObject(oldRef);
    } catch {}
  }
  return uploadProfilePhoto(uid, file);
}

export async function uploadCatalogFiles(uid: string, files: File[]): Promise<string[]> {
  const urls: string[] = [];
  for (const file of files) {
    const storageRef = ref(storage, `profiles/${uid}/catalog/${Date.now()}_${file.name}`);
    const snap = await uploadBytes(storageRef, file);
    urls.push(await getDownloadURL(snap.ref));
  }
  return urls;
}
