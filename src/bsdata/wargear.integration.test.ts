/**
 * Optional checks against a local BSData checkout:
 *   BSDATA_DIR=/path/to/wh40k-11e npx vitest run wargear
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseDataFile } from './loader';
import { GameIndex, groupEntries, type Node } from './index';
import { Evaluator, type RSel } from './engine';
import type { RawDataFile } from './types';
import type { Roster } from '../roster/model';
import { addRoot, chooseInGroup, findRSel, splitSelection } from '../roster/ops';
import { describeUnit } from '../roster/summary';

const dir = process.env.BSDATA_DIR;

describe.skipIf(!dir)('complex wargear (Blood Angels)', () => {
  const files = dir ? readdirSync(dir).filter((f) => f.endsWith('.json')) : [];
  const cache = new Map<string, RawDataFile>();
  const load = (f: string) => cache.get(f) ?? (cache.set(f, parseDataFile(readFileSync(join(dir!, f), 'utf8'))), cache.get(f)!);
  const byId = (id: string) => files.map(load).find((d) => d.id === id);
  const gst = dir ? load('Warhammer 40,000.json') : undefined!;
  const cat = dir ? load('Imperium - Blood Angels.json') : undefined!;
  const index = dir ? new GameIndex(gst, cat, byId) : undefined!;
  const empty = (): Roster => ({
    uid: 'r', name: 'T', source: { repo: 'x', branch: 'm' }, gameSystemId: gst.id, catalogueId: cat.id, catalogueFile: 'Imperium - Blood Angels.json',
    catalogueName: 'BA', forces: [{ uid: 'f', forceEntryId: index.forceEntries[0].id, catalogueId: cat.id, selections: [] }], createdAt: 0, updatedAt: 0,
  });
  const node = (name: string) => index.rootNodes.find((n) => n.name === name)!;
  const groupNamed = (n: Node, name: string): Node | undefined => {
    for (const c of n.children) {
      if (c.kind === 'group' && c.name === name) return c;
      if (c.kind === 'group') {
        const inner = groupNamed(c, name);
        if (inner) return inner;
      }
    }
    return undefined;
  };
  const messages = (ev: Evaluator) => ev.validate().map((i) => i.message);
  const unitIssues = (ev: Evaluator, re: RegExp) => messages(ev).filter((m) => re.test(m));

  it('lets one model in the squad take an eviscerator, and flags too many', () => {
    let roster = empty();
    let ev = new Evaluator(index, roster);
    const added = addRoot(ev, roster, node('Death Company Marines with Jump Packs'));
    roster = added.roster;
    ev = new Evaluator(index, roster);
    const unit = () => ev.roots.find((r) => r.sel.uid === added.uid)!;
    const models = () => unit().children.filter((c) => c.node.type === 'model');
    expect(models().map((m) => m.sel.count)).toEqual([5]);

    const giveEviscerator = (m: RSel) => {
      const melee = groupNamed(m.node, 'Melee Weapon')!;
      const evisc = groupEntries(melee).find((e) => /eviscerator/i.test(e.name))!;
      roster = chooseInGroup(ev, roster, m.sel.uid, melee, evisc);
      ev = new Evaluator(index, roster);
    };

    // All five with eviscerators: must be flagged.
    giveEviscerator(models()[0]);
    const tooMany = unitIssues(ev, /eviscerator/i);
    console.log('5 eviscerators →', tooMany);
    expect(tooMany.length).toBeGreaterThan(0);

    // Reset to a fresh unit, split one model off and give only that one an eviscerator.
    roster = empty();
    ev = new Evaluator(index, roster);
    const again = addRoot(ev, roster, node('Death Company Marines with Jump Packs'));
    roster = again.roster;
    ev = new Evaluator(index, roster);
    const split = splitSelection(roster, ev.roots.find((r) => r.sel.uid === again.uid)!.children.find((c) => c.node.type === 'model')!.sel.uid);
    roster = split.roster;
    ev = new Evaluator(index, roster);
    giveEviscerator(findRSel(ev, split.uid!)!);
    const u = ev.roots.find((r) => r.sel.uid === again.uid)!;
    console.log('loadouts:', u.children.filter((c) => c.node.type === 'model').map((m) => `${m.sel.count}x ${m.children.map((x) => x.sel.name).join('+')}`));
    console.log('weapons:', describeUnit(ev, u).weapons.map((w) => `${w.count}x ${w.name}`).join(', '));
    expect(unitIssues(ev, /eviscerator/i)).toEqual([]);
    expect(describeUnit(ev, u).models).toBe(5);
  });

  it('charges more for the third copy of a unit', () => {
    let roster = empty();
    const costs: number[] = [];
    for (let i = 0; i < 3; i++) {
      const ev = new Evaluator(index, roster);
      roster = addRoot(ev, roster, node('Death Company Marines')).roster;
    }
    const ev = new Evaluator(index, roster);
    for (const r of ev.roots) if (r.node.name === 'Death Company Marines') costs.push(ev.totalCost(r));
    console.log('three copies cost:', costs);
    expect(costs[2]).toBeGreaterThan(costs[0]);
    expect(costs[1]).toBe(costs[0]);
  });
});
