import {
  ref, uploadBytes, getDownloadURL, deleteObject,
} from 'firebase/storage';
import { storage } from './firebase';

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

export async function deleteProfilePhoto(uid: string) {
  const storageRef = ref(storage, `profiles/${uid}/photo`);
  await deleteObject(storageRef).catch(() => {});
}

export async function deleteProfileCatalog(uid: string) {
  const storageRef = ref(storage, `profiles/${uid}/catalog`);
  await deleteObject(storageRef).catch(() => {});
}
