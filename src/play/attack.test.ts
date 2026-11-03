import { describe, expect, it } from 'vitest';
import { defaultOptions, estimate, parseAbilities, planAttack, rollDamage, rollHits, rollWounds, woundTarget, type TargetProfile } from './attack';
import { expectedValue, parseDice, rollExpr } from './dice';
import type { WeaponProfile } from '../roster/summary';

const bolter: WeaponProfile = { name: 'Bolt rifle', kind: 'ranged', count: 5, range: '24"', attacks: '2', skill: '3+', strength: '4', ap: '-1', damage: '1', keywords: ['Assault', 'Heavy'] };
const marines: TargetProfile = { name: 'Marines', toughness: 4, save: 3, wounds: 2, models: 5, keywords: ['Infantry'] };

/** Deterministic RNG cycling through given d6 faces. */
const faces = (...vals: number[]) => {
  let i = 0;
  return () => (vals[i++ % vals.length] - 1) / 6 + 0.0001;
};

describe('dice', () => {
  it('parses expressions', () => {
    expect(parseDice('D6')).toEqual({ count: 1, sides: 6, bonus: 0 });
    expect(parseDice('2D6')).toEqual({ count: 2, sides: 6, bonus: 0 });
    expect(parseDice('D3+3')).toEqual({ count: 1, sides: 3, bonus: 3 });
    expect(parseDice('4')).toEqual({ count: 0, sides: 0, bonus: 4 });
    expect(expectedValue('D6+1')).toBe(4.5);
    expect(rollExpr('2D6', faces(3, 4)).total).toBe(7);
  });
});

describe('wound table', () => {
  it('compares S and T', () => {
    expect(woundTarget(8, 4)).toBe(2);
    expect(woundTarget(5, 4)).toBe(3);
    expect(woundTarget(4, 4)).toBe(4);
    expect(woundTarget(3, 4)).toBe(5);
    expect(woundTarget(2, 4)).toBe(6);
    expect(woundTarget(4, 10)).toBe(6);
  });
});

describe('attack planning', () => {
  it('parses weapon abilities', () => {
    const a = parseAbilities(['Sustained Hits 2', 'Anti-Vehicle 4+', 'Rapid Fire 1', 'Melta 2', 'Lethal Hits']);
    expect(a.sustainedHits).toBe('2');
    expect(a.anti).toEqual([{ keyword: 'Vehicle', on: 4 }]);
    expect(a.rapidFire).toBe('1');
    expect(a.melta).toBe('2');
    expect(a.lethalHits).toBe(true);
  });

  it('computes targets with AP, cover, heavy and invulnerable saves', () => {
    const o = { ...defaultOptions(5), remainedStationary: true };
    const plan = planAttack(bolter, marines, o);
    expect(plan.hitOn).toBe(2); // 3+ with heavy +1
    expect(plan.woundOn).toBe(4);
    expect(plan.saveOn).toBe(4); // 3+ with AP-1

    const cover = planAttack(bolter, marines, { ...defaultOptions(5), targetInCover: true });
    expect(cover.hitOn).toBe(4); // BS worsened by 1

    const invuln = planAttack({ ...bolter, ap: '-3' }, { ...marines, invuln: 4 }, defaultOptions(1));
    expect(invuln.saveOn).toBe(4);
    expect(invuln.saveIsInvuln).toBe(true);
  });

  it('applies anti-X critical wounds', () => {
    const w = { ...bolter, keywords: ['Anti-Infantry 4+', 'Devastating Wounds'] };
    const plan = planAttack(w, marines, defaultOptions(1));
    expect(plan.critWoundOn).toBe(4);
  });
});

describe('staged resolution', () => {
  it('resolves lethal and sustained hits', () => {
    const w = { ...bolter, keywords: ['Lethal Hits', 'Sustained Hits 1'] };
    const o = defaultOptions(1);
    const plan = planAttack(w, marines, o);
    // Rolls: 6 (crit), 3 (hit), 1 (miss)
    const hits = rollHits(plan, 3, o, faces(6, 3, 1));
    expect(hits.crits).toBe(1);
    expect(hits.autoWounds).toBe(1);
    expect(hits.hits).toBe(2); // the 3 + one sustained extra hit
  });

  it('turns critical wounds into mortal wounds with Devastating Wounds', () => {
    const w = { ...bolter, keywords: ['Devastating Wounds'] };
    const o = defaultOptions(1);
    const plan = planAttack(w, marines, o);
    const wounds = rollWounds(plan, { dice: [], hits: 3, autoWounds: 0, crits: 0, sustainedExtra: 0 }, o, faces(6, 4, 2));
    expect(wounds.mortal).toBe(1);
    expect(wounds.wounds).toBe(1);
  });

  it('loses excess damage on normal attacks but spills mortal wounds', () => {
    const plan = planAttack({ ...bolter, damage: '3' }, marines, defaultOptions(1));
    const dmg = rollDamage(plan, { dice: [], unsaved: 2 }, { dice: [], wounds: 2, mortal: 0 }, marines, faces(1));
    expect(dmg.modelsDestroyed).toBe(2);
    expect(dmg.wasted).toBe(2);
    const mortal = rollDamage(plan, { dice: [], unsaved: 0 }, { dice: [], wounds: 0, mortal: 2 }, marines, faces(1));
    expect(mortal.modelsDestroyed).toBe(3);
  });

  it('estimates roughly the analytic average', () => {
    const o = defaultOptions(10);
    const plan = planAttack(bolter, marines, o);
    // 20 attacks × 2/3 hit × 1/2 wound × 1/2 unsaved = 3.33 damage
    const e = estimate(plan, { ...marines, models: 100 }, o, 4000);
    expect(e.damage).toBeGreaterThan(2.9);
    expect(e.damage).toBeLessThan(3.8);
  });
});
