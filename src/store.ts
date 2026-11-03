/** Tiny persisted stores (localStorage) with a React hook. */
import { useSyncExternalStore } from 'react';
import type { Roster } from './roster/model';
import type { GameState } from './play/game';
import { KNOWN_SOURCES, type DataSource } from './bsdata/loader';

type Listener = () => void;

class PersistedStore<T> {
  private value: T;
  private listeners = new Set<Listener>();

  constructor(
    private key: string,
    initial: T,
  ) {
    this.value = initial;
    try {
      const raw = localStorage.getItem(key);
      if (raw) this.value = JSON.parse(raw) as T;
    } catch {
      /* ignore */
    }
  }

  get = () => this.value;

  set = (next: T | ((prev: T) => T)) => {
    this.value = typeof next === 'function' ? (next as (p: T) => T)(this.value) : next;
    try {
      localStorage.setItem(this.key, JSON.stringify(this.value));
    } catch (e) {
      console.warn('Could not save', this.key, e);
    }
    this.listeners.forEach((l) => l());
  };

  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
}

export const rostersStore = new PersistedStore<Roster[]>('muster.rosters', []);
export const gamesStore = new PersistedStore<GameState[]>('muster.games', []);

export interface Settings {
  source: DataSource;
  customSources: DataSource[];
  showLegends: boolean;
}
export const settingsStore = new PersistedStore<Settings>('muster.settings', {
  source: KNOWN_SOURCES[0],
  customSources: [],
  showLegends: false,
});

export function useStore<T>(store: PersistedStore<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

export function saveRoster(r: Roster) {
  const next = { ...r, updatedAt: Date.now() };
  rostersStore.set((list) => {
    const i = list.findIndex((x) => x.uid === r.uid);
    if (i < 0) return [next, ...list];
    const copy = [...list];
    copy[i] = next;
    return copy;
  });
}

export function deleteRoster(uidToDelete: string) {
  rostersStore.set((list) => list.filter((r) => r.uid !== uidToDelete));
}

export function saveGame(g: GameState) {
  const next = { ...g, updatedAt: Date.now() };
  gamesStore.set((list) => {
    const i = list.findIndex((x) => x.uid === g.uid);
    if (i < 0) return [next, ...list];
    const copy = [...list];
    copy[i] = next;
    return copy;
  });
}

export function deleteGame(uidToDelete: string) {
  gamesStore.set((list) => list.filter((g) => g.uid !== uidToDelete));
}
