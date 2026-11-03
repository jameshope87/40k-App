import { type ReactNode, useState } from 'react';
import type { Helper } from '../../play/rules';
import { type GameState, type MoveKind, type UnitState, isHalfStrength, leadership, log } from '../../play/game';
import { rollDice, parseNum } from '../../play/dice';
import { DiceFaces } from '../common';
import { StatusPills } from './UnitPanel';
import { unitLabel } from './abilities';

type Update = (fn: (g: GameState) => void) => void;
type OpenAttack = (side: 0 | 1, uid: string, kind: 'ranged' | 'melee') => void;

interface Props {
  helper: Helper;
  game: GameState;
  update: Update;
  openAttack: OpenAttack;
}

const alive = (u: UnitState) => u.modelsRemaining > 0;

function UnitLine({ u, children }: { u: UnitState; children?: ReactNode }) {
  return (
    <div className="unit-row">
      <div className="grow">
        <div className="ellipsis">
          <b>{unitLabel(u)}</b> <span className="tiny muted">M{u.sheet.stats[0]?.M ?? '?'} · Ld{u.sheet.stats[0]?.Ld ?? '?'} · OC{u.sheet.stats[0]?.OC ?? '?'}</span>
        </div>
        <div className="row" style={{ gap: 4 }}>
          <StatusPills u={u} />
        </div>
      </div>
      <div className="row">{children}</div>
    </div>
  );
}

function mutUnit(update: Update, side: number, uid: string, fn: (u: UnitState, g: GameState) => void) {
  update((g) => fn(g.players[side].units.find((x) => x.uid === uid)!, g));
}

function CpHelper({ game, update }: { game: GameState; update: Update }) {
  const key = `${game.round}-${game.activePlayer}`;
  const done = game.cpGrantedFor === key;
  return (
    <div className="row">
      <button
        className="primary"
        disabled={done}
        onClick={() =>
          update((g) => {
            g.players.forEach((p) => (p.cp += 1));
            g.cpGrantedFor = key;
            log(g, 'Both players gained 1CP.');
          })
        }
      >
        {done ? '✓ 1CP gained by both players' : 'Gain 1CP (both players)'}
      </button>
    </div>
  );
}

function BattleShockHelper({ game, update }: { game: GameState; update: Update }) {
  const side = game.activePlayer;
  const units = game.players[side].units.filter((u) => alive(u) && !u.inReserves);
  const needs = units.filter((u) => u.battleShocked || isHalfStrength(u));
  const [rolls, setRolls] = useState<Record<string, number[]>>({});
  if (!needs.length) return <p className="small green">No units need a Battle-shock test this turn.</p>;
  return (
    <div>
      {needs.map((u) => {
        const ld = leadership(u);
        const r = rolls[u.uid];
        return (
          <UnitLine key={u.uid} u={u}>
            {r && <DiceFaces dice={r} />}
            <button
              className="small"
              disabled={!!r}
              onClick={() => {
                const dice = rollDice(2);
                setRolls({ ...rolls, [u.uid]: dice });
                const total = dice[0] + dice[1];
                const pass = total >= ld;
                mutUnit(update, side, u.uid, (x, g) => {
                  x.battleShocked = !pass;
                  log(g, `${unitLabel(u)} Battle-shock test: rolled ${total} vs Ld ${ld}+ → ${pass ? 'passed' : 'FAILED (Battle-shocked)'}.`);
                });
              }}
            >
              {r ? (r[0] + r[1] >= ld ? `✓ ${r[0] + r[1]} passed` : `✗ ${r[0] + r[1]} failed`) : `Test 2D6 vs ${ld}+`}
            </button>
          </UnitLine>
        );
      })}
    </div>
  );
}

