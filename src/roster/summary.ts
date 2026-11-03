/**
 * Turns a resolved unit selection into a flat "datasheet" used by the
 * roster view and by Play mode. Datasheets are plain JSON so a game can be
 * played without the catalogue being loaded.
 */
import type { Evaluator, RSel } from '../bsdata/engine';
import type { RawProfile } from '../bsdata/types';

export interface WeaponProfile {
  name: string;
  kind: 'ranged' | 'melee';
  /** Number of models carrying this weapon. */
  count: number;
  range: string;
  attacks: string;
  skill: string; // BS or WS, e.g. "3+"
  strength: string;
  ap: string;
  damage: string;
  keywords: string[];
}

export interface StatLine {
  name: string;
  M: string;
  T: string;
  Sv: string;
  W: string;
  Ld: string;
  OC: string;
  InSv?: string;
  extra: Record<string, string>;
}

export interface NamedText {
  name: string;
  text: string;
}

export interface UnitSheet {
  name: string;
  customName?: string;
  points: number;
  models: number;
  composition: { name: string; count: number }[];
  stats: StatLine[];
  weapons: WeaponProfile[];
  abilities: NamedText[];
  rules: NamedText[];
  otherProfiles: { type: string; name: string; values: Record<string, string> }[];
  keywords: string[];
  factionKeywords: string[];
  upgrades: string[];
}

function chars(p: RawProfile): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of p.characteristics ?? []) out[c.name] = (c.$text ?? '').trim();
  return out;
}

function pick(c: Record<string, string>, ...names: string[]) {
  for (const n of names) {
    const hit = Object.keys(c).find((k) => k.toLowerCase() === n.toLowerCase());
    if (hit) return c[hit];
  }
  return '';
}

export function splitKeywords(s: string): string[] {
  return s
    .split(/,(?![^[]*\])/)
    .map((k) => k.replace(/[[\]*]/g, '').trim())
    .filter((k) => k && k !== '-');
}

const NON_KEYWORD_CATEGORIES = /^(configuration|reference|unit|warlord|order of battle|crucible|3dp detachment|allies:)/i;

export function describeUnit(ev: Evaluator, unit: RSel): UnitSheet {
  const stats: StatLine[] = [];
  const weapons = new Map<string, WeaponProfile>();
  const abilities = new Map<string, NamedText>();
  const rules = new Map<string, NamedText>();
  const otherProfiles: UnitSheet['otherProfiles'] = [];
  const composition = new Map<string, number>();
  const upgrades: string[] = [];
  let models = 0;

  const walk = (r: RSel, mult: number) => {
    if (r.node.type === 'model') {
      models += mult;
      const nm = ev.nameOf(r.node, r);
      composition.set(nm, (composition.get(nm) ?? 0) + mult);
    } else if (r !== unit && r.node.type === 'upgrade' && !r.node.infos.some((i) => i.profile && /weapon/i.test(i.profile.typeName ?? ''))) {
      upgrades.push(ev.nameOf(r.node, r));
    }
    for (const { item, name } of ev.visibleInfos(r)) {
      if (item.kind === 'rule' && item.rule) {
        if (!rules.has(name)) rules.set(name, { name, text: item.rule.description ?? '' });
        continue;
      }
      const p = item.profile!;
      const type = (p.typeName ?? '').toLowerCase();
      const c = chars(p);
      if (type === 'unit') {
        if (!stats.some((s) => s.name === name)) {
          const known = ['M', 'T', 'SV', 'W', 'LD', 'OC', 'INSV'];
          const extra: Record<string, string> = {};
          for (const [k, v] of Object.entries(c)) if (!known.includes(k.toUpperCase()) && v) extra[k] = v;
          stats.push({ name, M: pick(c, 'M'), T: pick(c, 'T'), Sv: pick(c, 'SV'), W: pick(c, 'W'), Ld: pick(c, 'LD'), OC: pick(c, 'OC'), InSv: pick(c, 'InSv') || undefined, extra });
        }
      } else if (type.includes('weapon')) {
        const kind = type.includes('melee') ? 'melee' : 'ranged';
        const key = `${kind}:${name}`;
        const existing = weapons.get(key);
        if (existing) existing.count += mult;
        else
          weapons.set(key, {
            name,
            kind,
            count: mult,
            range: pick(c, 'Range'),
            attacks: pick(c, 'A'),
            skill: pick(c, 'BS', 'WS'),
            strength: pick(c, 'S'),
            ap: pick(c, 'AP'),
            damage: pick(c, 'D'),
            keywords: splitKeywords(pick(c, 'Keywords')),
          });
      } else if (type.startsWith('abilities') || type.includes('abilit')) {
        if (!abilities.has(name)) abilities.set(name, { name, text: Object.values(c).join('\n') });
      } else {
        otherProfiles.push({ type: p.typeName ?? 'Profile', name, values: c });
      }
    }
    for (const ch of r.children) walk(ch, mult * ch.sel.count);
  };
  walk(unit, 1);
  if (!models) {
    models = 1;
    composition.set(ev.nameOf(unit.node, unit), 1);
  }

  const cats = unit.node.categoryIds.map((id) => ev.index.categoryName(id)).filter((n) => !NON_KEYWORD_CATEGORIES.test(n));
  return {
    name: ev.nameOf(unit.node, unit),
    customName: unit.sel.customName,
    points: ev.totalCost(unit),
    models,
    composition: [...composition].map(([name, count]) => ({ name, count })),
    stats,
    weapons: [...weapons.values()],
    abilities: [...abilities.values()],
    rules: [...rules.values()],
    otherProfiles,
    keywords: [...new Set(cats.filter((n) => !n.startsWith('Faction:')))],
    factionKeywords: [...new Set(cats.filter((n) => n.startsWith('Faction:')).map((n) => n.replace(/^Faction:\s*/, '')))],
    upgrades,
  };
}
