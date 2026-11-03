import { describe, expect, it } from 'vitest';
import { adjustWounds, formationLeadership, formations, isFormationHalfStrength, isHalfStrength, makeUnitState, newGame, newPlayer, nextStep } from './game';
import { PRE_BATTLE, TURN } from './rules';
import type { UnitSheet } from '../roster/summary';

const sheet: UnitSheet = {
  name: 'Squad', points: 100, models: 10, composition: [], stats: [{ name: 'Squad', M: '6"', T: '4', Sv: '3+', W: '2', Ld: '6+', OC: '2', extra: {} }],
  weapons: [], abilities: [], rules: [], otherProfiles: [], keywords: [], factionKeywords: [], upgrades: [],
};

describe('game flow', () => {
  it('walks pre-battle, turns and rounds', () => {
    let g = newGame(newPlayer('A'), newPlayer('B'));
    for (let i = 0; i < PRE_BATTLE.length; i++) g = nextStep(g);
    expect(g.stage).toBe('battle');
    expect(g.round).toBe(1);
    const stepsPerTurn = TURN.reduce((s, p) => s + p.steps.length, 0);
    for (let i = 0; i < stepsPerTurn; i++) g = nextStep(g);
    expect(g.activePlayer).toBe(1);
    expect(g.round).toBe(1);
    for (let i = 0; i < stepsPerTurn; i++) g = nextStep(g);
    expect(g.activePlayer).toBe(0);
    expect(g.round).toBe(2);
    for (let i = 0; i < stepsPerTurn * 8; i++) g = nextStep(g);
    expect(g.stage).toBe('ended');
  });

  it('tracks wounds and half strength', () => {
    const u = makeUnitState(sheet);
    adjustWounds(u, 9);
    expect(u.modelsRemaining).toBe(6);
    expect(u.woundsLost).toBe(1);
    expect(isHalfStrength(u)).toBe(false);
    adjustWounds(u, 1);
    expect(u.modelsRemaining).toBe(5);
    expect(u.woundsLost).toBe(0);
    expect(isHalfStrength(u)).toBe(true);
    adjustWounds(u, -1);
    expect(u.modelsRemaining).toBe(6);
    expect(u.woundsLost).toBe(1);
  });
});

describe('attached units', () => {
  it('groups leaders with their bodyguard until it is destroyed', () => {
    const p = newPlayer('A');
    const squad = makeUnitState(sheet);
    const leader = makeUnitState({ ...sheet, name: 'Captain', models: 1, stats: [{ ...sheet.stats[0], name: 'Captain', W: '5', Ld: '5+' }] });
    const other = makeUnitState({ ...sheet, name: 'Other' });
    leader.attachedTo = squad.uid;
    p.units.push(squad, leader, other);

    let f = formations(p);
    expect(f.map((x) => x.members.map((m) => m.sheet.name))).toEqual([['Squad', 'Captain'], ['Other']]);
    expect(formationLeadership(f[0])).toBe(5);

    adjustWounds(squad, 12); // 6 of 10 squad models destroyed → 5 of 11 models left
    expect(isFormationHalfStrength(f[0])).toBe(true);

    squad.modelsRemaining = 0;
    f = formations(p);
    expect(f.map((x) => x.members.map((m) => m.sheet.name))).toEqual([['Squad'], ['Captain'], ['Other']]);
  });
});