function MoveHelper({ game, update }: { game: GameState; update: Update }) {
  const side = game.activePlayer;
  const units = game.players[side].units.filter((u) => alive(u) && !u.inReserves);
  const set = (u: UnitState, moved: MoveKind) =>
    mutUnit(update, side, u.uid, (x, g) => {
      x.moved = moved;
      x.advanceRoll = undefined;
      if (moved === 'advance') {
        const r = rollDice(1)[0];
        x.advanceRoll = r;
        log(g, `${unitLabel(u)} Advanced: rolled ${r} → can move up to ${parseNum(u.sheet.stats[0]?.M ?? '0') + r}".`);
      } else if (moved === 'fallback') {
        log(g, `${unitLabel(u)} Fell Back.`);
      }
    });
  if (!units.length) return <p className="small muted">No units on the battlefield.</p>;
  return (
    <div>
      {units.map((u) => (
        <UnitLine key={u.uid} u={u}>
          <select value={u.moved === 'ingress' ? 'none' : u.moved} onChange={(e) => set(u, e.target.value as MoveKind)} aria-label={`Move for ${unitLabel(u)}`}>
            <option value="none">Not moved yet</option>
            <option value="stationary">Remain stationary</option>
            <option value="normal">Normal move ({u.sheet.stats[0]?.M ?? '?'})</option>
            <option value="advance">Advance (roll D6)</option>
            <option value="fallback">Fall back</option>
          </select>
        </UnitLine>
      ))}
    </div>
  );
}

function ReservesHelper({ game, update }: { game: GameState; update: Update }) {
  const side = game.activePlayer;
  const units = game.players[side].units.filter((u) => alive(u) && u.inReserves);
  if (!units.length) return <p className="small muted">No units in reserves. Mark units as “In reserves” during deployment or from the army panel.</p>;
  return (
    <div>
      {game.round >= 3 && <p className="small gold">Strategic Reserves that haven’t arrived by the end of battle round 3 count as destroyed.</p>}
      {units.map((u) => (
        <UnitLine key={u.uid} u={u}>
          <button
            className="small"
            onClick={() =>
              mutUnit(update, side, u.uid, (x, g) => {
                x.inReserves = false;
                x.moved = 'ingress';
                log(g, `${unitLabel(u)} arrived from reserves.`);
              })
            }
          >
            Arrive (ingress)
          </button>
        </UnitLine>
      ))}
    </div>
  );
}

function AttackList({ game, side, kind, openAttack }: { game: GameState; side: 0 | 1; kind: 'ranged' | 'melee'; openAttack: OpenAttack }) {
  const units = game.players[side].units.filter((u) => alive(u) && !u.inReserves && u.sheet.weapons.some((w) => w.kind === kind));
  if (!units.length) return <p className="small muted">{game.players[side].name} has no units that can make {kind} attacks.</p>;
  return (
    <div>
      {units.map((u) => {
        const blocked = kind === 'ranged' && u.moved === 'fallback';
        return (
          <UnitLine key={u.uid} u={u}>
            <button className={`small ${(kind === 'ranged' ? u.shot : u.fought) ? '' : 'primary'}`} onClick={() => openAttack(side, u.uid, kind)} title={blocked ? 'Fell back this turn' : undefined}>
              {kind === 'ranged' ? (u.shot ? 'Shoot again' : blocked ? 'Shoot (fell back!)' : 'Shoot') : u.fought ? 'Fight again' : 'Fight'}
            </button>
          </UnitLine>
        );
      })}
    </div>
  );
}

function ChargeHelper({ game, update }: { game: GameState; update: Update }) {
  const side = game.activePlayer;
  const units = game.players[side].units.filter((u) => alive(u) && !u.inReserves);
  const [rolls, setRolls] = useState<Record<string, number[]>>({});
  return (
    <div>
      {units.map((u) => {
        const cannot = u.moved === 'advance' || u.moved === 'fallback';
        const r = rolls[u.uid];
        return (
          <UnitLine key={u.uid} u={u}>
            {r && (
              <>
                <DiceFaces dice={r} />
                <b>{r[0] + r[1]}"</b>
              </>
            )}
            {cannot ? (
              <span className="tiny muted">{u.moved === 'advance' ? 'Advanced' : 'Fell back'}: can’t charge</span>
            ) : (
              <>
                <button className="small" onClick={() => setRolls({ ...rolls, [u.uid]: rollDice(2) })}>
                  {r ? 'Re-roll' : 'Roll 2D6'}
                </button>
                {r && (
                  <button
                    className={`small ${u.charged ? '' : 'primary'}`}
                    onClick={() =>
                      mutUnit(update, side, u.uid, (x, g) => {
                        x.charged = !x.charged;
                        x.chargeRoll = r[0] + r[1];
                        if (x.charged) log(g, `${unitLabel(u)} charged (${r[0] + r[1]}").`);
                      })
                    }
                  >
                    {u.charged ? '✓ Charged' : 'Charge made'}
                  </button>
                )}
              </>
            )}
          </UnitLine>
        );
      })}
    </div>
  );
}

