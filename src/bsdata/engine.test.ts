import { describe, expect, it } from 'vitest';
import { GameIndex } from './index';
import { Evaluator } from './engine';
import { parseDataFile } from './loader';
import { xmlToBsJson } from './xml';
import type { RawDataFile } from './types';
import type { Roster } from '../roster/model';

const PTS = 'pts-id';

const gst: RawDataFile = {
  id: 'gs',
  name: 'Test System',
  type: 'gameSystem',
  costTypes: [{ id: PTS, name: 'pts' }],
  categoryEntries: [
    { id: 'cat-char', name: 'Character' },
    { id: 'cat-bl', name: 'Battleline' },
    { id: 'cat-leader', name: 'Leader' },
    { id: 'cat-support', name: 'Support' },
  ],
  sharedRules: [{ id: 'rule-fnp', name: 'Feel No Pain', description: 'Ignore wounds.' }],
  forceEntries: [
    {
      id: 'force',
      name: 'Army',
      constraints: [{ id: 'limit', field: PTS, scope: 'parent', type: 'max', value: 200, includeChildSelections: true }],
      categoryLinks: [{ id: 'cl', targetId: 'cat-char', name: 'Character', constraints: [{ id: 'need-char', field: 'selections', scope: 'parent', type: 'min', value: 1 }] }],
    },
  ],
};

