import { type ReactNode, useState } from 'react';
import type { Helper } from '../../play/rules';
import {
  type Formation,
  type GameState,
  type MoveKind,
  type UnitState,
  formationLeadership,
  formationName,
  formations,
  isFormationDestroyed,
  isFormationHalfStrength,
  log,
} from '../../play/game';
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

const alive = (f: Formation) => !isFormationDestroyed(f);
const fname = (f: Formation) => formationName(f, unitLabel);

/** Slowest Move characteristic in the formation (attached units move together). */
function formationMove(f: Formation) {
  const ms = f.members.filter((u) => u.modelsRemaining > 0).map((u) => parseNum(u.sheet.stats[0]?.M ?? '0'));
  return ms.length ? Math.min(...ms) : 0;
}

function FormationLine({ f, children }: { f: Formation; children?: ReactNode }) {
  const s = f.lead.sheet.stats[0];
  return (
    <div className="unit-row">
      <div className="grow">
        <div className="ellipsis">
          <b>{unitLabel(f.lead)}</b>
          {f.members.length > 1 && <span className="small gold"> + {f.members.slice(1).map(unitLabel).join(' + ')}</span>}{' '}
          <span className="tiny muted">
            M{f.members.length > 1 ? `${formationMove(f)}"` : (s?.M ?? '?')} · Ld{formationLeadership(f)}+ · OC{s?.OC ?? '?'}
          </span>
        </div>
        <div className="row" style={{ gap: 4 }}>
          <StatusPills u={f.lead} />
        </div>
      </div>
      <div className="row">{children}</div>
    </div>
  );
}

/** Apply a change to every unit in a formation. */
function mutFormation(update: Update, side: number, f: Formation, fn: (u: UnitState, g: GameState, isLead: boolean) => void) {
  const uids = f.members.map((m) => m.uid);
  update((g) => {
    for (const uid of uids) {
      const u = g.players[side].units.find((x) => x.uid === uid);
      if (u) fn(u, g, uid === f.lead.uid);
    }
  });
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
  const list = formations(game.players[side]).filter((f) => alive(f) && !f.lead.inReserves);
  const needs = list.filter((f) => f.members.some((u) => u.battleShocked) || isFormationHalfStrength(f));
  const [rolls, setRolls] = useState<Record<string, number[]>>({});
  if (!needs.length) return <p className="small green">No units need a Battle-shock test this turn.</p>;
  return (
    <div>
      {needs.map((f) => {
        const ld = formationLeadership(f);
        const r = rolls[f.lead.uid];
        return (
          <FormationLine key={f.lead.uid} f={f}>
            {r && <DiceFaces dice={r} />}
            <button
              className="small"
              disabled={!!r}
              onClick={() => {
                const dice = rollDice(2);
                setRolls({ ...rolls, [f.lead.uid]: dice });
                const total = dice[0] + dice[1];
                const pass = total >= ld;
                mutFormation(update, side, f, (x, g, isLead) => {
                  x.battleShocked = !pass;
                  if (isLead) log(g, `${fname(f)} Battle-shock test: rolled ${total} vs Ld ${ld}+ → ${pass ? 'passed' : 'FAILED (Battle-shocked)'}.`);
                });
              }}
            >
              {r ? (r[0] + r[1] >= ld ? `✓ ${r[0] + r[1]} passed` : `✗ ${r[0] + r[1]} failed`) : `Test 2D6 vs ${ld}+`}
            </button>
          </FormationLine>
        );
      })}
    </div>
  );
}

