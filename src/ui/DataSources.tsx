import { useEffect, useState } from 'react';
import { KNOWN_SOURCES, type DataSource, clearCache, listCachedFiles, loadSource, storeLocalFile } from '../bsdata/loader';
import { settingsStore, useStore } from '../store';
import { navigate } from '../router';

export default function DataSources() {
  const settings = useStore(settingsStore);
  const [cached, setCached] = useState<string[]>([]);
  const [status, setStatus] = useState('');
  const [repo, setRepo] = useState('');
  const [branch, setBranch] = useState('main');
  const sources = [...KNOWN_SOURCES, ...settings.customSources];

  const refreshCached = () => listCachedFiles(settings.source).then(setCached);
  useEffect(() => {
    refreshCached();
  }, [settings.source.repo, settings.source.branch]);

  const choose = (s: DataSource) => settingsStore.set({ ...settings, source: s });

  const addCustom = () => {
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo.trim())) {
      alert('Enter a GitHub repository as owner/name, e.g. BSData/wh40k-11e');
      return;
    }
    const s: DataSource = { repo: repo.trim(), branch: branch.trim() || 'main', label: `${repo.trim()} (custom)` };
    settingsStore.set({ ...settings, customSources: [...settings.customSources, s], source: s });
    setRepo('');
  };

  const update = async () => {
    setStatus('Checking for updates…');
    try {
      await clearCache(settings.source);
      await loadSource(settings.source, setStatus, { refresh: true });
      setStatus('Updated. Catalogues will be downloaded again when you open a list.');
    } catch (e) {
      setStatus(`Update failed: ${String(e)}`);
    }
    refreshCached();
  };

  const upload = async (files: FileList | null) => {
    if (!files) return;
    for (const f of Array.from(files)) {
      try {
        await storeLocalFile(settings.source, f.name, await f.text());
        setStatus(`Stored ${f.name}`);
      } catch (e) {
        setStatus(`${f.name}: ${String(e)}`);
      }
    }
    refreshCached();
  };

  return (
    <>
      <div className="topbar">
        <button className="icon ghost" onClick={() => navigate('/')} aria-label="Back">
          ←
        </button>
        <div className="title">Data sources</div>
      </div>
      <div className="page stack">
        <div className="card">
          <h3>Game data</h3>
          <p className="small muted">
            Army data is downloaded from <a href="https://github.com/BSData">BSData</a> repositories on GitHub (the same community data used by BattleScribe
            and New Recruit) and kept on this device for offline use.
          </p>
          {sources.map((s) => (
            <label key={`${s.repo}@${s.branch}`} className="opt">
              <input type="radio" checked={settings.source.repo === s.repo && settings.source.branch === s.branch} onChange={() => choose(s)} />
              <span className="name">
                {s.label}
                <span className="tiny muted" style={{ display: 'block' }}>
                  github.com/{s.repo} ({s.branch})
                </span>
              </span>
            </label>
          ))}
          <div className="row" style={{ marginTop: 10 }}>
            <input placeholder="owner/repo" value={repo} onChange={(e) => setRepo(e.target.value)} className="grow" />
            <input placeholder="branch" value={branch} onChange={(e) => setBranch(e.target.value)} style={{ width: 100 }} />
            <button onClick={addCustom}>Add</button>
          </div>
        </div>

        <div className="card">
          <h3>Offline cache</h3>
          <p className="small muted">{cached.length} file(s) stored for this source.</p>
          <div className="row">
            <button onClick={update}>Download latest data</button>
            <label className="btn">
              Load files from device…
              <input type="file" multiple accept=".json,.cat,.gst" hidden onChange={(e) => upload(e.target.files)} />
            </label>
          </div>
          {status && <p className="small">{status}</p>}
          {!!cached.length && (
            <details>
              <summary className="small muted">Cached files</summary>
              <ul className="small">
                {cached.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </div>
    </>
  );
}
