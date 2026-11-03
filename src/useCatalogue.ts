/** Hooks to load data sources and build a GameIndex for a catalogue. */
import { useEffect, useState } from 'react';
import { type DataSource, type LoadedSource, loadSource } from './bsdata/loader';
import { GameIndex } from './bsdata/index';

const indexCache = new Map<string, GameIndex>();

export async function getIndex(source: DataSource, catalogueFile: string, onProgress?: (m: string) => void): Promise<GameIndex> {
  const key = `${source.repo}@${source.branch}/${catalogueFile}`;
  const hit = indexCache.get(key);
  if (hit) return hit;
  const ls = await loadSource(source, onProgress);
  const cat = await ls.loadCatalogue(catalogueFile, onProgress);
  onProgress?.('Indexing…');
  const index = new GameIndex(ls.gameSystem, cat, (id) => ls.catalogueById(id));
  indexCache.set(key, index);
  return index;
}

export function useSource(source: DataSource) {
  const [state, setState] = useState<{ ls?: LoadedSource; error?: string; progress: string }>({ progress: 'Connecting…' });
  useEffect(() => {
    let alive = true;
    setState({ progress: 'Connecting…' });
    loadSource(source, (m) => alive && setState((s) => ({ ...s, progress: m })))
      .then((ls) => alive && setState({ ls, progress: '' }))
      .catch((e) => alive && setState({ error: String(e?.message ?? e), progress: '' }));
    return () => {
      alive = false;
    };
  }, [source.repo, source.branch]);
  return state;
}

export function useIndex(source: DataSource | undefined, catalogueFile: string | undefined) {
  const [state, setState] = useState<{ index?: GameIndex; error?: string; progress: string }>({ progress: 'Loading…' });
  useEffect(() => {
    if (!source || !catalogueFile) return;
    let alive = true;
    setState({ progress: 'Loading…' });
    getIndex(source, catalogueFile, (m) => alive && setState((s) => ({ ...s, progress: m })))
      .then((index) => alive && setState({ index, progress: '' }))
      .catch((e) => alive && setState({ error: String(e?.message ?? e), progress: '' }));
    return () => {
      alive = false;
    };
  }, [source?.repo, source?.branch, catalogueFile]);
  return state;
}
