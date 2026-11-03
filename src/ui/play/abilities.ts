import type { PlayerState, UnitState } from '../../play/game';

/** Words that suggest an ability is relevant to a phase or step. */
export const TRIGGER_PATTERNS: Record<string, RegExp> = {
  start: /start of (your|the|each|any) turn/i,
  command: /command phase|battle-shock|\bCP\b/i,
  movement: /movement phase|\badvance|fall(s)? back|ingress|deep strike|reserves|normal move/i,
  shooting: /shooting phase|ranged attack|selected to shoot|\bshoots?\b/i,
  charge: /charge phase|charge (roll|move)|declares? a charge|\bcharges?\b/i,
  fight: /fight phase|melee attack|selected to fight|pile.in|consolidat|fights? first/i,
  end: /end of (your|the|each|any|your opponent.s) turn|end of the battle round/i,
  prebattle: /deploy|scouts|infiltrators|pre-battle|before the battle|muster|battle formations|first turn/i,
};

export function relevantAbilities(players: PlayerState[], phaseId: string): { player: PlayerState; unit: UnitState; name: string; text: string }[] {
  const re = TRIGGER_PATTERNS[phaseId];
  if (!re) return [];
  const out: { player: PlayerState; unit: UnitState; name: string; text: string }[] = [];
  const seen = new Set<string>();
  for (const player of players) {
    for (const unit of player.units) {
      if (unit.modelsRemaining <= 0) continue;
      for (const a of [...unit.sheet.abilities, ...unit.sheet.rules]) {
        if (!re.test(a.text)) continue;
        // Core rules (e.g. "Deep Strike") repeat across units; show them once per player.
        const key = unit.sheet.rules.includes(a) ? `${player.name}:${a.name}` : `${unit.uid}:${a.name}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ player, unit, name: a.name, text: a.text });
      }
    }
  }
  return out;
}

export function unitLabel(u: UnitState) {
  return u.sheet.customName || u.sheet.name;
}

export function parseFnp(u: UnitState): number | undefined {
  for (const a of [...u.sheet.rules, ...u.sheet.abilities]) {
    const m = /feel no pain\s*(\d)\+/i.exec(a.name) ?? /feel no pain\s*(\d)\+/i.exec(a.text.slice(0, 80));
    if (m) return Number(m[1]);
  }
  return undefined;
}