const cat: RawDataFile = {
  id: 'cat',
  name: 'Test Army',
  type: 'catalogue',
  gameSystemId: 'gs',
  sharedSelectionEntries: [
    {
      id: 'squad',
      name: 'Squad',
      type: 'unit',
      categoryLinks: [{ targetId: 'cat-bl', primary: true }],
      costs: [{ typeId: PTS, value: 80 }],
      constraints: [{ id: 'one-leader', field: 'associations', scope: 'self', type: 'max', value: 1, childId: 'cat-leader' }],
      infoLinks: [
        {
          id: 'il-fnp',
          name: 'Feel No Pain',
          targetId: 'rule-fnp',
          type: 'rule',
          modifiers: [
            { type: 'append', field: 'name', value: '5+' },
            { type: 'set', field: 'hidden', value: true, conditions: [{ type: 'lessThan', field: 'associations', scope: 'self', childId: 'medic', value: 1 }] },
          ],
        },
      ],
      modifiers: [
        {
          type: 'set',
          field: PTS,
          value: 150,
          conditions: [{ type: 'atLeast', field: 'selections', scope: 'squad', childId: 'model', value: 6, includeChildSelections: true }],
        },
      ],
      selectionEntryGroups: [
        {
          id: 'grp-models',
          name: '5-10 Troopers',
          defaultSelectionEntryId: 'trooper',
          constraints: [
            { id: 'gmin', field: 'selections', scope: 'parent', type: 'min', value: 5 },
            { id: 'gmax', field: 'selections', scope: 'parent', type: 'max', value: 10 },
          ],
          selectionEntries: [
            {
              id: 'trooper',
              name: 'Trooper',
              type: 'model',
              selectionEntries: [
                {
                  id: 'gun',
                  name: 'Gun',
                  type: 'upgrade',
                  constraints: [
                    { id: 'g1', field: 'selections', scope: 'parent', type: 'min', value: 1 },
                    { id: 'g2', field: 'selections', scope: 'parent', type: 'max', value: 1 },
                  ],
                  profiles: [
                    {
                      id: 'p-gun',
                      name: 'Gun',
                      typeName: 'Ranged Weapons',
                      characteristics: [
                        { name: 'Range', $text: '24"' },
                        { name: 'A', $text: '2' },
                        { name: 'BS', $text: '4+' },
                        { name: 'S', $text: '4' },
                        { name: 'AP', $text: '0' },
                        { name: 'D', $text: '1' },
                        { name: 'Keywords', $text: 'Rapid Fire 1' },
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
    {
      id: 'hero',
      name: 'Hero',
      type: 'model',
      categoryLinks: [{ targetId: 'cat-char', primary: true }, { targetId: 'cat-leader' }],
      costs: [{ typeId: PTS, value: 60 }],
      associations: [
        {
          id: 'assoc-lead',
          name: 'Leading',
          label: 'Leader',
          action: 'group',
          childId: 'unit',
          min: 0,
          max: 1,
          scope: 'force',
          conditionGroups: [{ type: 'or', conditions: [{ type: 'instanceOf', field: 'selections', scope: 'self', childId: 'squad', value: 1 }] }],
        },
      ],
      constraints: [{ id: 'hero-max', field: 'selections', scope: 'roster', type: 'max', value: 1, includeChildSelections: true }],
    },
    {
      id: 'medic',
      name: 'Medic',
      type: 'model',
      categoryLinks: [{ targetId: 'cat-char', primary: true }, { targetId: 'cat-support' }],
      costs: [{ typeId: PTS, value: 40 }],
      associations: [
        {
          id: 'assoc-support',
          name: 'Supporting',
          label: 'Supported by',
          action: 'group',
          childId: 'unit',
          min: 1,
          max: 1,
          scope: 'force',
          conditions: [{ type: 'instanceOf', field: 'selections', scope: 'self', childId: 'cat-bl', value: 1 }],
        },
      ],
    },
    {
      id: 'secret',
      name: 'Secret',
      type: 'unit',
      hidden: true,
      modifiers: [{ type: 'set', field: 'hidden', value: false, conditions: [{ type: 'atLeast', field: 'selections', scope: 'force', childId: 'hero', value: 1, includeChildSelections: true }] }],
    },
  ],
  entryLinks: [
    { id: 'l-squad', name: 'Squad', targetId: 'squad', type: 'selectionEntry' },
    { id: 'l-hero', name: 'Hero', targetId: 'hero', type: 'selectionEntry' },
    { id: 'l-secret', name: 'Secret', targetId: 'secret', type: 'selectionEntry' },
    { id: 'l-medic', name: 'Medic', targetId: 'medic', type: 'selectionEntry' },
  ],
};

function roster(): Roster {
  return {
    uid: 'r', name: 'T', source: { repo: 'x', branch: 'y' }, gameSystemId: 'gs', catalogueId: 'cat', catalogueFile: 'cat.json', catalogueName: 'Test',
    forces: [{ uid: 'f', forceEntryId: 'force', catalogueId: 'cat', selections: [] }], createdAt: 0, updatedAt: 0,
  };
}

describe('engine', () => {
  const index = new GameIndex(gst, cat, () => undefined);

  it('creates selections with defaults and computes points', () => {
    const r = roster();
    let ev = new Evaluator(index, r);
    const squad = index.rootNodes.find((n) => n.name === 'Squad')!;
    r.forces[0].selections.push(ev.createSelection(squad, null));
    const sel = r.forces[0].selections[0];
    expect(sel.children[0].name).toBe('Trooper');
    expect(sel.children[0].count).toBe(5);
    expect(sel.children[0].children[0].name).toBe('Gun');
    ev = new Evaluator(index, r);
    expect(ev.rosterCost()).toBe(80);

    // 6 models → modifier sets the cost to 150
    sel.children[0].count = 6;
    ev = new Evaluator(index, r);
    expect(ev.rosterCost()).toBe(150);
  });

  it('validates constraints and hidden modifiers', () => {
    const r = roster();
    let ev = new Evaluator(index, r);
    const secret = index.rootNodes.find((n) => n.name === 'Secret')!;
    expect(ev.isAvailable(secret, null)).toBe(false);
    const squad = index.rootNodes.find((n) => n.name === 'Squad')!;
    r.forces[0].selections.push(ev.createSelection(squad, null));
    ev = new Evaluator(index, r);
    expect(ev.validate().map((i) => i.message).join('|')).toMatch(/Character/);

    const hero = index.rootNodes.find((n) => n.name === 'Hero')!;
    r.forces[0].selections.push(ev.createSelection(hero, null), ev.createSelection(hero, null));
    r.forces[0].selections[0].children[0].count = 11;
    ev = new Evaluator(index, r);
    expect(ev.isAvailable(secret, null)).toBe(true);
    const msgs = ev.validate().map((i) => i.message).join('|');
    expect(msgs).toMatch(/Hero: allows at most 1/);
    expect(msgs).toMatch(/5-10 Troopers: allows at most 10/);
    expect(msgs).toMatch(/pts cannot exceed 200/);
  });
});

describe('leader attachments', () => {
  const index = new GameIndex(gst, cat, () => undefined);
  const node = (name: string) => index.rootNodes.find((n) => n.name === name)!;

  it('finds valid bodyguards, enforces limits and unlocks abilities', () => {
    const r = roster();
    let ev = new Evaluator(index, r);
    const sels = r.forces[0].selections;
    sels.push(ev.createSelection(node('Squad'), null), ev.createSelection(node('Hero'), null), ev.createSelection(node('Hero'), null), ev.createSelection(node('Medic'), null));
    const [squad, hero1, hero2, medic] = sels;
    ev = new Evaluator(index, r);
    const heroR = ev.roots.find((x) => x.sel.uid === hero1.uid)!;
    const candidates = ev.associationCandidates(heroR, heroR.node.associations[0]);
    expect(candidates.map((c) => c.sel.name)).toEqual(['Squad']);
    expect(ev.validate().map((i) => i.message).join('|')).toMatch(/Medic must be attached/);

    const squadR = () => ev.roots.find((x) => x.sel.uid === squad.uid)!;
    const fnpVisible = () => ev.visibleInfos(squadR()).some((i) => i.name === 'Feel No Pain 5+');
    expect(fnpVisible()).toBe(false);

    hero1.attachments = { 'assoc-lead': squad.uid };
    medic.attachments = { 'assoc-support': squad.uid };
    ev = new Evaluator(index, r);
    expect(fnpVisible()).toBe(true);
    expect(ev.associatedWith(squadR()).map((x) => x.sel.name).sort()).toEqual(['Hero', 'Medic']);
    expect(ev.validate().map((i) => i.message).join('|')).not.toMatch(/attached Leader|must be attached/);

    hero2.attachments = { 'assoc-lead': squad.uid };
    ev = new Evaluator(index, r);
    expect(ev.validate().map((i) => i.message).join('|')).toMatch(/Squad: attached Leader: allows at most 1 \(currently 2\)/);

    // Attaching to an invalid target is reported.
    hero2.attachments = { 'assoc-lead': medic.uid };
    ev = new Evaluator(index, r);
    expect(ev.validate().map((i) => i.message).join('|')).toMatch(/Hero cannot be attached to Medic/);
  });
});

describe('xml', () => {
  it('converts BattleScribe XML to the JSON shape', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<catalogue id="c1" name="X &amp; Y" revision="3" library="false" gameSystemId="gs" xmlns="http://www.battlescribe.net/schema/catalogueSchema">
  <sharedSelectionEntries>
    <selectionEntry id="e1" name="Unit" hidden="false" type="unit">
      <costs><cost name="pts" typeId="pts-id" value="45.0"/></costs>
      <profiles>
        <profile id="p1" name="Unit" typeName="Unit">
          <characteristics><characteristic name="M" typeId="m">6&quot;</characteristic></characteristics>
        </profile>
      </profiles>
    </selectionEntry>
  </sharedSelectionEntries>
  <sharedRules><rule id="r1" name="Rule"><description>Does a thing.</description></rule></sharedRules>
</catalogue>`;
    const json = xmlToBsJson(xml) as { catalogue: RawDataFile };
    const c = json.catalogue;
    expect(c.name).toBe('X & Y');
    expect(c.library).toBe(false);
    expect(c.sharedSelectionEntries![0].costs![0].value).toBe(45);
    expect(c.sharedSelectionEntries![0].profiles![0].characteristics![0].$text).toBe('6"');
    expect(c.sharedRules![0].description).toBe('Does a thing.');
    expect(parseDataFile(xml).type).toBe('catalogue');
  });
});
