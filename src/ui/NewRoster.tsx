import { useMemo, useState } from 'react';
import { settingsStore, saveRoster, useStore } from '../store';
import { useSource, getIndex } from '../useCatalogue';
import { fileLabel } from '../bsdata/loader';
import { navigate } from '../router';
import { ErrorBox, Loading } from './common';
import { Evaluator } from '../bsdata/engine';
import { type Roster, uid } from '../roster/model';

export default function NewRoster() {
  const settings = useStore(settingsStore);
  const { ls, error, progress } = useSource(settings.source);
  const [filter, setFilter] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState('');
  const [createError, setCreateError] = useState('');

  const files = useMemo(() => {
    const q = filter.toLowerCase();
    return (ls?.armyFiles ?? []).filter((f) => fileLabel(f.name).toLowerCase().includes(q));
  }, [ls, filter]);

  const create = async (file: string) => {
    setCreateError('');
    try {
      const index = await getIndex(settings.source, file, setBusy);
      const roster: Roster = {
        uid: uid(),
        name: name.trim() || `${fileLabel(file).replace(/^.* - /, '')} list`,
        source: { repo: settings.source.repo, branch: settings.source.branch },
        gameSystemId: index.gameSystem.id,
        catalogueId: index.catalogue.id,
        catalogueFile: file,
        catalogueName: index.catalogue.name,
        forces: [{ uid: uid(), forceEntryId: index.forceEntries[0]?.id ?? '', catalogueId: index.catalogue.id, selections: [] }],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      // Add required configuration (battle size, detachment...).
      const ev = new Evaluator(index, roster);
      for (const n of ev.requiredRootNodes()) roster.forces[0].selections.push(ev.createSelection(n, null));
      saveRoster(roster);
      navigate(`/roster/${roster.uid}`);
    } catch (e) {
      setCreateError(String((e as Error).message ?? e));
      setBusy('');
    }
  };

  return (
    <>
      <div className="topbar">
        <button className="icon ghost" onClick={() => navigate('/')} aria-label="Back">
          ←
        </button>
        <div className="title">New army list</div>
      </div>
      <div className="page">
        <div className="card">
          <label className="field">
            <span>List name (optional)</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tournament 2000pts" />
          </label>
          <div className="small muted">
            Data source: <b>{settings.source.label}</b> ·{' '}
            <a href="#/data" className="small">
              change
            </a>
          </div>
        </div>
        {busy && <Loading text={busy} />}
        {createError && <ErrorBox error={createError} />}
        {error && <ErrorBox error={error} onRetry={() => location.reload()} />}
        {!ls && !error && <Loading text={progress} />}
        {ls && !busy && (
          <>
            <h2 style={{ marginTop: 16 }}>Choose a faction</h2>
            <input placeholder="Search factions…" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: '100%', marginBottom: 10 }} />
            <div className="card" style={{ padding: 0 }}>
              {files.map((f) => (
                <div key={f.name} className="list-item" onClick={() => create(f.name)}>
                  <div className="grow">{fileLabel(f.name)}</div>
                  <span className="muted">›</span>
                </div>
              ))}
              {!files.length && <p className="muted" style={{ padding: 14 }}>No factions match.</p>}
            </div>
          </>
        )}
      </div>
    </>
  );
}
