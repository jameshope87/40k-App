/** Game (Play mode) state. Plain JSON so it can be saved and resumed. */
import type { UnitSheet } from '../roster/summary';
import { parseNum } from './dice';
import { MAX_ROUNDS, PRE_BATTLE, TURN } from './rules';
import { uid } from '../roster/model';

export type MoveKind = 'none' | 'stationary' | 'normal' | 'advance' | 'fallback' | 'ingress';

export interface UnitState {
  uid: string;
  sheet: UnitSheet;
  startingModels: number;
  modelsRemaining: number;
  /** Wounds per model (from the first stat line). */
  woundsPerModel: number;
  /** Wounds already lost on the currently damaged model. */
  woundsLost: number;
  battleShocked: boolean;
  inReserves: boolean;
  /** Per-turn flags; reset at the start of the owning player's turn. */
  moved: MoveKind;
  advanceRoll?: number;
  shot: boolean;
  charged: boolean;
  chargeRoll?: number;
  fought: boolean;
  usedOneShot: string[];
  notes?: string;
  /** Uid of the bodyguard unit this Leader / Support unit is attached to. */
  attachedTo?: string;
  /** How it is attached, e.g. "Leader" or "Supported by". */
  attachedAs?: string;
}

export interface PlayerState {
  name: string;
  rosterUid?: string;
  armyName: string;
  faction: string;
  cp: number;
  vpPrimary: number;
  vpSecondary: number;
  units: UnitState[];
}

export interface LogEntry {
  at: number;
  round: number;
  player: number;
  text: string;
}

export interface GameState {
  uid: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  players: [PlayerState, PlayerState];
  stage: 'prebattle' | 'battle' | 'ended';
  preStep: number;
  round: number;
  firstPlayer: 0 | 1;
  activePlayer: 0 | 1;
  phase: number;
  step: number;
  /** Round + player for which CP was already granted, to avoid double-adding. */
  cpGrantedFor?: string;
  log: LogEntry[];
}

export function makeUnitState(sheet: UnitSheet): UnitState {
  const w = Math.max(1, parseNum(sheet.stats[0]?.W ?? '1'));
  return {
    uid: uid(),
    sheet,
    startingModels: sheet.models,
    modelsRemaining: sheet.models,
    woundsPerModel: w,
    woundsLost: 0,
    battleShocked: false,
    inReserves: false,
    moved: 'none',
    shot: false,
    charged: false,
    fought: false,
    usedOneShot: [],
  };
}

export function newPlayer(name: string): PlayerState {
  return { name, armyName: '', faction: '', cp: 0, vpPrimary: 0, vpSecondary: 0, units: [] };
}

export function newGame(p1: PlayerState, p2: PlayerState): GameState {
  const now = Date.now();
  return {
    uid: uid(),
    name: `${p1.name} vs ${p2.name}`,
    createdAt: now,
    updatedAt: now,
    players: [p1, p2],
    stage: 'prebattle',
    preStep: 0,
    round: 1,
    firstPlayer: 0,
    activePlayer: 0,
    phase: 0,
    step: 0,
    log: [],
  };
}

export function isDestroyed(u: UnitState) {
  return u.modelsRemaining <= 0;
}

/**
 * An attached unit: a bodyguard plus the Leader / Support units attached to it,
 * or a unit on its own. Once the bodyguard is destroyed, its leaders carry on
 * as separate units.
 */
export interface Formation {
  lead: UnitState;
  /** The lead unit first, then attached units. */
  members: UnitState[];
}

/** The bodyguard a unit is currently attached to (if it is still alive). */
export function bodyguardOf(p: PlayerState, u: UnitState): UnitState | undefined {
  if (!u.attachedTo) return undefined;
  const bg = p.units.find((x) => x.uid === u.attachedTo);
  return bg && !isDestroyed(bg) && bg !== u ? bg : undefined;
}

export function formations(p: PlayerState): Formation[] {
  const out: Formation[] = [];
  for (const u of p.units) {
    if (bodyguardOf(p, u)) continue;
    const members = [u, ...(isDestroyed(u) ? [] : p.units.filter((x) => x !== u && bodyguardOf(p, x) === u))];
    out.push({ lead: u, members });
  }
  return out;
}

export function formationOf(p: PlayerState, u: UnitState): Formation {
  const lead = bodyguardOf(p, u) ?? u;
  return formations(p).find((f) => f.lead === lead) ?? { lead: u, members: [u] };
}

export function formationName(f: Formation, label: (u: UnitState) => string = (u) => u.sheet.customName || u.sheet.name) {
  return f.members.map(label).join(' + ');
}

export function isFormationDestroyed(f: Formation) {
  return f.members.every(isDestroyed);
}

/** Half-strength check for an attached unit, counting every model in it. */
export function isFormationHalfStrength(f: Formation) {
  const alive = f.members.filter((u) => !isDestroyed(u));
  if (!alive.length) return false;
  if (f.members.length === 1) return isHalfStrength(f.lead);
  const start = f.members.reduce((s, u) => s + u.startingModels, 0);
  const left = f.members.reduce((s, u) => s + u.modelsRemaining, 0);
  return left * 2 <= start;
}

/** Best (lowest) Leadership among the living models of a formation. */
export function formationLeadership(f: Formation) {
  const alive = f.members.filter((u) => !isDestroyed(u));
  return Math.min(...(alive.length ? alive : f.members).map(leadership));
}

