import { useEffect, useState } from 'react';
import { navigate } from '../router';
import { gamesStore, rostersStore, useStore } from '../store';
import { photoLinksStore, requestPersistentStorage } from '../photos';
import { type BackupFile, backupFileName, buildBackup, describeBackup, lastBackupAt, markBackedUp, parseBackup, restoreBackup } from '../backup';
import { isNativeApp, saveTextFile } from '../files';
import { timeAgo } from './common';

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function Backup() {
  const rosters = useStore(rostersStore);
  const games = useStore(gamesStore);
  const links = useStore(photoLinksStore);
  const photoCount = new Set(Object.values(links).flat()).size;
  const [includePhotos, setIncludePhotos] = useState(true);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<BackupFile | null>(null);
  const [usage, setUsage] = useState('');
  const [last, setLast] = useState(lastBackupAt());

  useEffect(() => {
    navigator.storage
      ?.estimate?.()
      .then((e) => e.usage !== undefined && setUsage(`${formatBytes(e.usage)} used on this device${e.quota ? ` (of ${formatBytes(e.quota)} available)` : ''}`))
      .catch(() => undefined);
    requestPersistentStorage();
  }, []);

  const backup = async () => {
    setBusy(true);
    setStatus('Preparing backup…');
    try {
      const b = await buildBackup({ includePhotos });
      const text = JSON.stringify(b);
      await saveTextFile(backupFileName(), text);
      markBackedUp();
      setLast(lastBackupAt());
      setStatus(`Backup created (${formatBytes(text.length)}): ${b.rosters.length} lists, ${b.games.length} games, ${b.photos.length} photos.`);
    } catch (e) {
      setStatus(`Backup failed: ${String((e as Error).message ?? e)}`);
    }
    setBusy(false);
  };

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setStatus('');
    try {
      setPending(parseBackup(await file.text()));
    } catch (e) {
      setStatus(String((e as Error).message ?? e));
    }
  };

  const restore = async (mode: 'merge' | 'replace') => {
    if (!pending) return;
    if (mode === 'replace' && !confirm('Replace ALL lists, games and photo links on this device with the backup? This cannot be undone.')) return;
    setBusy(true);
    try {
      const s = await restoreBackup(pending, mode);
      setStatus(
        mode === 'replace'
          ? `Restored ${s.rosters.added} lists, ${s.games.added} games and ${s.photos} photos.`
          : `Restored: ${s.rosters.added} new and ${s.rosters.updated} updated lists, ${s.games.added} new and ${s.games.updated} updated games, ${s.photos} photos.`,
      );
      setPending(null);
    } catch (e) {
      setStatus(`Restore failed: ${String((e as Error).message ?? e)}`);
    }
    setBusy(false);
  };

  const contents = pending ? describeBackup(pending) : undefined;

  return (
    <>
      <div className="topbar">
        <button className="icon ghost" onClick={() => navigate('/')} aria-label="Back">
          ←
        </button>
        <div className="title">Backup &amp; restore</div>
      </div>
      <div className="page stack">
        <div className="card">
          <h3>On this device</h3>
          <p className="small">
            {rosters.length} army list{rosters.length === 1 ? '' : 's'} · {games.length} game{games.length === 1 ? '' : 's'} · {photoCount} photo{photoCount === 1 ? '' : 's'}
          </p>
          {usage && <p className="tiny muted">{usage}</p>}
          <p className="tiny muted">Last backup: {last ? timeAgo(last) : 'never'}</p>
        </div>

        <div className="card">
          <h3>Back up</h3>
          <p className="small muted">
            Saves everything in one file.{' '}
            {isNativeApp()
              ? 'Choose Google Drive (or Files, email…) in the share menu to keep it safe.'
              : 'Keep the downloaded file somewhere safe, e.g. upload it to Google Drive.'}
          </p>
          <label className="opt small">
            <input type="checkbox" checked={includePhotos} onChange={(e) => setIncludePhotos(e.target.checked)} />
            <span className="name">Include photos (makes the file larger)</span>
          </label>
          <button className="primary" onClick={backup} disabled={busy}>
            {busy ? 'Working…' : 'Create backup file'}
          </button>
        </div>

        <div className="card">
          <h3>Restore</h3>
          <p className="small muted">Pick a backup file (or a single exported list). You can merge it with what is on this device or replace everything.</p>
          <label className="btn">
            Choose backup file…
            <input type="file" hidden onChange={(e) => (pick(e.target.files?.[0]), (e.target.value = ''))} />
          </label>
          {pending && contents && (
            <div className="stage current" style={{ marginTop: 10 }}>
              <p className="small" style={{ marginTop: 0 }}>
                Backup from {pending.exportedAt ? new Date(pending.exportedAt).toLocaleString() : 'unknown date'}: {contents.rosters} lists, {contents.games} games,{' '}
                {contents.photos} photos.
              </p>
              <div className="row">
                <button className="primary" onClick={() => restore('merge')} disabled={busy}>
                  Merge into this device
                </button>
                <button className="danger" onClick={() => restore('replace')} disabled={busy}>
                  Replace everything
                </button>
                <button className="ghost" onClick={() => setPending(null)}>
                  Cancel
                </button>
              </div>
              <p className="tiny muted">Merge keeps the most recently edited copy of each list and game.</p>
            </div>
          )}
        </div>
        {status && <div className="card small">{status}</div>}
      </div>
    </>
  );
}
