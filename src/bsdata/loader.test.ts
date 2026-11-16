import { afterEach, describe, expect, it, vi } from 'vitest';
import { OfflineError, SourceUnavailableError, listRepoFiles } from './loader';

const src = { repo: 'BSData/gone', branch: 'main', label: 'Gone' };

afterEach(() => vi.unstubAllGlobals());

describe('listing a data source', () => {
  it('reports a removed repository clearly', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response('{}', { status: url.includes('api.github.com') ? 404 : 403 })));
    await expect(listRepoFiles(src)).rejects.toBeInstanceOf(SourceUnavailableError);
    await expect(listRepoFiles(src)).rejects.toThrow(/no longer available.*saved on this device are safe/);
  });

  it('reports being offline', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    await expect(listRepoFiles(src)).rejects.toBeInstanceOf(OfflineError);
  });

  it('falls back to jsDelivr when the GitHub API is rate limited', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) =>
      url.includes('api.github.com')
        ? new Response('{}', { status: 403 })
        : new Response(JSON.stringify({ files: [{ name: '/Army.json', size: 1 }, { name: '/README.md', size: 1 }] }), { status: 200 }),
    ));
    expect((await listRepoFiles(src)).map((f) => f.name)).toEqual(['Army.json']);
  });
});

describe('data bundles', () => {
  it('recognises bundles exported by the app and ignores other files', async () => {
    const { parseDataBundle, DATA_BUNDLE_FORMAT } = await import('./loader');
    const bundle = { format: DATA_BUNDLE_FORMAT, version: 1, exportedAt: 1, source: { repo: 'a/b', branch: 'main' }, note: '', files: [{ name: 'X.json', text: '{}' }] };
    expect(parseDataBundle(JSON.stringify(bundle))?.files).toHaveLength(1);
    expect(parseDataBundle('{"catalogue":{"id":"c"}}')).toBeUndefined();
    expect(parseDataBundle('<catalogue/>')).toBeUndefined();
  });
});
