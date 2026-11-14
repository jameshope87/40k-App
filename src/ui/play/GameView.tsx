import { useState } from 'react';
import { gamesStore, saveGame, useStore } from '../../store';
import { navigate } from '../../router';
import { BATTLE_READY_VP, type GameState, currentStep, jumpTo, nextStep, normalisePreStep, prevStep, styleOf, vp } from '../../play/game';
import { DISCLAIMER, GLOSSARY, MAX_ROUNDS, PLAY_STYLES, PRE_BATTLE, RULES_EDITION, TURN } from '../../play/rules';
import { Counter, Modal, Rich } from '../common';
import StepHelper from './StepHelpers';
import StepGuide from './StepGuide';
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
    if (game.stage === 'prebattle') {
      const n = nextStep(game);
      return n.stage === 'prebattle' ? `Next: ${PRE_BATTLE[n.preStep].title}` : 'Begin battle round 1';
    }
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

        <div className="row small" style={{ margin: '8px 0 0', gap: 6 }}>
          <span className="segmented" role="group" aria-label="Play style">
            {(['casual', 'matched'] as const).map((st) => (
              <button
                key={st}
                className={styleOf(game) === st ? 'active' : ''}
                onClick={() =>
                  update((g) => {
                    g.style = st;
                    normalisePreStep(g);
                  })
                }
              >
                {st === 'casual' ? 'Casual' : 'Matched / event'}
              </button>
            ))}
          </span>
          <span className="segmented" role="group" aria-label="Guidance">
            {(['full', 'compact'] as const).map((gd) => (
              <button key={gd} className={(game.guidance ?? 'full') === gd ? 'active' : ''} onClick={() => update((g) => (g.guidance = gd))}>
                {gd === 'full' ? 'Full guide' : 'Compact'}
              </button>
            ))}
          </span>
        </div>

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
          <StepGuide
            game={game}
            phase={phase}
            step={step}
            update={update}
            helper={step.helper ? <StepHelper helper={step.helper} game={game} update={update} openAttack={(side, u, kind) => setAttack({ side, uid: u, kind })} /> : undefined}
            abilities={
              abilities.length ? (
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
              ) : undefined
            }
          />
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
          <div className="grid2" style={{ marginBottom: 10 }}>
            {PLAY_STYLES.map((ps) => (
              <div key={ps.style} className={`card ${styleOf(game) === ps.style ? 'issues-ok' : ''}`}>
                <h3>
                  {ps.title} {styleOf(game) === ps.style && <span className="pill gold">this game</span>}
                </h3>
                <p className="small muted">{ps.blurb}</p>
                <ul className="summary-list small">
                  {ps.points.map((pt) => (
                    <li key={pt}>
                      <Rich text={pt} />
                    </li>
                  ))}
                </ul>
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
              <label className="opt small" style={{ marginTop: 6 }}>
                <input type="checkbox" checked={!!p.battleReady} onChange={(e) => update((g) => (g.players[i].battleReady = e.target.checked))} />
                <span className="name">Battle Ready army (+{BATTLE_READY_VP}VP)</span>
              </label>
              {styleOf(game) === 'matched' && (
                <p className={`tiny ${p.vpPrimary > 45 || p.vpSecondary > 45 ? 'red' : 'muted'}`} style={{ margin: 0 }}>
                  Matched play limits: primary {p.vpPrimary}/45, secondary {p.vpSecondary}/45 (max 15 of each per battle round).
                </p>
              )}
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
