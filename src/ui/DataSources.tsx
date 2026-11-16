import { useEffect, useState } from 'react';
import { KNOWN_SOURCES, type DataSource, exportCachedFiles, forgetSource, listCachedFiles, loadSource, parseDataBundle, storeLocalFile } from '../bsdata/loader';
import { saveTextFile, safeFileName } from '../files';
import { clearIndexCache } from '../useCatalogue';
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
      // Cached files are only replaced once a new copy has downloaded.
      await loadSource(settings.source, setStatus, { refresh: true });
      setStatus('Updated. Factions are refreshed again when you next open them.');
    } catch (e) {
      setStatus(`Update failed: ${(e as Error).message ?? String(e)} Your cached data has not been changed.`);
    }
    refreshCached();
  };

  const upload = async (files: FileList | null) => {
    if (!files) return;
    const lines: string[] = [];
    const store = async (name: string, text: string, prefix = '') => {
      try {
        const r = await storeLocalFile(settings.source, name, text);
        lines.push(`✓ ${prefix}${name}${r.kind === 'gameSystem' ? ' (game system)' : ''}`);
      } catch (e) {
        lines.push(`✗ ${prefix}${name}: not a BattleScribe data file (${(e as Error).message ?? e})`);
      }
    };
    for (const f of Array.from(files)) {
      setStatus(`Reading ${f.name}…`);
      const text = await f.text();
      const bundle = parseDataBundle(text);
      if (bundle) {
        lines.push(`${f.name}: ${bundle.files.length} data file(s) exported from this app`);
        for (const df of bundle.files) await store(df.name, df.text, '  ');
      } else {
        await store(f.name, text);
      }
    }
    forgetSource(settings.source);
    clearIndexCache();
    setStatus(`${lines.join('\n')}\nOpen “New list” to choose a faction from these files.`);
    refreshCached();
  };

  const exportData = async () => {
    try {
      setStatus('Preparing data files…');
      const bundle = await exportCachedFiles(settings.source);
      if (!bundle.files.length) {
        setStatus('There are no data files stored for this source on this device. If you used a different source, select it under Game data first.');
        return;
      }
      const d = new Date();
      const name = `muster-data-${safeFileName(settings.source.repo.split('/').pop() ?? 'data')}-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`;
      await saveTextFile(name, JSON.stringify(bundle));
      setStatus(`Exported ${bundle.files.length} data file(s) to ${name}. On your other device, use “Load files from device…” and pick this file.`);
    } catch (e) {
      setStatus(`Export failed: ${(e as Error).message ?? e}`);
    }
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
              <input type="file" multiple hidden onChange={(e) => (upload(e.target.files), (e.target.value = ''))} />
            </label>
            <button onClick={exportData} disabled={!cached.length}>
              Export data files…
            </button>
          </div>
          <p className="tiny muted">
            Export saves this device’s data files as one file, so you can load them on another of your own devices. It is a personal copy: please don’t share it or upload it
            anywhere public.
          </p>
          {status && <p className="small" style={{ whiteSpace: 'pre-wrap' }}>{status}</p>}
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