function ScoreHelper({ game, update }: { game: GameState; update: Update }) {
  const side = game.activePlayer;
  const p = game.players[side];
  const add = (field: 'vpPrimary' | 'vpSecondary', n: number) =>
    update((g) => {
      g.players[side][field] = Math.max(0, g.players[side][field] + n);
      if (n > 0) log(g, `${p.name} scored ${n} ${field === 'vpPrimary' ? 'primary' : 'secondary'} VP.`);
    });
  return (
    <div className="row">
      <span className="small">{p.name}:</span>
      <span className="row nowrap">
        Primary
        {[1, 2, 3, 5].map((n) => (
          <button key={n} className="small" onClick={() => add('vpPrimary', n)}>
            +{n}
          </button>
        ))}
      </span>
      <span className="row nowrap">
        Secondary
        {[1, 2, 3, 5].map((n) => (
          <button key={n} className="small" onClick={() => add('vpSecondary', n)}>
            +{n}
          </button>
        ))}
      </span>
    </div>
  );
}

function DeployHelper({ game, update }: { game: GameState; update: Update }) {
  return (
    <div className="grid2">
      {game.players.map((p, side) => (
        <div key={side}>
          <b className="small">{p.name}: units starting in reserves</b>
          {!p.units.length && <p className="tiny muted">No list loaded.</p>}
          {p.units.map((u) => (
            <label key={u.uid} className="opt small">
              <input type="checkbox" checked={u.inReserves} onChange={(e) => mutUnit(update, side, u.uid, (x) => (x.inReserves = e.target.checked))} />
              <span className="name">{unitLabel(u)}</span>
              {u.sheet.rules.some((r) => /deep strike/i.test(r.name)) && <span className="pill">Deep Strike</span>}
              {u.sheet.rules.some((r) => /infiltrators/i.test(r.name)) && <span className="pill">Infiltrators</span>}
              {u.sheet.rules.some((r) => /scouts/i.test(r.name)) && <span className="pill">Scouts</span>}
            </label>
          ))}
        </div>
      ))}
    </div>
  );
}

function FirstTurnHelper({ game, update }: { game: GameState; update: Update }) {
  return (
    <div className="row">
      <span className="small">Who goes first?</span>
      {game.players.map((p, i) => (
        <button
          key={i}
          className={game.firstPlayer === i ? 'primary' : ''}
          onClick={() =>
            update((g) => {
              g.firstPlayer = i as 0 | 1;
              g.activePlayer = i as 0 | 1;
            })
          }
        >
          {p.name}
        </button>
      ))}
    </div>
  );
}

export default function StepHelper({ helper, game, update, openAttack }: Props) {
  switch (helper) {
    case 'cp':
      return <CpHelper game={game} update={update} />;
    case 'battleshock':
      return <BattleShockHelper game={game} update={update} />;
    case 'move':
      return <MoveHelper game={game} update={update} />;
    case 'reserves':
      return <ReservesHelper game={game} update={update} />;
    case 'shoot':
      return <AttackList game={game} side={game.activePlayer} kind="ranged" openAttack={openAttack} />;
    case 'charge':
      return <ChargeHelper game={game} update={update} />;
    case 'fight': {
      const other = (game.activePlayer === 0 ? 1 : 0) as 0 | 1;
      return (
        <div className="stack">
          <div>
            <b className="small">{game.players[game.activePlayer].name} (active player)</b>
            <AttackList game={game} side={game.activePlayer} kind="melee" openAttack={openAttack} />
          </div>
          <div>
            <b className="small">{game.players[other].name}</b>
            <AttackList game={game} side={other} kind="melee" openAttack={openAttack} />
          </div>
        </div>
      );
    }
    case 'score':
      return <ScoreHelper game={game} update={update} />;
    case 'deploy':
      return <DeployHelper game={game} update={update} />;
    case 'firstTurn':
      return <FirstTurnHelper game={game} update={update} />;
    default:
      return null;
  }
}

