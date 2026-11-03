/**
 * Optional integration test against a local BSData checkout:
 *   BSDATA_DIR=/path/to/wh40k-11e npx vitest run integration
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseDataFile } from './loader';
import { GameIndex } from './index';
import { Evaluator } from './engine';
import type { RawDataFile } from './types';
import type { Roster } from '../roster/model';
import { describeUnit } from '../roster/summary';

const dir = process.env.BSDATA_DIR;
const CAT = process.env.BSDATA_CAT ?? 'Necrons';

describe.skipIf(!dir)('real BSData catalogue', () => {
  const files = dir ? readdirSync(dir).filter((f) => /\.(json|cat|gst)$/.test(f)) : [];
  const parsed = new Map<string, RawDataFile>();
  const load = (f: string) => {
    if (!parsed.has(f)) parsed.set(f, parseDataFile(readFileSync(join(dir!, f), 'utf8')));
    return parsed.get(f)!;
  };
  const byId = (id: string) => {
    for (const f of files) {
      const d = load(f);
      if (d.id === id) return d;
    }
    return undefined;
  };

  it('builds a roster', () => {
    const gst = load(files.find((f) => /\.gst$|Warhammer 40,000\.json/.test(f))!);
    const catFile = files.find((f) => f.startsWith(CAT))!;
    const cat = load(catFile);
    const index = new GameIndex(gst, cat, byId);
    const roster: Roster = {
      uid: 'r', name: 'Test', source: { repo: 'x', branch: 'main' }, gameSystemId: gst.id, catalogueId: cat.id,
      catalogueFile: catFile, catalogueName: cat.name,
      forces: [{ uid: 'f', forceEntryId: index.forceEntries[0].id, catalogueId: cat.id, selections: [] }],
      createdAt: 0, updatedAt: 0,
    };
    let ev = new Evaluator(index, roster);
    const visible = index.rootNodes.filter((n) => ev.isAvailable(n, null));
    console.log('root nodes', index.rootNodes.length, 'visible', visible.length);
    console.log(visible.map((n) => `${n.name} [${n.primaryCategoryId ? index.categoryName(n.primaryCategoryId) : '-'}] ${ev.cost(n, ev.virtual(n, null))}`).join('\n'));

    // Add configuration entries with a minimum, then a few units.
    const force = roster.forces[0];
    for (const n of ev.requiredRootNodes()) force.selections.push(ev.createSelection(n, null));
    const re = new RegExp(process.env.BSDATA_UNITS ?? '.');
    const pick = visible.filter((n) => (n.type === 'unit' || n.type === 'model') && re.test(n.name)).slice(0, 6);
    for (const n of pick) {
      force.selections.push(ev.createSelection(n, null));
    }
    ev = new Evaluator(index, roster);
    const dump = (s: Roster['forces'][0]['selections'], d = 0): string =>
      s.map((x) => `${'  '.repeat(d)}${x.count}x ${x.name}\n${dump(x.children, d + 1)}`).join('');
    console.log(dump(force.selections));
    console.log('points', ev.rosterCost());
    for (const r of ev.roots) console.log(r.sel.name, ev.totalCost(r));
    const issues = ev.validate();
    console.log(issues.map((i) => i.message).join('\n'));
    const unit = ev.roots.find((r) => r.node.type === 'unit' || r.node.type === 'model')!;
    console.log(JSON.stringify(describeUnit(ev, unit), null, 1).slice(0, 3000));
    expect(ev.rosterCost()).toBeGreaterThan(0);

    // Leader attachments: every leader/support unit picked above lists its valid bodyguards.
    for (const r of ev.roots) {
      for (const a of r.node.associations) {
        const c = ev.associationCandidates(r, a);
        console.log(`${r.sel.name} [${a.label || a.name}] → ${c.map((x) => x.sel.name).join(', ') || '(none)'}`);
        if (c.length) {
          r.sel.attachments = { ...(r.sel.attachments ?? {}), [a.id]: c[0].sel.uid };
        }
      }
    }
    ev = new Evaluator(index, roster);
    for (const a of ev.attachments()) {
      const infos = ev.visibleInfos(a.to!).map((i) => i.name);
      console.log(`ATTACHED ${a.from.sel.name} → ${a.to?.sel.name}; bodyguard rules now: ${infos.join(', ')}`);
    }
    console.log(ev.validate().map((i) => i.message).join('\n'));
  });
});