export function totalWoundsRemaining(u: UnitState) {
  return Math.max(0, u.modelsRemaining * u.woundsPerModel - u.woundsLost);
}

/** At or below half strength (see rules note). */
export function isHalfStrength(u: UnitState) {
  if (isDestroyed(u)) return false;
  if (u.startingModels <= 1) return totalWoundsRemaining(u) * 2 <= u.woundsPerModel;
  return u.modelsRemaining * 2 <= u.startingModels;
}

export function leadership(u: UnitState) {
  return parseNum(u.sheet.stats[0]?.Ld ?? '7');
}

export function vp(p: PlayerState) {
  return p.vpPrimary + p.vpSecondary;
}

// ---- navigation -----------------------------------------------------------

export function currentStep(g: GameState) {
  if (g.stage === 'prebattle') return { phase: undefined, step: PRE_BATTLE[g.preStep] };
  const phase = TURN[g.phase];
  return { phase, step: phase.steps[g.step] };
}

function resetTurnFlags(p: PlayerState) {
  for (const u of p.units) {
    u.moved = 'none';
    u.advanceRoll = undefined;
    u.shot = false;
    u.charged = false;
    u.chargeRoll = undefined;
    u.fought = false;
  }
}

export function log(g: GameState, text: string, player: number = g.activePlayer) {
  g.log.unshift({ at: Date.now(), round: g.round, player, text });
  if (g.log.length > 500) g.log.length = 500;
}

/** Advance to the next step. Mutates a draft copy and returns it. */
export function nextStep(prev: GameState): GameState {
  const g = structuredClone(prev);
  if (g.stage === 'prebattle') {
    if (g.preStep < PRE_BATTLE.length - 1) g.preStep++;
    else {
      g.stage = 'battle';
      g.round = 1;
      g.activePlayer = g.firstPlayer;
      g.phase = 0;
      g.step = 0;
      resetTurnFlags(g.players[g.activePlayer]);
      log(g, `Battle round 1 begins. ${g.players[g.activePlayer].name} takes the first turn.`);
    }
    return g;
  }
  if (g.stage === 'ended') return g;
  const phase = TURN[g.phase];
  if (g.step < phase.steps.length - 1) {
    g.step++;
  } else if (g.phase < TURN.length - 1) {
    g.phase++;
    g.step = 0;
  } else {
    // End of this player's turn.
    const second = g.activePlayer !== g.firstPlayer;
    if (second) {
      if (g.round >= MAX_ROUNDS) {
        g.stage = 'ended';
        log(g, 'The battle is over.');
        return g;
      }
      g.round++;
      log(g, `Battle round ${g.round} begins.`);
    }
    g.activePlayer = (g.activePlayer === 0 ? 1 : 0) as 0 | 1;
    g.phase = 0;
    g.step = 0;
    resetTurnFlags(g.players[g.activePlayer]);
    log(g, `${g.players[g.activePlayer].name}'s turn.`);
  }
  return g;
}

export function prevStep(prev: GameState): GameState {
  const g = structuredClone(prev);
  if (g.stage === 'prebattle') {
    g.preStep = Math.max(0, g.preStep - 1);
    return g;
  }
  if (g.stage === 'ended') {
    g.stage = 'battle';
    return g;
  }
  if (g.step > 0) g.step--;
  else if (g.phase > 0) {
    g.phase--;
    g.step = TURN[g.phase].steps.length - 1;
  } else if (!(g.round === 1 && g.activePlayer === g.firstPlayer)) {
    // Back into the previous player's End of turn (flags are not restored).
    const wasSecond = g.activePlayer !== g.firstPlayer;
    if (!wasSecond) g.round--;
    g.activePlayer = (g.activePlayer === 0 ? 1 : 0) as 0 | 1;
    g.phase = TURN.length - 1;
    g.step = TURN[g.phase].steps.length - 1;
  } else {
    g.stage = 'prebattle';
    g.preStep = PRE_BATTLE.length - 1;
  }
  return g;
}

export function jumpTo(prev: GameState, phase: number, step = 0): GameState {
  const g = structuredClone(prev);
  g.phase = phase;
  g.step = step;
  return g;
}

/** Apply damage to a unit's tracked state. */
export function applyDamage(u: UnitState, modelsDestroyed: number, woundsLostOnCurrent: number) {
  u.modelsRemaining = Math.max(0, u.modelsRemaining - modelsDestroyed);
  u.woundsLost = u.modelsRemaining > 0 ? woundsLostOnCurrent : 0;
}

/** Damage one wound at a time (for manual adjustments). */
export function adjustWounds(u: UnitState, delta: number) {
  if (delta > 0) {
    for (let i = 0; i < delta && u.modelsRemaining > 0; i++) {
      u.woundsLost++;
      if (u.woundsLost >= u.woundsPerModel) {
        u.modelsRemaining--;
        u.woundsLost = 0;
      }
    }
  } else {
    for (let i = 0; i < -delta; i++) {
      if (u.woundsLost > 0) u.woundsLost--;
      else if (u.modelsRemaining < u.startingModels) {
        u.modelsRemaining++;
        u.woundsLost = u.woundsPerModel - 1;
      }
    }
  }
}
