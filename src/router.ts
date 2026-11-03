/** Minimal hash router: works on static hosting, GitHub Pages and inside Capacitor. */
import { useSyncExternalStore } from 'react';

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

const getHash = () => window.location.hash.replace(/^#/, '') || '/';

export function useRoute(): string[] {
  const hash = useSyncExternalStore(subscribe, getHash, () => '/');
  return hash.split('?')[0].split('/').filter(Boolean).map(decodeURIComponent);
}

export function queryParam(name: string): string | null {
  const q = getHash().split('?')[1] ?? '';
  return new URLSearchParams(q).get(name);
}

export function navigate(path: string) {
  window.location.hash = path;
}
