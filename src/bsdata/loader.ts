/**
 * Fetches BSData repositories (the community-maintained data that
 * BattleScribe / New Recruit use), caches the files in IndexedDB and turns
 * them into `RawDataFile`s.
 */
import { createStore, get, set, del, keys } from 'idb-keyval';
import type { RawDataFile } from './types';
import { xmlToBsJson } from './xml';

export interface DataSource {
  /** GitHub "owner/repo" */
  repo: string;
  branch: string;
  label: string;
}

export const KNOWN_SOURCES: DataSource[] = [
  { repo: 'BSData/wh40k-11e', branch: 'main', label: 'Warhammer 40,000 — 11th Edition (BSData)' },
  { repo: 'BSData/wh40k-10e', branch: 'main', label: 'Warhammer 40,000 — 10th Edition (BSData, legacy)' },
];

export interface RepoFile {
  name: string;
  /** Size in bytes, when known. */
  size?: number;
  /** Git blob SHA, used to detect updates. */
  sha?: string;
}

export interface CatalogueSummary {
  file: string;
  id: string;
  name: string;
  library: boolean;
  revision?: string | number;
}

const store = typeof indexedDB !== 'undefined' ? createStore('muster-bsdata', 'files') : undefined;

const DATA_EXT = /\.(json|gst|cat)$/i;

function sourceKey(src: DataSource) {
  return `${src.repo}@${src.branch}`;
}

