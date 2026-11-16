import { describe, expect, it } from 'vitest';
import { PRE_BATTLE, TURN } from './rules';
import { checklistKey, newGame, newPlayer, nextStep } from './game';

const steps = [...PRE_BATTLE, ...TURN.flatMap((p) => p.steps)];

describe('guided rules content', () => {
  it('gives every step an overview and a checklist with unique ids', () => {
    for (const s of steps) {
      expect(s.overview, s.id).toBeTruthy();
      expect(s.checklist.length, s.id).toBeGreaterThan(0);
      const ids = s.checklist.map((i) => i.id);
      expect(new Set(ids).size, s.id).toBe(ids.length);
    }
    expect(new Set(steps.map((s) => s.id)).size).toBe(steps.length);
    for (const p of TURN) expect(p.intro, p.id).toBeTruthy();
  });

  it('keeps checklist ticks per turn in battle and per game before it', () => {
    let g = newGame(newPlayer('A'), newPlayer('B'));
    const pre = checklistKey(g, 'muster', 'size');
    for (let i = 0; i < PRE_BATTLE.length; i++) g = nextStep(g);
    const r1 = checklistKey(g, 'move-units', 'choose');
    expect(pre).not.toBe(r1);
    const turnSteps = TURN.reduce((n, p) => n + p.steps.length, 0);
    for (let i = 0; i < turnSteps; i++) g = nextStep(g);
    expect(checklistKey(g, 'move-units', 'choose')).not.toBe(r1);
  });
});
