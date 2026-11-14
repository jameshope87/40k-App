import type { ReactNode } from 'react';
import type { ChecklistKind, Phase, Step } from '../../play/rules';
import { type GameState, checklistKey } from '../../play/game';
import { parseDice } from '../../play/dice';
import { Rich } from '../common';
import { openDice } from '../DiceTray';

const KIND_LABEL: Record<ChecklistKind, string> = { do: 'Do', check: 'Check', think: 'Think about' };
const KIND_ICON: Record<ChecklistKind, string> = { do: '☐', check: '✓', think: '💡' };

interface Props {
  game: GameState;
  phase?: Phase;
  step: Step;
  update: (fn: (g: GameState) => void) => void;
  /** Interactive helper (unit lists etc.). */
  helper?: ReactNode;
  /** Abilities from the loaded armies that mention this phase. */
  abilities?: ReactNode;
}

export default function StepGuide({ game, phase, step, update, helper, abilities }: Props) {
  const full = (game.guidance ?? 'full') === 'full';
  const active = game.players[game.activePlayer];
  const other = game.players[game.activePlayer === 0 ? 1 : 0];
  const prebattle = game.stage === 'prebattle';
  const checks = game.checks ?? {};
  const key = (id: string) => checklistKey(game, step.id, id);
  const shown = step.checklist.filter((i) => full || i.kind !== 'think');
  const done = shown.filter((i) => checks[key(i.id)]).length;
  const kinds: ChecklistKind[] = ['do', 'check', 'think'];

  const who = prebattle
    ? 'Both players'
    : step.actor === 'active'
      ? `${active.name} (active player)`
      : step.actor === 'opponent'
        ? other.name
        : `Both players · ${active.name} first`;

  return (
    <div className="card step-card">
      <div className="tiny muted">
        {prebattle ? 'Pre-battle' : `${phase?.name} · step ${game.step + 1} of ${phase?.steps.length}`}
        {' · '}
        <b className="gold">{who}</b>
      </div>
      <h2>{step.title}</h2>
      {phase && game.step === 0 && full && <p className="small muted" style={{ marginTop: 0 }}>{phase.intro}</p>}
      <p className="lead">
        <Rich text={step.overview} />
      </p>

      <div className="checklist">
        <div className="spread tiny muted">
          <span>Checklist</span>
          <span>
            {done}/{shown.length} done
          </span>
        </div>
        {kinds.map((kind) => {
          const items = shown.filter((i) => i.kind === kind);
          if (!items.length) return null;
          return (
            <div key={kind} className={`check-group ${kind}`}>
              <div className="check-kind">
                {KIND_ICON[kind]} {KIND_LABEL[kind]}
              </div>
              {items.map((i) => {
                const k = key(i.id);
                return (
                  <label key={i.id} className={`check-item ${checks[k] ? 'ticked' : ''}`}>
                    <input
                      type="checkbox"
                      checked={!!checks[k]}
                      onChange={(e) =>
                        update((g) => {
                          g.checks = { ...(g.checks ?? {}), [k]: e.target.checked };
                        })
                      }
                    />
                    <span>
                      <Rich text={i.text} />
                    </span>
                  </label>
                );
              })}
            </div>
          );
        })}
      </div>

      {!!step.dice?.length && (
        <div className="row" style={{ margin: '10px 0' }}>
          <span className="small muted">Dice:</span>
          {step.dice.map((d) => {
            const p = parseDice(d.expr);
            return (
              <button key={d.label} className="small" onClick={() => openDice({ count: Math.max(1, p.count), sides: p.sides || 6, target: d.target, label: d.label })} title={d.note}>
                🎲 {d.label} ({d.expr})
              </button>
            );
          })}
        </div>
      )}

      {helper && <div style={{ margin: '10px 0' }}>{helper}</div>}

      {!!step.reactions?.length && (
        <div className="watch" style={{ marginTop: 10 }}>
          <b>{prebattle ? 'Watch for' : `${other.name} can react`}:</b>
          <ul className="summary-list" style={{ margin: '4px 0 0' }}>
            {step.reactions.map((w) => (
              <li key={w}>
                <Rich text={w} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {!!step.mistakes?.length && (
        <details className="mistakes" open={full}>
          <summary className="small">
            <b>Common mistakes</b>
          </summary>
          <ul className="summary-list">
            {step.mistakes.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </details>
      )}

      <details open={full && step.summary.length <= 2}>
        <summary className="small">
          <b>Rules detail</b>
        </summary>
        <ul className="summary-list">
          {step.summary.map((s, i) => (
            <li key={i}>
              <Rich text={s} />
            </li>
          ))}
        </ul>
      </details>

      {abilities}
    </div>
  );
}