function MoveHelper({ game, update }: { game: GameState; update: Update }) {
  const side = game.activePlayer;
  const list = formations(game.players[side]).filter((f) => alive(f) && !f.lead.inReserves);
  const set = (f: Formation, moved: MoveKind) => {
    const roll = moved === 'advance' ? rollDice(1)[0] : undefined;
    mutFormation(update, side, f, (x, g, isLead) => {
      x.moved = moved;
      x.advanceRoll = roll;
      if (!isLead) return;
      if (moved === 'advance') log(g, `${fname(f)} Advanced: rolled ${roll} → can move up to ${formationMove(f) + (roll ?? 0)}".`);
      else if (moved === 'fallback') log(g, `${fname(f)} Fell Back.`);
    });
  };
  if (!list.length) return <p className="small muted">No units on the battlefield.</p>;
  return (
    <div>
      {list.map((f) => (
        <FormationLine key={f.lead.uid} f={f}>
          <select value={f.lead.moved === 'ingress' ? 'none' : f.lead.moved} onChange={(e) => set(f, e.target.value as MoveKind)} aria-label={`Move for ${fname(f)}`}>
            <option value="none">Not moved yet</option>
            <option value="stationary">Remain stationary</option>
            <option value="normal">Normal move ({formationMove(f)}")</option>
            <option value="advance">Advance (roll D6)</option>
            <option value="fallback">Fall back</option>
          </select>
        </FormationLine>
      ))}
    </div>
  );
}

function ReservesHelper({ game, update }: { game: GameState; update: Update }) {
  const side = game.activePlayer;
  const list = formations(game.players[side]).filter((f) => alive(f) && f.lead.inReserves);
  if (!list.length) return <p className="small muted">No units in reserves. Mark units as “In reserves” during deployment or from the army panel.</p>;
  return (
    <div>
      {game.round >= 3 && <p className="small gold">Strategic Reserves that haven’t arrived by the end of battle round 3 count as destroyed.</p>}
      {list.map((f) => (
        <FormationLine key={f.lead.uid} f={f}>
          <button
            className="small"
            onClick={() =>
              mutFormation(update, side, f, (x, g, isLead) => {
                x.inReserves = false;
                x.moved = 'ingress';
                if (isLead) log(g, `${fname(f)} arrived from reserves.`);
              })
            }
          >
            Arrive (ingress)
          </button>
        </FormationLine>
      ))}
    </div>
  );
}

function AttackList({ game, side, kind, openAttack }: { game: GameState; side: 0 | 1; kind: 'ranged' | 'melee'; openAttack: OpenAttack }) {
  const list = formations(game.players[side]).filter(
    (f) => alive(f) && !f.lead.inReserves && f.members.some((u) => u.modelsRemaining > 0 && u.sheet.weapons.some((w) => w.kind === kind)),
  );
  if (!list.length) return <p className="small muted">{game.players[side].name} has no units that can make {kind} attacks.</p>;
  return (
    <div>
      {list.map((f) => {
        const u = f.lead;
        const blocked = kind === 'ranged' && u.moved === 'fallback';
        const done = kind === 'ranged' ? u.shot : u.fought;
        return (
          <FormationLine key={u.uid} f={f}>
            <button className={`small ${done ? '' : 'primary'}`} onClick={() => openAttack(side, u.uid, kind)} title={blocked ? 'Fell back this turn' : undefined}>
              {kind === 'ranged' ? (done ? 'Shoot again' : blocked ? 'Shoot (fell back!)' : 'Shoot') : done ? 'Fight again' : 'Fight'}
            </button>
          </FormationLine>
        );
      })}
    </div>
  );
}

function ChargeHelper({ game, update }: { game: GameState; update: Update }) {
  const side = game.activePlayer;
  const list = formations(game.players[side]).filter((f) => alive(f) && !f.lead.inReserves);
  const [rolls, setRolls] = useState<Record<string, number[]>>({});
  return (
    <div>
      {list.map((f) => {
        const u = f.lead;
        const cannot = u.moved === 'advance' || u.moved === 'fallback';
        const r = rolls[u.uid];
        return (
          <FormationLine key={u.uid} f={f}>
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
                      mutFormation(update, side, f, (x, g, isLead) => {
                        x.charged = !u.charged;
                        x.chargeRoll = r[0] + r[1];
                        if (isLead && x.charged) log(g, `${fname(f)} charged (${r[0] + r[1]}").`);
                      })
                    }
                  >
                    {u.charged ? '✓ Charged' : 'Charge made'}
                  </button>
                )}
              </>
            )}
          </FormationLine>
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
  const hasRule = (f: Formation, re: RegExp) => f.members.every((u) => u.sheet.rules.some((r) => re.test(r.name)));
  return (
    <div className="grid2">
      {game.players.map((p, side) => (
        <div key={side}>
          <b className="small">{p.name}: units starting in reserves</b>
          {!p.units.length && <p className="tiny muted">No list loaded.</p>}
          {formations(p).map((f) => (
            <label key={f.lead.uid} className="opt small">
              <input type="checkbox" checked={f.lead.inReserves} onChange={(e) => mutFormation(update, side, f, (x) => (x.inReserves = e.target.checked))} />
              <span className="name">{fname(f)}</span>
              {hasRule(f, /deep strike/i) && <span className="pill">Deep Strike</span>}
              {hasRule(f, /infiltrators/i) && <span className="pill">Infiltrators</span>}
              {hasRule(f, /scouts/i) && <span className="pill">Scouts</span>}
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

function MusterHelper({ game }: { game: GameState }) {
  const attached = game.players.flatMap((p) => formations(p).filter((f) => f.members.length > 1).map((f) => ({ p, f })));
  return (
    <div className="small">
      {attached.length ? (
        <>
          <b>Attached units</b>
          <ul className="summary-list">
            {attached.map(({ p, f }) => (
              <li key={f.lead.uid}>
                {p.name}: {fname(f)}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="muted">No Leader or Support units are attached yet.</p>
      )}
      <p className="muted">Attach units in the army list editor, or here from the Armies tab (tap a unit → “Attached to”).</p>
    </div>
  );
}

export default function StepHelper({ helper, game, update, openAttack }: Props) {
  switch (helper) {
    case 'muster':
      return <MusterHelper game={game} />;
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
