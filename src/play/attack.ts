/**
 * The attack sequence (hit → wound → save → damage) with common weapon
 * abilities, usable both step-by-step (each stage rolled separately and shown
 * to the players) and as a Monte-Carlo estimate.
 */
import type { WeaponProfile } from '../roster/summary';
import { type Rng, defaultRng, expectedValue, parseDice, parseNum, parseTarget, rollDie, rollExpr } from './dice';

export interface TargetProfile {
  name: string;
  toughness: number;
  save: number; // 3 for "3+"; 7 means no save
  invuln?: number;
  wounds: number; // wounds per model
  models: number;
  /** Wounds already lost on the model currently being damaged. */
  woundsLostOnCurrent?: number;
  feelNoPain?: number;
  keywords: string[];
}

export type Reroll = 'none' | 'ones' | 'fails';

export interface AttackOptions {
  attackers: number; // number of models making attacks with this weapon
  halfRange: boolean;
  remainedStationary: boolean;
  charged: boolean;
  targetInCover: boolean;
  hitMod: number;
  woundMod: number;
  saveMod: number;
  rerollHits: Reroll;
  rerollWounds: Reroll;
  /** Extra damage per attack (e.g. from an ability). */
  damageBonus: number;
}

export const defaultOptions = (attackers = 1): AttackOptions => ({
  attackers,
  halfRange: false,
  remainedStationary: false,
  charged: false,
  targetInCover: false,
  hitMod: 0,
  woundMod: 0,
  saveMod: 0,
  rerollHits: 'none',
  rerollWounds: 'none',
  damageBonus: 0,
});

export interface WeaponAbilities {
  torrent: boolean;
  lethalHits: boolean;
  sustainedHits: string | null; // "1", "D3"...
  devastatingWounds: boolean;
  twinLinked: boolean;
  anti: { keyword: string; on: number }[];
  blast: boolean;
  rapidFire: string | null;
  melta: string | null;
  heavy: boolean;
  lance: boolean;
  ignoresCover: boolean;
  hazardous: boolean;
  precision: boolean;
  psychic: boolean;
  extraAttacks: boolean;
  oneShot: boolean;
}

export function parseAbilities(keywords: string[]): WeaponAbilities {
  const kw = keywords.map((k) => k.trim());
  const find = (re: RegExp) => kw.map((k) => re.exec(k)).find(Boolean) ?? null;
  const has = (re: RegExp) => kw.some((k) => re.test(k));
  return {
    torrent: has(/^torrent$/i),
    lethalHits: has(/^lethal hits$/i),
    sustainedHits: find(/^sustained hits\s*(\S+)?$/i)?.[1] ?? (has(/^sustained hits/i) ? '1' : null),
    devastatingWounds: has(/^devastating wounds$/i),
    twinLinked: has(/^twin[- ]linked$/i),
    anti: kw
      .map((k) => /^anti-(.+?)\s+(\d)\+$/i.exec(k))
      .filter((m): m is RegExpExecArray => !!m)
      .map((m) => ({ keyword: m[1].trim(), on: Number(m[2]) })),
    blast: has(/^blast$/i),
    rapidFire: find(/^rapid fire\s*(\S+)$/i)?.[1] ?? null,
    melta: find(/^melta\s*(\S+)$/i)?.[1] ?? null,
    heavy: has(/^heavy$/i),
    lance: has(/^lance$/i),
    ignoresCover: has(/^ignores cover$/i),
    hazardous: has(/^hazardous$/i),
    precision: has(/^precision$/i),
    psychic: has(/^psychic$/i),
    extraAttacks: has(/^extra attacks$/i),
    oneShot: has(/^one shot$/i),
  };
}

