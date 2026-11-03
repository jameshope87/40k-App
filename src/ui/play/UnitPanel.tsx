import { useState } from 'react';
import type { GameState, UnitState } from '../../play/game';
import { adjustWounds, isHalfStrength, log, totalWoundsRemaining } from '../../play/game';
import { Modal } from '../common';
import Datasheet from '../Datasheet';
import { unitLabel } from './abilities';

export function StatusPills({ u }: { u: UnitState }) {
  return (
    <>
      {u.modelsRemaining <= 0 && <span className="pill red">Destroyed</span>}
      {u.battleShocked && <span className="pill red">Battle-shocked</span>}
      {isHalfStrength(u) && !u.battleShocked && <span className="pill gold">Half-strength</span>}
      {u.inReserves && <span className="pill">Reserves</span>}
      {u.moved !== 'none' && <span className="pill">{u.moved === 'fallback' ? 'Fell back' : u.moved === 'stationary' ? 'Stationary' : u.moved === 'advance' ? `Advanced${u.advanceRoll ? ` +${u.advanceRoll}"` : ''}` : u.moved === 'ingress' ? 'Arrived' : 'Moved'}</span>}
      {u.shot && <span className="pill">Shot</span>}
      {u.charged && <span className="pill green">Charged</span>}
      {u.fought && <span className="pill">Fought</span>}
    </>
  );
}

export function HealthBar({ u }: { u: UnitState }) {
  const total = u.startingModels * u.woundsPerModel;
  const pct = total ? (100 * totalWoundsRemaining(u)) / total : 0;
  return (
    <span className="bar" title={`${totalWoundsRemaining(u)} / ${total} wounds`}>
      <i style={{ width: `${pct}%`, background: pct <= 50 ? 'var(--gold)' : undefined }} />
    </span>
  );
}

export function UnitDetail({ game, side, uid, onClose, update }: { game: GameState; side: 0 | 1; uid: string; onClose: () => void; update: (fn: (g: GameState) => void) => void }) {
  const u = game.players[side].units.find((x) => x.uid === uid);
  if (!u) return null;
  const mut = (fn: (x: UnitState) => void, msg?: string) =>
    update((g) => {
      const t = g.players[side].units.find((x) => x.uid === uid)!;
      fn(t);
      if (msg) log(g, msg, side);
    });
  return (
    <Modal onClose={onClose} title={unitLabel(u)}>
      <div className="row" style={{ marginBottom: 8 }}>
        <StatusPills u={u} />
      </div>
      <div className="card">
        <div className="spread">
          <span>
            <b>{u.modelsRemaining}</b>/{u.startingModels} models · {u.woundsPerModel}W each
            {u.woundsLost ? ` · current model has lost ${u.woundsLost}` : ''}
          </span>
          <HealthBar u={u} />
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <button className="small" onClick={() => mut((x) => adjustWounds(x, 1))}>
            −1 wound
          </button>
          <button className="small" onClick={() => mut((x) => adjustWounds(x, x.woundsPerModel - x.woundsLost))}>
            −1 model
          </button>
          <button className="small" onClick={() => mut((x) => adjustWounds(x, -1))}>
            +1 wound (heal)
          </button>
          <button className="small" onClick={() => mut((x) => adjustWounds(x, -(x.woundsPerModel)), `${unitLabel(u)}: model returned.`)}>
            +1 model
          </button>
        </div>
        <div className="row small" style={{ marginTop: 8 }}>
          <label className="row nowrap">
            <input type="checkbox" checked={u.battleShocked} onChange={(e) => mut((x) => (x.battleShocked = e.target.checked))} /> Battle-shocked
          </label>
          <label className="row nowrap">
            <input type="checkbox" checked={u.inReserves} onChange={(e) => mut((x) => (x.inReserves = e.target.checked))} /> In reserves
          </label>
          <label className="row nowrap">
            <input type="checkbox" checked={u.charged} onChange={(e) => mut((x) => (x.charged = e.target.checked))} /> Charged
          </label>
          <button className="small danger" onClick={() => mut((x) => ((x.modelsRemaining = 0), (x.woundsLost = 0)), `${unitLabel(u)} destroyed.`)}>
            Mark destroyed
          </button>
        </div>
        <label className="field" style={{ marginTop: 8 }}>
          <span>Notes</span>
          <input value={u.notes ?? ''} onChange={(e) => mut((x) => (x.notes = e.target.value))} placeholder="e.g. attached to…, objective held" />
        </label>
      </div>
      <div style={{ marginTop: 10 }}>
        <Datasheet sheet={u.sheet} compact />
      </div>
    </Modal>
  );
}

export function ArmyPanel({ game, update }: { game: GameState; update: (fn: (g: GameState) => void) => void }) {
  const [detail, setDetail] = useState<{ side: 0 | 1; uid: string } | null>(null);
  return (
    <div className="grid2">
      {game.players.map((p, side) => (
        <div key={side} className="card">
          <h3>
            {p.name} <span className="small muted">{p.armyName}</span>
          </h3>
          {!p.units.length && <p className="small muted">No list loaded.</p>}
          {p.units.map((u) => (
            <div key={u.uid} className={`unit-row ${u.modelsRemaining <= 0 ? 'dead' : ''}`} onClick={() => setDetail({ side: side as 0 | 1, uid: u.uid })} style={{ cursor: 'pointer' }}>
              <div className="grow">
                <div className="ellipsis">{unitLabel(u)}</div>
                <div className="row" style={{ gap: 4 }}>
                  <StatusPills u={u} />
                </div>
              </div>
              <span className="small muted">
                {u.modelsRemaining}/{u.startingModels}
              </span>
              <HealthBar u={u} />
            </div>
          ))}
        </div>
      ))}
      {detail && <UnitDetail game={game} side={detail.side} uid={detail.uid} onClose={() => setDetail(null)} update={update} />}
    </div>
  );
}
