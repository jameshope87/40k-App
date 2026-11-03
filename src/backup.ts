/**
 * Backup / restore of everything the app stores on the device: army lists,
 * games, settings and unit photos, as a single JSON file.
 *
 * Records are merged by uid using their `updatedAt` timestamps, which is the
 * same strategy a future cloud sync can use.
 */
import type { Roster } from './roster/model';
import type { GameState } from './play/game';
import { gamesStore, rostersStore, settingsStore, type Settings } from './store';
import { base64ToBlob, blobToBase64, getPhoto, photoLinksStore, putPhoto } from './photos';

export const BACKUP_FORMAT = 'muster-and-battle-backup';
export const BACKUP_VERSION = 1;

export interface BackupPhoto {
  id: string;
  type: string;
  width: number;
  height: number;
  createdAt: number;
  data: string; // base64
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: number;
  rosters: Roster[];
  games: GameState[];
  settings?: Settings;
  photoLinks: Record<string, string[]>;
  photos: BackupPhoto[];
}

export interface BackupContents {
  rosters: number;
  games: number;
  photos: number;
}

export function describeBackup(b: BackupFile): BackupContents {
  return { rosters: b.rosters.length, games: b.games.length, photos: b.photos.length };
}

export async function buildBackup(opts: { includePhotos?: boolean } = {}): Promise<BackupFile> {
  const includePhotos = opts.includePhotos ?? true;
  const links = photoLinksStore.get();
  const photos: BackupPhoto[] = [];
  if (includePhotos) {
    const ids = [...new Set(Object.values(links).flat())];
    for (const id of ids) {
      const rec = await getPhoto(id);
      if (!rec) continue;
      photos.push({ id, type: rec.blob.type || 'image/jpeg', width: rec.width, height: rec.height, createdAt: rec.createdAt, data: await blobToBase64(rec.blob) });
    }
  }
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    rosters: rostersStore.get(),
    games: gamesStore.get(),
    settings: settingsStore.get(),
    photoLinks: includePhotos ? links : {},
    photos,
  };
}

export function parseBackup(text: string): BackupFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('This file is not a valid backup (it is not JSON).');
  }
  const b = data as Partial<BackupFile>;
  if (b.format !== BACKUP_FORMAT) {
    // Accept a single exported army list too.
    const r = data as Partial<Roster>;
    if (r && r.uid && r.forces && r.catalogueFile) {
      return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: Date.now(), rosters: [r as Roster], games: [], photoLinks: {}, photos: [] };
    }
    throw new Error('This file is not a Muster & Battle backup.');
  }
  if ((b.version ?? 0) > BACKUP_VERSION) throw new Error('This backup was made by a newer version of the app. Please update the app first.');
  return {
    format: BACKUP_FORMAT,
    version: b.version ?? 1,
    exportedAt: b.exportedAt ?? 0,
    rosters: b.rosters ?? [],
    games: b.games ?? [],
    settings: b.settings,
    photoLinks: b.photoLinks ?? {},
    photos: b.photos ?? [],
  };
}

export interface MergeResult<T> {
  items: T[];
  added: number;
  updated: number;
  unchanged: number;
}

/** Merge records by uid, keeping whichever copy was updated most recently. */
export function mergeByUid<T extends { uid: string; updatedAt: number }>(existing: T[], incoming: T[]): MergeResult<T> {
  const byId = new Map(existing.map((x) => [x.uid, x]));
  let added = 0;
  let updated = 0;
  let unchanged = 0;
  for (const item of incoming) {
    const cur = byId.get(item.uid);
    if (!cur) {
      byId.set(item.uid, item);
      added++;
    } else if ((item.updatedAt ?? 0) > (cur.updatedAt ?? 0)) {
      byId.set(item.uid, item);
      updated++;
    } else unchanged++;
  }
  const items = [...byId.values()].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  return { items, added, updated, unchanged };
}

/** Union of photo links, keeping existing order and appending new ids. */
export function mergeLinks(existing: Record<string, string[]>, incoming: Record<string, string[]>): Record<string, string[]> {
  const out: Record<string, string[]> = { ...existing };
  for (const [k, ids] of Object.entries(incoming)) out[k] = [...new Set([...(out[k] ?? []), ...ids])];
  return out;
}

export interface RestoreSummary {
  rosters: { added: number; updated: number };
  games: { added: number; updated: number };
  photos: number;
}

/**
 * Restore a backup.
 *  - merge:   add anything new and replace older copies; keep everything else
 *  - replace: make the device match the backup exactly (photo data not in the
 *             backup is left in storage but unlinked)
 */
export async function restoreBackup(b: BackupFile, mode: 'merge' | 'replace'): Promise<RestoreSummary> {
  let photos = 0;
  for (const p of b.photos) {
    if (mode === 'merge' && (await getPhoto(p.id))) continue;
    await putPhoto({ id: p.id, blob: base64ToBlob(p.data, p.type), width: p.width, height: p.height, createdAt: p.createdAt });
    photos++;
  }
  if (mode === 'replace') {
    rostersStore.set(b.rosters);
    gamesStore.set(b.games);
    photoLinksStore.set(b.photoLinks);
    if (b.settings) settingsStore.set(b.settings);
    return { rosters: { added: b.rosters.length, updated: 0 }, games: { added: b.games.length, updated: 0 }, photos };
  }
  const r = mergeByUid(rostersStore.get(), b.rosters);
  const g = mergeByUid(gamesStore.get(), b.games);
  rostersStore.set(r.items);
  gamesStore.set(g.items);
  photoLinksStore.set(mergeLinks(photoLinksStore.get(), b.photoLinks));
  return { rosters: { added: r.added, updated: r.updated }, games: { added: g.added, updated: g.updated }, photos };
}

export function backupFileName(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `muster-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
}

const LAST_BACKUP_KEY = 'muster.lastBackupAt';
export function lastBackupAt(): number | undefined {
  try {
    const v = Number(localStorage.getItem(LAST_BACKUP_KEY));
    return v || undefined;
  } catch {
    return undefined;
  }
}
export function markBackedUp() {
  try {
    localStorage.setItem(LAST_BACKUP_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}