/** Wound roll needed for Strength vs Toughness. */
export function woundTarget(strength: number, toughness: number): number {
  if (strength >= toughness * 2) return 2;
  if (strength > toughness) return 3;
  if (strength === toughness) return 4;
  if (strength * 2 <= toughness) return 6;
  return 5;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Everything needed to resolve the attacks, plus human-readable notes. */
export interface AttackPlan {
  weapon: WeaponProfile;
  abilities: WeaponAbilities;
  attacksExpr: string; // per model, e.g. "2" or "D6"
  extraAttacksPerModel: number; // blast, rapid fire (fixed part)
  rapidFireExpr: string | null;
  autoHit: boolean;
  hitOn: number; // 2..7 (7 = impossible)
  critHitOn: number;
  woundOn: number;
  critWoundOn: number;
  saveOn: number; // 2..7 (7 = no save possible)
  saveIsInvuln: boolean;
  damageExpr: string;
  meltaExpr: string | null;
  damageBonus: number;
  fnp?: number;
  notes: string[];
}

export function planAttack(weapon: WeaponProfile, target: TargetProfile, o: AttackOptions): AttackPlan {
  const ab = parseAbilities(weapon.keywords);
  const notes: string[] = [];
  const melee = weapon.kind === 'melee';

  // Attacks
  let extra = 0;
  if (ab.blast && !melee) {
    const b = Math.floor(target.models / 5);
    if (b) notes.push(`Blast: +${b} attack${b > 1 ? 's' : ''} per model (${target.models} models in target).`);
    extra += b;
  }
  let rapidFireExpr: string | null = null;
  if (ab.rapidFire && o.halfRange && !melee) {
    rapidFireExpr = ab.rapidFire;
    notes.push(`Rapid Fire ${ab.rapidFire}: extra attacks at half range.`);
  }

  // Hit roll
  let skill = parseTarget(weapon.skill) ?? 7;
  let hitMod = 0;
  if (o.targetInCover && !ab.ignoresCover && !melee) {
    skill += 1;
    notes.push('Target has the benefit of cover: worsen BS by 1.');
  } else if (o.targetInCover && ab.ignoresCover) {
    notes.push('Ignores Cover: target gets no benefit of cover.');
  }
  if (ab.heavy && o.remainedStationary && !melee) {
    hitMod += 1;
    notes.push('Heavy: +1 to hit (unit remained stationary).');
  }
  hitMod += o.hitMod;
  hitMod = clamp(hitMod, -1, 1);
  const autoHit = ab.torrent;
  if (autoHit) notes.push('Torrent: attacks hit automatically (no hit roll).');
  const hitOn = clamp(skill - hitMod, 2, 7);

  // Wound roll
  const S = parseNum(weapon.strength);
  let woundMod = o.woundMod;
  if (ab.lance && o.charged) {
    woundMod += 1;
    notes.push('Lance: +1 to wound (unit charged this turn).');
  }
  woundMod = clamp(woundMod, -1, 1);
  const baseWound = woundTarget(S, target.toughness);
  const woundOn = clamp(baseWound - woundMod, 2, 6);
  let critWoundOn = 6;
  for (const a of ab.anti) {
    if (target.keywords.some((k) => k.toLowerCase() === a.keyword.toLowerCase())) {
      critWoundOn = Math.min(critWoundOn, a.on);
      notes.push(`Anti-${a.keyword} ${a.on}+: wound rolls of ${a.on}+ are critical wounds.`);
    }
  }
  if (ab.lethalHits) notes.push('Lethal Hits: critical hits (unmodified 6s) wound automatically.');
  if (ab.sustainedHits) notes.push(`Sustained Hits ${ab.sustainedHits}: critical hits score ${ab.sustainedHits} extra hit(s).`);
  if (ab.twinLinked) notes.push('Twin-linked: re-roll the wound roll.');
  if (ab.devastatingWounds) notes.push('Devastating Wounds: critical wounds become mortal wounds (no saves).');

  // Save
  const ap = Math.abs(parseNum(weapon.ap));
  const armour = clamp(target.save + ap - o.saveMod, 2, 7);
  let saveOn = armour;
  let saveIsInvuln = false;
  if (target.invuln && target.invuln < armour) {
    saveOn = target.invuln;
    saveIsInvuln = true;
    notes.push(`Use the ${target.invuln}+ invulnerable save (better than ${armour >= 7 ? 'no' : `${armour}+`} armour save).`);
  }

  // Damage
  const damageBonus = o.damageBonus;
  let meltaExpr: string | null = null;
  if (ab.melta && o.halfRange && !melee) {
    meltaExpr = ab.melta;
    notes.push(`Melta ${ab.melta}: +${ab.melta} damage at half range.`);
  }
  if (target.feelNoPain) notes.push(`Target has Feel No Pain ${target.feelNoPain}+: roll for each wound lost.`);
  if (ab.hazardous) notes.push('Hazardous: after attacking, make hazard rolls for this weapon.');

  return {
    weapon,
    abilities: ab,
    attacksExpr: weapon.attacks || '1',
    extraAttacksPerModel: extra,
    rapidFireExpr,
    autoHit,
    hitOn,
    critHitOn: 6,
    woundOn,
    critWoundOn,
    saveOn,
    saveIsInvuln,
    damageExpr: weapon.damage || '1',
    meltaExpr,
    damageBonus,
    fnp: target.feelNoPain,
    notes,
  };
}

// ---- staged resolution ----------------------------------------------------

export type DieOutcome = 'crit' | 'success' | 'fail';
export interface DieResult {
  value: number;
  outcome: DieOutcome;
  rerolledFrom?: number;
}

export interface AttackCountStage {
  attacks: number;
  rolls: number[]; // dice rolled for variable attacks
}

export function rollAttackCount(plan: AttackPlan, o: AttackOptions, rng: Rng = defaultRng): AttackCountStage {
  let attacks = 0;
  const rolls: number[] = [];
  for (let m = 0; m < o.attackers; m++) {
    const a = rollExpr(plan.attacksExpr, rng);
    rolls.push(...a.rolls);
    attacks += a.total + plan.extraAttacksPerModel;
    if (plan.rapidFireExpr) {
      const rf = rollExpr(plan.rapidFireExpr, rng);
      rolls.push(...rf.rolls);
      attacks += rf.total;
    }
  }
  return { attacks, rolls };
}

function judge(value: number, need: number, critOn: number): DieOutcome {
  if (value >= critOn) return 'crit';
  if (value === 1) return 'fail';
  return value >= need ? 'success' : 'fail';
}

function rollWithReroll(n: number, need: number, critOn: number, reroll: Reroll, rng: Rng): DieResult[] {
  const out: DieResult[] = [];
  for (let i = 0; i < n; i++) {
    const v = rollDie(6, rng);
    let r: DieResult = { value: v, outcome: judge(v, need, critOn) };
    if ((reroll === 'ones' && v === 1) || (reroll === 'fails' && r.outcome === 'fail')) {
      const v2 = rollDie(6, rng);
      r = { value: v2, outcome: judge(v2, need, critOn), rerolledFrom: v };
    }
    out.push(r);
  }
  return out;
}

export interface HitStage {
  dice: DieResult[];
  hits: number; // hits that need a wound roll (incl. sustained extra hits)
  autoWounds: number; // lethal hits
  crits: number;
  sustainedExtra: number;
}

export function rollHits(plan: AttackPlan, attacks: number, o: AttackOptions, rng: Rng = defaultRng): HitStage {
  if (plan.autoHit) return { dice: [], hits: attacks, autoWounds: 0, crits: 0, sustainedExtra: 0 };
  const dice = rollWithReroll(attacks, plan.hitOn, plan.critHitOn, o.rerollHits, rng);
  let hits = 0;
  let autoWounds = 0;
  let crits = 0;
  let sustainedExtra = 0;
  for (const d of dice) {
    if (d.outcome === 'fail') continue;
    if (d.outcome === 'crit') {
      crits++;
      if (plan.abilities.sustainedHits) sustainedExtra += rollExpr(plan.abilities.sustainedHits, rng).total;
      if (plan.abilities.lethalHits) {
        autoWounds++;
        continue;
      }
    }
    hits++;
  }
  return { dice, hits: hits + sustainedExtra, autoWounds, crits, sustainedExtra };
}

export interface WoundStage {
  dice: DieResult[];
  wounds: number; // normal wounds needing a save (incl. lethal auto-wounds)
  mortal: number; // devastating wounds
}

export function rollWounds(plan: AttackPlan, hit: HitStage, o: AttackOptions, rng: Rng = defaultRng): WoundStage {
  const reroll: Reroll = plan.abilities.twinLinked ? 'fails' : o.rerollWounds;
  const dice = rollWithReroll(hit.hits, plan.woundOn, plan.critWoundOn, reroll, rng);
  let wounds = hit.autoWounds;
  let mortal = 0;
  for (const d of dice) {
    if (d.outcome === 'fail') continue;
    if (d.outcome === 'crit' && plan.abilities.devastatingWounds) mortal++;
    else wounds++;
  }
  return { dice, wounds, mortal };
}

export interface SaveStage {
  dice: DieResult[];
  unsaved: number;
}

export function rollSaves(plan: AttackPlan, wound: WoundStage, rng: Rng = defaultRng): SaveStage {
  const dice: DieResult[] = [];
  let unsaved = 0;
  for (let i = 0; i < wound.wounds; i++) {
    const v = rollDie(6, rng);
    const saved = v !== 1 && plan.saveOn <= 6 && v >= plan.saveOn;
    // From the defender's point of view a successful save is the "success".
    dice.push({ value: v, outcome: saved ? 'success' : 'fail' });
    if (!saved) unsaved++;
  }
  return { dice, unsaved };
}

function rollOneDamage(plan: AttackPlan, rng: Rng) {
  const melta = plan.meltaExpr ? rollExpr(plan.meltaExpr, rng).total : 0;
  return Math.max(0, rollExpr(plan.damageExpr, rng).total + melta + plan.damageBonus);
}

/** Average damage of one unsaved attack, before Feel No Pain. */
export function averageDamage(plan: AttackPlan) {
  return expectedValue(plan.damageExpr) + (plan.meltaExpr ? expectedValue(plan.meltaExpr) : 0) + plan.damageBonus;
}

export interface DamageStage {
  perAttack: number[]; // damage rolled for each unsaved attack / mortal wound source
  fnpDice: DieResult[];
  damageDealt: number; // after FNP, including wasted damage
  modelsDestroyed: number;
  woundsLostOnCurrent: number; // remaining state of the damaged model
  wasted: number;
}

export function rollDamage(plan: AttackPlan, save: SaveStage, wound: WoundStage, target: TargetProfile, rng: Rng = defaultRng): DamageStage {
  const perAttack: number[] = [];
  const fnpDice: DieResult[] = [];
  let modelsLeft = target.models;
  let lost = target.woundsLostOnCurrent ?? 0;
  let destroyed = 0;
  let dealt = 0;
  let wasted = 0;
  const W = Math.max(1, target.wounds);

  const applyFnp = (dmg: number) => {
    if (!plan.fnp) return dmg;
    let through = 0;
    for (let i = 0; i < dmg; i++) {
      const v = rollDie(6, rng);
      const ignored = v >= plan.fnp;
      fnpDice.push({ value: v, outcome: ignored ? 'success' : 'fail' });
      if (!ignored) through++;
    }
    return through;
  };

  const allocate = (dmg: number, spill: boolean) => {
    while (dmg > 0 && modelsLeft > 0) {
      const room = W - lost;
      const take = Math.min(room, dmg);
      lost += take;
      dealt += take;
      dmg -= take;
      if (lost >= W) {
        destroyed++;
        modelsLeft--;
        lost = 0;
        if (!spill) {
          wasted += dmg;
          return;
        }
      }
    }
    wasted += dmg;
  };

  for (let i = 0; i < save.unsaved; i++) {
    const d = rollOneDamage(plan, rng);
    perAttack.push(d);
    allocate(applyFnp(d), false);
  }
  for (let i = 0; i < wound.mortal; i++) {
    const d = rollOneDamage(plan, rng);
    perAttack.push(d);
    allocate(applyFnp(d), true);
  }
  return { perAttack, fnpDice, damageDealt: dealt, modelsDestroyed: destroyed, woundsLostOnCurrent: lost, wasted };
}

export interface Estimate {
  attacks: number;
  hits: number;
  wounds: number;
  unsaved: number;
  damage: number;
  modelsDestroyed: number;
  /** Probability of destroying the whole target unit. */
  wipeChance: number;
}

/** Monte-Carlo estimate of the average outcome. */
export function estimate(plan: AttackPlan, target: TargetProfile, o: AttackOptions, trials = 2000, rng: Rng = Math.random): Estimate {
  const sum = { attacks: 0, hits: 0, wounds: 0, unsaved: 0, damage: 0, modelsDestroyed: 0, wipes: 0 };
  for (let t = 0; t < trials; t++) {
    const a = rollAttackCount(plan, o, rng);
    const h = rollHits(plan, a.attacks, o, rng);
    const w = rollWounds(plan, h, o, rng);
    const s = rollSaves(plan, w, rng);
    const d = rollDamage(plan, s, w, target, rng);
    sum.attacks += a.attacks;
    sum.hits += h.hits + h.autoWounds;
    sum.wounds += w.wounds + w.mortal;
    sum.unsaved += s.unsaved + w.mortal;
    sum.damage += d.damageDealt;
    sum.modelsDestroyed += d.modelsDestroyed;
    if (d.modelsDestroyed >= target.models) sum.wipes++;
  }
  return {
    attacks: sum.attacks / trials,
    hits: sum.hits / trials,
    wounds: sum.wounds / trials,
    unsaved: sum.unsaved / trials,
    damage: sum.damage / trials,
    modelsDestroyed: sum.modelsDestroyed / trials,
    wipeChance: sum.wipes / trials,
  };
}

/** Summarise the number of attacks as an expression for display, e.g. "10×2" or "3×D6+1". */
export function describeAttacks(plan: AttackPlan, o: AttackOptions): string {
  const per = parseDice(plan.attacksExpr);
  const parts = [`${o.attackers} × ${plan.attacksExpr}`];
  if (plan.extraAttacksPerModel) parts.push(`+${plan.extraAttacksPerModel} each (Blast)`);
  if (plan.rapidFireExpr) parts.push(`+${plan.rapidFireExpr} each (Rapid Fire)`);
  const fixed = per.count === 0 && (!plan.rapidFireExpr || parseDice(plan.rapidFireExpr).count === 0);
  const total = fixed ? o.attackers * (per.bonus + plan.extraAttacksPerModel + (plan.rapidFireExpr ? parseNum(plan.rapidFireExpr) : 0)) : undefined;
  return parts.join(' ') + (total !== undefined ? ` = ${total}` : '');
}
