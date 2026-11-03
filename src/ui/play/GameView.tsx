import { useState } from 'react';
import { gamesStore, saveGame, useStore } from '../../store';
import { navigate } from '../../router';
import { type GameState, currentStep, jumpTo, nextStep, prevStep, vp } from '../../play/game';
import { DISCLAIMER, GLOSSARY, MAX_ROUNDS, PRE_BATTLE, RULES_EDITION, TURN } from '../../play/rules';
import { parseDice } from '../../play/dice';
import { Counter, Modal, Rich } from '../common';
import { openDice } from '../DiceTray';
import StepHelper from './StepHelpers';
import AttackHelper from './AttackHelper';
import { ArmyPanel } from './UnitPanel';
import { relevantAbilities, unitLabel } from './abilities';

export default function GameView({ uid }: { uid: string }) {
  const games = useStore(gamesStore);
  const game = games.find((g) => g.uid === uid);
  const [attack, setAttack] = useState<{ side: 0 | 1; uid: string; kind: 'ranged' | 'melee' } | null>(null);
  const [panel, setPanel] = useState<'step' | 'armies' | 'log' | 'glossary'>('step');
  const [scoring, setScoring] = useState(false);

  if (!game) {
    return (
      <div className="page">
        <p>Game not found.</p>
        <button onClick={() => navigate('/')}>Back</button>
      </div>
    );
  }

  const set = (g: GameState) => saveGame(g);
  const update = (fn: (g: GameState) => void) => {
    const g = structuredClone(game);
    fn(g);
    saveGame(g);
  };

  const { phase, step } = currentStep(game);
  const active = game.players[game.activePlayer];
  const phaseId = game.stage === 'prebattle' ? 'prebattle' : (phase?.id ?? '');
  const abilities =
    game.stage === 'prebattle'
      ? relevantAbilities(game.players, 'prebattle')
      : relevantAbilities([active], phaseId).concat(
          // Reactive abilities of the opponent that mention the phase
          relevantAbilities([game.players[game.activePlayer === 0 ? 1 : 0]], phaseId).filter((a) => /opponent|enemy unit (is selected|ends|declares)/i.test(a.text)),
        );

  const nextLabel = (() => {
    if (game.stage === 'ended') return 'Game over';
    if (game.stage === 'prebattle') return game.preStep < PRE_BATTLE.length - 1 ? `Next: ${PRE_BATTLE[game.preStep + 1].title}` : 'Begin battle round 1';
    if (phase && game.step < phase.steps.length - 1) return `Next: ${phase.steps[game.step + 1].title}`;
    if (game.phase < TURN.length - 1) return `Next: ${TURN[game.phase + 1].name}`;
    const second = game.activePlayer !== game.firstPlayer;
    if (second && game.round >= MAX_ROUNDS) return 'End the battle';
    return `End turn → ${game.players[game.activePlayer === 0 ? 1 : 0].name}`;
  })();

  return (
    <>
      <div className="topbar">
        <button className="icon ghost" onClick={() => navigate('/')} aria-label="Back">
          ←
        </button>
        <div className="title">
          {game.stage === 'prebattle' ? 'Pre-battle' : game.stage === 'ended' ? 'Battle over' : `Round ${game.round}/${MAX_ROUNDS} · ${active.name}’s turn`}
          <div className="sub">{game.name}</div>
        </div>
      </div>
      <div className="page" style={{ paddingBottom: 0 }}>
        <div className="scoreboard">
          {game.players.map((p, i) => (
            <div key={i} className={`player-box ${game.stage === 'battle' && game.activePlayer === i ? 'active' : ''}`}>
              <div className="spread">
                <b className="ellipsis">{p.name}</b>
                <button className="small ghost gold" style={{ fontSize: '1.1rem', fontWeight: 800, padding: '0 4px' }} onClick={() => setScoring(true)} aria-label={`Edit score for ${p.name}`}>
                  {vp(p)} VP ✎
                </button>
              </div>
              <div className="small">
                <Counter label="CP" value={p.cp} onChange={(v) => update((g) => (g.players[i].cp = v))} />
              </div>
            </div>
          ))}
        </div>

        {game.stage === 'battle' && (
          <div className="phase-bar">
            {TURN.map((p, i) => (
              <button key={p.id} className={i === game.phase ? 'active' : i < game.phase ? 'done' : ''} onClick={() => set(jumpTo(game, i))}>
                {p.short}
              </button>
            ))}
          </div>
        )}

        <div className="tabs" style={{ margin: '10px 0' }}>
          {(['step', 'armies', 'log', 'glossary'] as const).map((t) => (
            <button key={t} className={panel === t ? 'active' : ''} onClick={() => setPanel(t)}>
              {t === 'step' ? 'Current step' : t === 'armies' ? 'Armies' : t === 'log' ? 'Log' : 'Glossary'}
            </button>
          ))}
        </div>

        {panel === 'step' && game.stage === 'ended' && (
          <div className="card">
            <h2>The battle is over</h2>
            {game.players.map((p, i) => (
              <p key={i}>
                <b>{p.name}</b>: {vp(p)} VP ({p.vpPrimary} primary, {p.vpSecondary} secondary)
              </p>
            ))}
            <h3 className="gold">
              {vp(game.players[0]) === vp(game.players[1]) ? 'Draw!' : `${vp(game.players[0]) > vp(game.players[1]) ? game.players[0].name : game.players[1].name} wins!`}
            </h3>
          </div>
        )}

        {panel === 'step' && step && game.stage !== 'ended' && (
          <div className="card step-card">
            <div className="tiny muted">
              {game.stage === 'prebattle' ? `Pre-battle step ${game.preStep + 1} of ${PRE_BATTLE.length}` : `${phase?.name} · step ${game.step + 1} of ${phase?.steps.length} · ${active.name} is the active player`}
            </div>
            <h2>{step.title}</h2>
            <ul className="summary-list">
              {step.summary.map((s, i) => (
                <li key={i} style={s.startsWith('•') ? { listStyle: 'none', marginLeft: -4 } : undefined}>
                  <Rich text={s} />
                </li>
              ))}
            </ul>
            {!!step.dice?.length && (
              <div className="row" style={{ marginBottom: 10 }}>
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
            {step.helper && (
              <div style={{ margin: '10px 0' }}>
                <StepHelper helper={step.helper} game={game} update={update} openAttack={(side, u, kind) => setAttack({ side, uid: u, kind })} />
              </div>
            )}
            {!!step.watchFor?.length && (
              <div className="watch" style={{ marginTop: 10 }}>
                <b>Watch for:</b>
                <ul className="summary-list" style={{ margin: '4px 0 0' }}>
                  {step.watchFor.map((w) => (
                    <li key={w}>
                      <Rich text={w} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {!!abilities.length && (
              <details style={{ marginTop: 10 }}>
                <summary className="small">
                  <b>Abilities that may apply</b> <span className="muted">({abilities.length})</span>
                </summary>
                {abilities.map((a, i) => (
                  <div key={i} style={{ margin: '6px 0' }}>
                    <div className="small">
                      <b>{a.name}</b> <span className="muted">· {unitLabel(a.unit)} ({a.player.name})</span>
                    </div>
                    <div className="rule-text muted small">
                      <Rich text={a.text} />
                    </div>
                  </div>
                ))}
              </details>
            )}
          </div>
        )}

        {panel === 'armies' && <ArmyPanel game={game} update={update} />}

        {panel === 'log' && (
          <div className="card log">
            {!game.log.length && <p className="muted">Nothing has happened yet.</p>}
            {game.log.map((l, i) => (
              <div key={i}>
                <span className="muted">
                  R{l.round} · {game.players[l.player]?.name}:
                </span>{' '}
                {l.text}
              </div>
            ))}
          </div>
        )}

        {panel === 'glossary' && (
          <div className="card">
            {GLOSSARY.map((g) => (
              <p key={g.term} className="small">
                <b>{g.term}:</b> {g.text}
              </p>
            ))}
            <p className="banner">
              {RULES_EDITION} reference. {DISCLAIMER}
            </p>
          </div>
        )}

        <div className="step-nav">
          <button onClick={() => set(prevStep(game))} disabled={game.stage === 'prebattle' && game.preStep === 0} style={{ flex: '0 0 auto' }}>
            ← Back
          </button>
          <button className="primary" onClick={() => set(nextStep(game))} disabled={game.stage === 'ended'}>
            {nextLabel} →
          </button>
        </div>
      </div>
      {scoring && (
        <Modal onClose={() => setScoring(false)} title="Victory points">
          {game.players.map((p, i) => (
            <div key={i} className="card">
              <div className="spread">
                <b>{p.name}</b>
                <b className="gold">{vp(p)} VP</b>
              </div>
              <div className="row" style={{ marginTop: 8, gap: 16 }}>
                <Counter label="Primary" value={p.vpPrimary} onChange={(v) => update((g) => (g.players[i].vpPrimary = v))} />
                <Counter label="Secondary" value={p.vpSecondary} onChange={(v) => update((g) => (g.players[i].vpSecondary = v))} />
              </div>
            </div>
          ))}
        </Modal>
      )}
      {attack && (
        <AttackHelper
          game={game}
          attackerSide={attack.side}
          attackerUid={attack.uid}
          kind={attack.kind}
          onClose={() => setAttack(null)}
          onApply={(g) => set(g)}
        />
      )}
    </>
  );
}
