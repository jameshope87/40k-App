import { describe, expect, it } from 'vitest';
import { BACKUP_FORMAT, mergeByUid, mergeLinks, parseBackup, restoreBackup } from './backup';
import { base64ToBlob, blobToBase64 } from './photos';
import { rostersStore } from './store';
import type { Roster } from './roster/model';

const roster = (uid: string, updatedAt: number, name = uid): Roster => ({
  uid, name, updatedAt, createdAt: 0, source: { repo: 'r', branch: 'b' }, gameSystemId: 'g', catalogueId: 'c', catalogueFile: 'c.json', catalogueName: 'C',
  forces: [{ uid: 'f', forceEntryId: 'fe', catalogueId: 'c', selections: [] }],
});

describe('backup', () => {
  it('merges records by uid keeping the newest copy', () => {
    const r = mergeByUid([roster('a', 10, 'old a'), roster('b', 50)], [roster('a', 20, 'new a'), roster('b', 40), roster('c', 5)]);
    expect(r.added).toBe(1);
    expect(r.updated).toBe(1);
    expect(r.unchanged).toBe(1);
    expect(r.items.find((x) => x.uid === 'a')!.name).toBe('new a');
    expect(r.items.map((x) => x.uid)).toEqual(['b', 'a', 'c']);
  });

  it('unions photo links', () => {
    expect(mergeLinks({ 'type:x': ['1', '2'] }, { 'type:x': ['2', '3'], 'unit:y': ['4'] })).toEqual({ 'type:x': ['1', '2', '3'], 'unit:y': ['4'] });
  });

  it('parses backups and single exported lists, and rejects other files', () => {
    const b = parseBackup(JSON.stringify({ format: BACKUP_FORMAT, version: 1, exportedAt: 1, rosters: [roster('a', 1)], games: [], photoLinks: {}, photos: [] }));
    expect(b.rosters).toHaveLength(1);
    expect(parseBackup(JSON.stringify(roster('z', 1))).rosters[0].uid).toBe('z');
    expect(() => parseBackup('{"hello":1}')).toThrow(/not a Muster/);
    expect(() => parseBackup('nope')).toThrow(/not JSON/);
    expect(() => parseBackup(JSON.stringify({ format: BACKUP_FORMAT, version: 99 }))).toThrow(/newer version/);
  });

  it('restores by merging into existing lists', async () => {
    rostersStore.set([roster('a', 10), roster('b', 10)]);
    const s = await restoreBackup(
      { format: BACKUP_FORMAT, version: 1, exportedAt: 1, rosters: [roster('b', 20, 'b2'), roster('c', 1)], games: [], photoLinks: {}, photos: [] },
      'merge',
    );
    expect(s.rosters).toEqual({ added: 1, updated: 1 });
    expect(rostersStore.get().map((r) => r.name).sort()).toEqual(['a', 'b2', 'c']);
  });

  it('round-trips photo data through base64', async () => {
    const bytes = new Uint8Array(70000).map((_, i) => (i * 31) % 256);
    const b64 = await blobToBase64(new Blob([bytes]));
    const back = new Uint8Array(await base64ToBlob(b64).arrayBuffer());
    expect(back).toEqual(bytes);
  });
});
