/**
 * Optional sweep over every catalogue in a local BSData checkout: add each
 * available unit with its default wargear and report validation issues that
 * point at the unit itself (a freshly added unit should normally be valid).
 *   BSDATA_DIR=/path/to/wh40k-11e npx vitest run sweep
 */
import { describe, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseDataFile } from './loader';
import { GameIndex } from './index';
import { Evaluator } from './engine';
import type { RawDataFile } from './types';
import type { Roster } from '../roster/model';

const dir = process.env.BSDATA_DIR;

describe.skipIf(!dir)('catalogue sweep', () => {
  it('adds every unit with default wargear', () => {
    const files = readdirSync(dir!).filter((f) => f.endsWith('.json') || f.endsWith('.cat') || f.endsWith('.gst'));
    const cache = new Map<string, RawDataFile>();
    const load = (f: string) => cache.get(f) ?? (cache.set(f, parseDataFile(readFileSync(join(dir!, f), 'utf8'))), cache.get(f)!);
    const byId = (id: string) => files.map(load).find((d) => d.id === id);
    const gstFile = files.find((f) => /\.gst$|^Warhammer 40,000\.json$/.test(f))!;
    const gst = load(gstFile);
    const report: Record<string, string[]> = {};
    let units = 0;
    for (const f of files) {
      if (f === gstFile || /library/i.test(f)) continue;
      const cat = load(f);
      const index = new GameIndex(gst, cat, byId);
      const base: Roster = {
        uid: 'r', name: 'T', source: { repo: 'x', branch: 'm' }, gameSystemId: gst.id, catalogueId: cat.id, catalogueFile: f, catalogueName: cat.name,
        forces: [{ uid: 'f', forceEntryId: index.forceEntries[0].id, catalogueId: cat.id, selections: [] }], createdAt: 0, updatedAt: 0,
      };
      const ev0 = new Evaluator(index, base);
      for (const n of index.rootNodes) {
        if ((n.type !== 'unit' && n.type !== 'model') || !ev0.isAvailable(n, null)) continue;
        units++;
        const roster = structuredClone(base);
        const sel = ev0.createSelection(n, null);
        roster.forces[0].selections.push(sel);
        const ev = new Evaluator(index, roster);
        const issues = ev.validate().filter((i) => i.selUid === sel.uid && i.severity === 'error').map((i) => i.message);
        // Leader/Support units must be attached; that is expected for a lone unit.
        const real = issues.filter((m) => !/must be attached/.test(m));
        if (real.length) (report[f] ??= []).push(`${n.name}: ${real.join(' | ')}`);
      }
    }
    const lines = Object.entries(report).flatMap(([f, l]) => [`## ${f} (${l.length})`, ...l.slice(0, 8)]);
    console.log(`units checked: ${units}; with issues: ${Object.values(report).flat().length}\n${lines.join('\n')}`);
  });
});
