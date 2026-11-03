/** Dice helpers: parse expressions like "D6", "2D6", "D3+3", "4". */

export type Rng = () => number;

export const defaultRng: Rng = () => {
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] / 2 ** 32;
  }
  return Math.random();
};

export interface DiceExpr {
  count: number; // number of dice
  sides: number; // 0 when there are no dice
  bonus: number;
}

export function parseDice(expr: string | number | undefined): DiceExpr {
  if (typeof expr === 'number') return { count: 0, sides: 0, bonus: expr };
  const s = String(expr ?? '').toUpperCase().replace(/\s+/g, '');
  const m = /^(\d*)D(\d+)([+-]\d+)?$/.exec(s);
  if (m) return { count: m[1] ? Number(m[1]) : 1, sides: Number(m[2]), bonus: m[3] ? Number(m[3]) : 0 };
  const n = parseInt(s, 10);
  return { count: 0, sides: 0, bonus: Number.isFinite(n) ? n : 0 };
}

export function isVariable(expr: string | number | undefined) {
  return parseDice(expr).count > 0;
}

export function rollDie(sides = 6, rng: Rng = defaultRng) {
  return 1 + Math.floor(rng() * sides);
}

export function rollDice(n: number, sides = 6, rng: Rng = defaultRng): number[] {
  return Array.from({ length: Math.max(0, n) }, () => rollDie(sides, rng));
}

export function rollExpr(expr: string | number | undefined, rng: Rng = defaultRng): { total: number; rolls: number[] } {
  const d = parseDice(expr);
  const rolls = d.sides ? rollDice(d.count, d.sides, rng) : [];
  return { total: rolls.reduce((a, b) => a + b, 0) + d.bonus, rolls };
}

export function expectedValue(expr: string | number | undefined): number {
  const d = parseDice(expr);
  return d.count * (d.sides ? (d.sides + 1) / 2 : 0) + d.bonus;
}

export function formatExpr(d: DiceExpr): string {
  const dice = d.count ? `${d.count > 1 ? d.count : ''}D${d.sides}` : '';
  if (!dice) return String(d.bonus);
  return d.bonus ? `${dice}${d.bonus > 0 ? '+' : ''}${d.bonus}` : dice;
}

/** "3+" → 3. Returns undefined for "-", "N/A", "" etc. */
export function parseTarget(s: string | undefined): number | undefined {
  const m = /(\d+)\s*\+?/.exec(String(s ?? ''));
  return m ? Number(m[1]) : undefined;
}

/** Parse a characteristic like 4, "4", '6"' or "-1" into a number. */
export function parseNum(s: string | number | undefined): number {
  if (typeof s === 'number') return s;
  const m = /-?\d+/.exec(String(s ?? ''));
  return m ? Number(m[0]) : 0;
}