/** List the data files in a repo. Tries the GitHub API, then jsDelivr. */
export async function listRepoFiles(src: DataSource): Promise<RepoFile[]> {
  const errors: string[] = [];
  try {
    const res = await fetch(`https://api.github.com/repos/${src.repo}/contents?ref=${encodeURIComponent(src.branch)}`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);
    const json = (await res.json()) as { name: string; type: string; size: number; sha: string }[];
    return json
      .filter((f) => f.type === 'file' && DATA_EXT.test(f.name))
      .map((f) => ({ name: f.name, size: f.size, sha: f.sha }));
  } catch (e) {
    errors.push(String(e));
  }
  try {
    const res = await fetch(`https://data.jsdelivr.com/v1/packages/gh/${src.repo}@${src.branch}?structure=flat`);
    if (!res.ok) throw new Error(`jsDelivr ${res.status}`);
    const json = (await res.json()) as { files: { name: string; size: number; hash?: string }[] };
    return json.files
      .map((f) => ({ name: f.name.replace(/^\//, ''), size: f.size, sha: f.hash }))
      .filter((f) => !f.name.includes('/') && DATA_EXT.test(f.name));
  } catch (e) {
    errors.push(String(e));
  }
  throw new Error(`Could not list files for ${src.repo}: ${errors.join('; ')}`);
}

function rawUrl(src: DataSource, file: string) {
  return `https://raw.githubusercontent.com/${src.repo}/${src.branch}/${file.split('/').map(encodeURIComponent).join('/')}`;
}

/** Parse a data file's text (JSON or XML) into a RawDataFile. */
export function parseDataFile(text: string): RawDataFile {
  const trimmed = text.trimStart();
  const wrapper = (trimmed.startsWith('{') ? JSON.parse(trimmed) : xmlToBsJson(trimmed)) as Record<string, RawDataFile>;
  const kind = wrapper.gameSystem ? 'gameSystem' : wrapper.catalogue ? 'catalogue' : undefined;
  if (!kind) throw new Error('File is not a BattleScribe game system or catalogue');
  const data = wrapper[kind];
  data.type = kind;
  return data;
}

interface CachedFile {
  text: string;
  sha?: string;
  fetchedAt: number;
}

async function cacheGet(key: string): Promise<CachedFile | undefined> {
  if (!store) return undefined;
  try {
    return await get<CachedFile>(key, store);
  } catch {
    return undefined;
  }
}

async function cacheSet(key: string, value: CachedFile) {
  if (!store) return;
  try {
    await set(key, value, store);
  } catch {
    /* quota or private mode: run uncached */
  }
}

/** Download (or read from cache) one file of a source. */
export async function fetchDataFileText(src: DataSource, file: RepoFile | string, opts: { refresh?: boolean } = {}) {
  const name = typeof file === 'string' ? file : file.name;
  const sha = typeof file === 'string' ? undefined : file.sha;
  const key = `${sourceKey(src)}/${name}`;
  const cached = await cacheGet(key);
  if (cached && !opts.refresh && (!sha || !cached.sha || cached.sha === sha)) return cached.text;
  try {
    const res = await fetch(rawUrl(src, name));
    if (!res.ok) throw new Error(`Download failed (${res.status}) for ${name}`);
    const text = await res.text();
    await cacheSet(key, { text, sha, fetchedAt: Date.now() });
    return text;
  } catch (e) {
    if (cached) return cached.text; // offline: fall back to whatever we have
    throw e;
  }
}

/** Store a user-supplied file (e.g. picked from the device) under a source. */
export async function storeLocalFile(src: DataSource, name: string, text: string) {
  parseDataFile(text); // validate
  await cacheSet(`${sourceKey(src)}/${name}`, { text, fetchedAt: Date.now() });
}

export async function listCachedFiles(src: DataSource): Promise<string[]> {
  if (!store) return [];
  const prefix = `${sourceKey(src)}/`;
  const all = (await keys(store)) as string[];
  return all.filter((k) => typeof k === 'string' && k.startsWith(prefix)).map((k) => k.slice(prefix.length));
}

export async function clearCache(src: DataSource) {
  if (!store) return;
  for (const f of await listCachedFiles(src)) await del(`${sourceKey(src)}/${f}`, store);
}

/** Friendly name for a catalogue file, e.g. "Imperium - Space Marines.json" → "Imperium - Space Marines". */
export function fileLabel(name: string) {
  return name.replace(DATA_EXT, '');
}

export function isLibraryFile(name: string) {
  return /library/i.test(name);
}

const ID_MAP_KEY = 'muster.catalogueIdToFile';

function readIdMap(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(ID_MAP_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function writeIdMap(map: Record<string, string>) {
  try {
    localStorage.setItem(ID_MAP_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

function normalise(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export type ProgressFn = (message: string) => void;

/**
 * A loaded source. Only the game system is loaded up front; catalogues (which
 * can be several MB each) are loaded on demand together with the library
 * catalogues they link to.
 */
export class LoadedSource {
  readonly files = new Map<string, RawDataFile>();
  gameSystem!: RawDataFile;
  private fileById = new Map<string, string>();

  constructor(
    readonly source: DataSource,
    readonly repoFiles: RepoFile[],
  ) {}

  get gameSystemFile() {
    return this.repoFiles.find((f) => /\.gst$/i.test(f.name)) ?? this.repoFiles.find((f) => /warhammer 40,000\.json$/i.test(f.name));
  }

  /** Catalogue files that can be chosen as an army (i.e. not libraries). */
  get armyFiles(): RepoFile[] {
    const gst = this.gameSystemFile;
    return this.repoFiles
      .filter((f) => f !== gst && !isLibraryFile(f.name))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async init(onProgress?: ProgressFn) {
    const gst = this.gameSystemFile;
    if (!gst) throw new Error('No game system file found in this source');
    onProgress?.(`Loading ${fileLabel(gst.name)}…`);
    this.gameSystem = await this.loadFile(gst);
  }

  private async loadFile(file: RepoFile): Promise<RawDataFile> {
    const existing = this.files.get(file.name);
    if (existing) return existing;
    const text = await fetchDataFileText(this.source, file);
    const data = parseDataFile(text);
    this.files.set(file.name, data);
    this.fileById.set(data.id, file.name);
    const map = readIdMap();
    if (map[data.id] !== file.name) {
      map[data.id] = file.name;
      writeIdMap(map);
    }
    return data;
  }

  /** Load a catalogue plus (recursively) every catalogue it links to. */
  async loadCatalogue(fileName: string, onProgress?: ProgressFn): Promise<RawDataFile> {
    const file = this.repoFiles.find((f) => f.name === fileName) ?? { name: fileName };
    onProgress?.(`Loading ${fileLabel(fileName)}…`);
    const cat = await this.loadFile(file);
    for (const link of cat.catalogueLinks ?? []) {
      if (this.catalogueById(link.targetId)) continue;
      await this.loadCatalogueById(link.targetId, link.name, onProgress);
    }
    return cat;
  }

  async loadCatalogueById(id: string, nameHint?: string, onProgress?: ProgressFn): Promise<RawDataFile | undefined> {
    const known = this.catalogueById(id);
    if (known) return known;
    const remembered = readIdMap()[id];
    const candidates: RepoFile[] = [];
    if (remembered) {
      const f = this.repoFiles.find((r) => r.name === remembered);
      if (f) candidates.push(f);
    }
    if (nameHint) {
      const hint = normalise(nameHint);
      const byName = this.repoFiles.filter((f) => normalise(fileLabel(f.name)).includes(hint) || hint.includes(normalise(fileLabel(f.name))));
      candidates.push(...byName.filter((f) => !candidates.includes(f)));
    }
    // Fall back to libraries, then everything else.
    candidates.push(...this.repoFiles.filter((f) => isLibraryFile(f.name) && !candidates.includes(f)));
    candidates.push(...this.repoFiles.filter((f) => !candidates.includes(f)));
    for (const f of candidates) {
      if (this.files.has(f.name)) continue;
      const data = await this.loadCatalogue(f.name, onProgress);
      if (data.id === id) return data;
    }
    return undefined;
  }

  catalogueById(id: string): RawDataFile | undefined {
    const name = this.fileById.get(id);
    return name ? this.files.get(name) : undefined;
  }
}

const loaded = new Map<string, Promise<LoadedSource>>();

/** Load (once per session) a source's file list and game system. */
export function loadSource(src: DataSource, onProgress?: ProgressFn, opts: { refresh?: boolean } = {}): Promise<LoadedSource> {
  const key = sourceKey(src);
  if (!opts.refresh && loaded.has(key)) return loaded.get(key)!;
  const p = (async () => {
    let files: RepoFile[];
    onProgress?.('Fetching file list…');
    const cached = await listCachedFiles(src);
    try {
      files = await listRepoFiles(src);
      // Include files the user loaded from their device.
      for (const name of cached) if (!files.some((f) => f.name === name)) files.push({ name });
    } catch (e) {
      // Offline: use whatever is cached.
      if (!cached.length) throw e;
      files = cached.map((name) => ({ name }));
    }
    if (opts.refresh) await clearCache(src);
    const ls = new LoadedSource(src, files);
    await ls.init(onProgress);
    return ls;
  })();
  loaded.set(key, p);
  p.catch(() => loaded.delete(key));
  return p;
}
