/**
 * Unit photos, stored on the device.
 *
 * Image data lives in IndexedDB (photos can be large); which photo belongs to
 * which unit is a small JSON map in localStorage so it can be backed up and,
 * later, synced like the rest of the app's data.
 *
 * Link keys:
 *  - `type:<entryId>`  every unit made from that datasheet (in any list or game)
 *  - `unit:<selUid>`   one particular unit in one list
 */
import { useEffect, useState } from 'react';
import { createStore, del, get, set } from 'idb-keyval';
import { PersistedStore, useStore } from './store';
import { uid } from './roster/model';

export interface PhotoRecord {
  id: string;
  blob: Blob;
  width: number;
  height: number;
  createdAt: number;
}

const store = typeof indexedDB !== 'undefined' ? createStore('muster-photos', 'photos') : undefined;

/** key → photo ids (first one is the main photo). */
export const photoLinksStore = new PersistedStore<Record<string, string[]>>('muster.photoLinks', {});

export const typeKey = (entryId: string) => `type:${entryId}`;
export const unitKey = (selUid: string) => `unit:${selUid}`;

/** Keys to look up for a unit, most specific first. */
export function unitPhotoKeys(entryId: string | undefined, selUid: string | undefined): string[] {
  return [selUid ? unitKey(selUid) : '', entryId ? typeKey(entryId) : ''].filter(Boolean);
}

// ---- image processing ------------------------------------------------------

/** Downscale and re-encode a picked image so it stays small on the device. */
export async function resizeImage(file: Blob, maxSide = 1280, quality = 0.82): Promise<{ blob: Blob; width: number; height: number }> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('This image format is not supported. Please choose a JPEG or PNG photo.');
  }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not process the image'))), 'image/jpeg', quality),
  );
  return { blob, width, height };
}

// ---- storage ---------------------------------------------------------------

export async function getPhoto(id: string): Promise<PhotoRecord | undefined> {
  if (!store) return undefined;
  return get<PhotoRecord>(id, store);
}

export async function putPhoto(rec: PhotoRecord) {
  if (!store) throw new Error('Photo storage is not available in this browser');
  await set(rec.id, rec, store);
}

/** Resize, store and link a picked image. Returns the new photo id. */
export async function addPhoto(file: Blob, key: string): Promise<string> {
  const { blob, width, height } = await resizeImage(file);
  const id = uid();
  await putPhoto({ id, blob, width, height, createdAt: Date.now() });
  photoLinksStore.set((links) => ({ ...links, [key]: [...(links[key] ?? []), id] }));
  requestPersistentStorage();
  return id;
}

/** Remove a photo everywhere it is linked and delete its data. */
export async function removePhoto(id: string) {
  photoLinksStore.set((links) => {
    const next: Record<string, string[]> = {};
    for (const [k, ids] of Object.entries(links)) {
      const left = ids.filter((x) => x !== id);
      if (left.length) next[k] = left;
    }
    return next;
  });
  urlCache.delete(id);
  if (store) await del(id, store);
}

/** Make a photo the main (first) one for its key. */
export function makeMainPhoto(key: string, id: string) {
  photoLinksStore.set((links) => ({ ...links, [key]: [id, ...(links[key] ?? []).filter((x) => x !== id)] }));
}

/** Ask the browser not to evict our storage (photos would be lost otherwise). */
export function requestPersistentStorage() {
  try {
    void navigator.storage?.persist?.();
  } catch {
    /* not supported */
  }
}

// ---- React hooks -----------------------------------------------------------

export interface LinkedPhoto {
  id: string;
  key: string;
}

/** Photos for a unit: its own photos first, then those shared by its datasheet. */
export function usePhotos(keys: string[]): LinkedPhoto[] {
  const links = useStore(photoLinksStore);
  return keys.flatMap((key) => (links[key] ?? []).map((id) => ({ id, key })));
}

const urlCache = new Map<string, string>();

export function usePhotoUrl(id: string | undefined): string | undefined {
  const [url, setUrl] = useState(() => (id ? urlCache.get(id) : undefined));
  useEffect(() => {
    if (!id) return setUrl(undefined);
    const hit = urlCache.get(id);
    if (hit) return setUrl(hit);
    let alive = true;
    getPhoto(id).then((rec) => {
      if (!rec || !alive) return;
      const u = URL.createObjectURL(rec.blob);
      urlCache.set(id, u);
      setUrl(u);
    });
    return () => {
      alive = false;
    };
  }, [id]);
  return url;
}

// ---- (de)serialisation for backups ------------------------------------------

export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

export function base64ToBlob(data: string, type = 'image/jpeg'): Blob {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}
