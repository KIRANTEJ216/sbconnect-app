import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './firebase';

export async function uploadProfilePhoto(uid: string, file: File): Promise<string> {
  const compressed = await compressProfilePhoto(file, 400, 0.75);
  const storageRef = ref(storage, `profiles/${uid}/photo_${Date.now()}`);
  const snap = await uploadBytes(storageRef, compressed);
  return getDownloadURL(snap.ref);
}

export async function replaceProfilePhoto(uid: string, file: File, oldPhotoURL: string): Promise<string> {
  if (oldPhotoURL) {
    try {
      const oldPath = decodeURIComponent(oldPhotoURL.split('/o/')[1]?.split('?')[0] || '');
      if (oldPath) {
        const oldRef = ref(storage, oldPath);
        await deleteObject(oldRef);
      }
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

export async function downloadCatalogFile(url: string, index: number) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const ext = blob.type.includes('pdf') ? '.pdf' : blob.type.includes('png') ? '.png' : blob.type.includes('webp') ? '.webp' : '.jpg';
    const filename = `catalog-${index + 1}${ext}`;
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objectUrl);
  } catch {
    window.open(url, '_blank');
  }
}

export function compressProfilePhoto(file: File, size = 400, quality = 0.75): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const s = Math.min(img.width, img.height);
      const sx = (img.width - s) / 2;
      const sy = (img.height - s) / 2;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Compression failed'));
        },
        'image/jpeg',
        quality,
      );
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

export function compressImage(file: File, maxWidth = 400, quality = 0.75): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let w = img.width;
      let h = img.height;
      if (w > maxWidth) {
        h = (h / w) * maxWidth;
        w = maxWidth;
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Compression failed'));
        },
        'image/jpeg',
        quality,
      );
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}
