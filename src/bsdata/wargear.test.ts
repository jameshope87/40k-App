import { describe, expect, it } from 'vitest';
import { GameIndex } from './index';
import { Evaluator } from './engine';
import type { RawDataFile } from './types';
import type { Roster } from '../roster/model';
import { chooseInGroup, findRSel, mergeSelection, splitSelection } from '../roster/ops';

const PTS = 'pts';
const gst: RawDataFile = { id: 'gs', name: 'GS', type: 'gameSystem', costTypes: [{ id: PTS, name: 'pts' }], forceEntries: [{ id: 'force', name: 'Army' }] };

/** A squad of 5-10 marines; each marine picks one melee weapon; max 2 eviscerators in the unit. */
const cat: RawDataFile = {
  id: 'cat',
  name: 'Test',
  type: 'catalogue',
  sharedSelectionEntries: [
    {
      id: 'squad',
      name: 'Squad',
      type: 'unit',
      costs: [{ typeId: PTS, value: 100 }],
      modifiers: [
        {
          // Requisition threshold: the 3rd+ copy costs 20 more.
          type: 'increment',
          field: PTS,
          value: 20,
          conditionGroups: [
            {
              type: 'and',
              localConditionGroups: [
                {
                  type: 'atLeast',
                  field: 'selections',
                  scope: 'parent',
                  value: 2,
                  includeChildSelections: true,
                  conditions: [
                    { type: 'before', field: 'selections', scope: 'self', childId: 'any', value: 1 },
                    { type: 'instanceOf', field: 'selections', scope: 'self', childId: 'squad', value: 1 },
                  ],
                },
              ],
            },
          ],
        },
      ],
      selectionEntryGroups: [
        {
          id: 'grp-marines',
          name: 'Marines',
          defaultSelectionEntryId: 'marine',
          constraints: [
            { id: 'gmin', type: 'min', field: 'selections', scope: 'parent', value: 5 },
            { id: 'gmax', type: 'max', field: 'selections', scope: 'parent', value: 10 },
          ],
          selectionEntries: [
            {
              id: 'marine',
              name: 'Marine',
              type: 'model',
              selectionEntryGroups: [
                {
                  id: 'grp-melee',
                  name: 'Melee Weapon',
                  defaultSelectionEntryId: 'sword',
                  constraints: [
                    { id: 'm1', type: 'min', field: 'selections', scope: 'parent', value: 1 },
                    { id: 'm2', type: 'max', field: 'selections', scope: 'parent', value: 1 },
                  ],
                  selectionEntries: [
                    { id: 'sword', name: 'Chainsword', type: 'upgrade' },
                    {
                      id: 'evisc',
                      name: 'Eviscerator',
                      type: 'upgrade',
                      constraints: [{ id: 'evmax', type: 'max', field: 'selections', scope: 'unit', value: 2, includeChildSelections: true }],
                      modifiers: [
                        {
                          type: 'add',
                          field: 'error',
                          value: 'Max 1 {this} per 5 models',
                          conditionGroups: [
                            {
                              type: 'and',
                              conditions: [
                                // counts models by the group they were chosen from
                                { type: 'lessThan', field: 'selections', scope: 'unit', childId: 'grp-marines', value: 10, includeChildSelections: true },
                                { type: 'greaterThan', field: 'selections', scope: 'unit', childId: 'evisc', value: 1, includeChildSelections: true },
                              ],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
  entryLinks: [{ id: 'l-squad', name: 'Squad', targetId: 'squad', type: 'selectionEntry' }],
};

const index = new GameIndex(gst, cat, () => undefined);
const squadNode = index.rootNodes[0];
const meleeGroup = () => squadNode.children[0].children[0].children[0];
const evisc = () => meleeGroup().children.find((c) => c.name === 'Eviscerator')!;

function newRoster(): Roster {
  return {
    uid: 'r', name: 'T', source: { repo: 'x', branch: 'y' }, gameSystemId: 'gs', catalogueId: 'cat', catalogueFile: 'c', catalogueName: 'C',
    forces: [{ uid: 'f', forceEntryId: 'force', catalogueId: 'cat', selections: [] }], createdAt: 0, updatedAt: 0,
  };
}

describe('model loadouts and wargear limits', () => {
  it('splits models so one can take different wargear, and enforces per-unit limits', () => {
    let roster = newRoster();
    let ev = new Evaluator(index, roster);
    const unit = ev.createSelection(squadNode, null);
    roster.forces[0].selections.push(unit);
    ev = new Evaluator(index, roster);
    const loadout = unit.children[0];
    expect(loadout.count).toBe(5);

    // Eviscerators for all five: per-unit max and the data's error message both fire.
    roster = chooseInGroup(ev, roster, loadout.uid, meleeGroup(), evisc());
    ev = new Evaluator(index, roster);
    const msgs = ev.validate().map((i) => i.message);
    expect(msgs).toContain('Squad › Max 1 Eviscerator per 5 models');
    expect(msgs.some((m) => /Eviscerator: allows at most 2 \(currently 5\)/.test(m))).toBe(true);

    // Back to chainswords, split one model off and give only it an eviscerator.
    roster = chooseInGroup(ev, roster, loadout.uid, meleeGroup(), meleeGroup().children[0]);
    const split = splitSelection(roster, loadout.uid);
    roster = split.roster;
    ev = new Evaluator(index, roster);
    roster = chooseInGroup(ev, roster, split.uid!, meleeGroup(), evisc());
    ev = new Evaluator(index, roster);
    const counts = ev.roots[0].children.map((c) => `${c.sel.count}:${c.children[0].sel.name}`);
    expect(counts).toEqual(['4:Chainsword', '1:Eviscerator']);
    expect(ev.validate()).toEqual([]);
    // group size constraint still sees 5 models in total
    expect(ev.countOf(squadNode.children[0], ev.roots[0], false)).toBe(5);

    // Merging puts the models back together.
    roster = chooseInGroup(ev, roster, split.uid!, meleeGroup(), meleeGroup().children[0]);
    roster = mergeSelection(roster, split.uid!, loadout.uid);
    ev = new Evaluator(index, roster);
    expect(ev.roots[0].children.map((c) => c.sel.count)).toEqual([5]);
    expect(findRSel(ev, split.uid!)).toBeUndefined();
  });

  it('charges more from the third copy of a unit', () => {
    const roster = newRoster();
    let ev = new Evaluator(index, roster);
    for (let i = 0; i < 3; i++) {
      roster.forces[0].selections.push(ev.createSelection(squadNode, null));
      ev = new Evaluator(index, roster);
    }
    expect(ev.roots.map((r) => ev.totalCost(r))).toEqual([100, 100, 120]);
    // A 4th copy (not yet added) would also cost more.
    expect(ev.cost(squadNode, ev.virtual(squadNode, null))).toBe(120);
  });
});
