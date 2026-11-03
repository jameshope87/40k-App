import { useMemo, useState } from 'react';
import { DiceFaces, Modal, Rich } from '../common';
import {
  type AttackCountStage,
  type AttackOptions,
  type DamageStage,
  type HitStage,
  type Reroll,
  type SaveStage,
  type TargetProfile,
  type WoundStage,
  averageDamage,
  defaultOptions,
  describeAttacks,
  estimate,
  parseAbilities,
  planAttack,
  rollAttackCount,
  rollDamage,
  rollHits,
  rollSaves,
  rollWounds,
  woundTarget,
} from '../../play/attack';
import { parseNum, parseTarget } from '../../play/dice';
import type { GameState, UnitState } from '../../play/game';
import { applyDamage, log } from '../../play/game';
import type { WeaponProfile } from '../../roster/summary';
import { parseFnp, unitLabel } from './abilities';

interface Props {
  game: GameState;
  attackerSide: 0 | 1;
  attackerUid: string;
  kind: 'ranged' | 'melee';
  onClose: () => void;
  onApply: (next: GameState) => void;
}

function targetFromUnit(u: UnitState): TargetProfile {
  const s = u.sheet.stats[0];
  return {
    name: unitLabel(u),
    toughness: parseNum(s?.T ?? '4'),
    save: parseTarget(s?.Sv) ?? 7,
    invuln: parseTarget(s?.InSv),
    wounds: u.woundsPerModel,
    models: u.modelsRemaining,
    woundsLostOnCurrent: u.woundsLost,
    feelNoPain: parseFnp(u),
    keywords: [...u.sheet.keywords, ...u.sheet.factionKeywords],
  };
}

const CUSTOM: TargetProfile = { name: 'Custom target', toughness: 4, save: 3, wounds: 2, models: 5, keywords: ['Infantry'] };

function NumField({ label, value, onChange, suffix }: { label: string; value: number | undefined; onChange: (v: number | undefined) => void; suffix?: string }) {
  return (
    <label className="field" style={{ width: 84 }}>
      <span>{label}</span>
      <input
        type="number"
        value={value ?? ''}
        placeholder="–"
        onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
        aria-label={`${label}${suffix ?? ''}`}
      />
    </label>
  );
}

function ModSelect({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(Number(e.target.value))}>
        <option value={-1}>−1</option>
        <option value={0}>0</option>
        <option value={1}>+1</option>
      </select>
    </label>
  );
}

function RerollSelect({ label, value, onChange }: { label: string; value: Reroll; onChange: (v: Reroll) => void }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as Reroll)}>
        <option value="none">No re-roll</option>
        <option value="ones">Re-roll 1s</option>
        <option value="fails">Re-roll fails</option>
      </select>
    </label>
  );
}

export default function AttackHelper({ game, attackerSide, attackerUid, kind, onClose, onApply }: Props) {
  const attackerPlayer = game.players[attackerSide];
  const defenderSide = attackerSide === 0 ? 1 : 0;
  const defender = game.players[defenderSide];
  const attacker = attackerPlayer.units.find((u) => u.uid === attackerUid)!;
  const weapons = attacker.sheet.weapons.filter((w) => w.kind === kind);
  const advanced = attacker.moved === 'advance';

  const [wIdx, setWIdx] = useState(() => Math.max(0, weapons.findIndex((w) => !advanced || parseAbilities(w.keywords).torrent || w.keywords.some((k) => /assault/i.test(k)))));
  const weapon: WeaponProfile | undefined = weapons[wIdx];
  const scaled = (w?: WeaponProfile) => (w ? Math.max(1, Math.round((w.count * attacker.modelsRemaining) / Math.max(1, attacker.startingModels))) : 1);
  const [targetUid, setTargetUid] = useState<string>(() => defender.units.find((u) => u.modelsRemaining > 0)?.uid ?? 'custom');
  const [custom, setCustom] = useState<TargetProfile>(CUSTOM);
  const [opts, setOpts] = useState<AttackOptions>(() => ({
    ...defaultOptions(scaled(weapons[0])),
    charged: attacker.charged,
    remainedStationary: attacker.moved === 'stationary',
  }));
  const [stages, setStages] = useState<{ a?: AttackCountStage; h?: HitStage; w?: WoundStage; s?: SaveStage; d?: DamageStage }>({});
  const [applied, setApplied] = useState(false);

  const targetUnit = defender.units.find((u) => u.uid === targetUid);
  const target: TargetProfile = useMemo(() => (targetUnit ? targetFromUnit(targetUnit) : custom), [targetUnit, custom]);
  const plan = useMemo(() => (weapon ? planAttack(weapon, target, opts) : undefined), [weapon, target, opts]);
  const est = useMemo(() => (plan ? estimate(plan, target, opts, 1500) : undefined), [plan, target, opts]);

  const set = (patch: Partial<AttackOptions>) => {
    setOpts({ ...opts, ...patch });
    setStages({});
    setApplied(false);
  };

  if (!weapons.length) {
    return (
      <Modal onClose={onClose} title="Attack">
        <p>
          {unitLabel(attacker)} has no {kind} weapons in its datasheet.
        </p>
      </Modal>
    );
  }

  const next = () => {
    if (!plan) return;
    if (!stages.a) return setStages({ a: rollAttackCount(plan, opts) });
    if (!stages.h) return setStages({ ...stages, h: rollHits(plan, stages.a.attacks, opts) });
    if (!stages.w) return setStages({ ...stages, w: rollWounds(plan, stages.h, opts) });
    if (!stages.s) return setStages({ ...stages, s: rollSaves(plan, stages.w) });
    if (!stages.d) return setStages({ ...stages, d: rollDamage(plan, stages.s, stages.w, target) });
  };
  const rollAll = () => {
    if (!plan) return;
    const a = rollAttackCount(plan, opts);
    const h = rollHits(plan, a.attacks, opts);
    const w = rollWounds(plan, h, opts);
    const s = rollSaves(plan, w);
    const d = rollDamage(plan, s, w, target);
    setStages({ a, h, w, s, d });
  };

  const apply = () => {
    if (!stages.d || !weapon) return;
    const g = structuredClone(game);
    const atk = g.players[attackerSide].units.find((u) => u.uid === attackerUid)!;
    if (kind === 'ranged') atk.shot = true;
    else atk.fought = true;
    let msg = `${unitLabel(attacker)} attacked ${target.name} with ${weapon.name}: ${stages.d.damageDealt} damage`;
    if (targetUnit) {
      const tu = g.players[defenderSide].units.find((u) => u.uid === targetUnit.uid)!;
      applyDamage(tu, stages.d.modelsDestroyed, stages.d.woundsLostOnCurrent);
      msg += `, ${stages.d.modelsDestroyed} model(s) destroyed${tu.modelsRemaining <= 0 ? ' — unit destroyed!' : ''}`;
    }
    log(g, msg + '.', attackerSide);
    onApply(g);
    setApplied(true);
  };

  const stageNames = ['Attacks', 'Hit rolls', 'Wound rolls', 'Saving throws', 'Damage'];
  const done = [stages.a, stages.h, stages.w, stages.s, stages.d].filter(Boolean).length;
  const ab = weapon ? parseAbilities(weapon.keywords) : undefined;
  const wt = weapon ? woundTarget(parseNum(weapon.strength), target.toughness) : 4;

  return (
    <Modal onClose={onClose} title={`${kind === 'ranged' ? 'Shoot' : 'Fight'}: ${unitLabel(attacker)}`}>
      {advanced && kind === 'ranged' && <p className="small gold">This unit Advanced: only [ASSAULT] weapons can shoot (assault shooting).</p>}
      {attacker.moved === 'fallback' && <p className="small red">This unit Fell Back this turn and normally cannot shoot or charge.</p>}

      <label className="field">
        <span>Weapon</span>
        <select
          value={wIdx}
          onChange={(e) => {
            const i = Number(e.target.value);
            setWIdx(i);
            set({ attackers: scaled(weapons[i]) });
          }}
        >
          {weapons.map((w, i) => (
            <option key={w.name} value={i}>
              {w.count}× {w.name} — A{w.attacks} {w.skill} S{w.strength} AP{w.ap} D{w.damage}
              {w.keywords.length ? ` [${w.keywords.join(', ')}]` : ''}
            </option>
          ))}
        </select>
      </label>

      <div className="row">
        <NumField label="Models" value={opts.attackers} onChange={(v) => set({ attackers: Math.max(0, v ?? 0) })} />
        <label className="field grow">
          <span>Target</span>
          <select value={targetUid} onChange={(e) => (setTargetUid(e.target.value), setStages({}), setApplied(false))}>
            {defender.units
              .filter((u) => u.modelsRemaining > 0)
              .map((u) => (
                <option key={u.uid} value={u.uid}>
                  {unitLabel(u)} ({u.modelsRemaining} models, T{u.sheet.stats[0]?.T} Sv{u.sheet.stats[0]?.Sv})
                </option>
              ))}
            <option value="custom">Custom target…</option>
          </select>
        </label>
      </div>

      {!targetUnit && (
        <div className="row">
          <NumField label="T" value={custom.toughness} onChange={(v) => setCustom({ ...custom, toughness: v ?? 4 })} />
          <NumField label="Sv (+)" value={custom.save} onChange={(v) => setCustom({ ...custom, save: v ?? 7 })} />
          <NumField label="Inv (+)" value={custom.invuln} onChange={(v) => setCustom({ ...custom, invuln: v })} />
          <NumField label="W" value={custom.wounds} onChange={(v) => setCustom({ ...custom, wounds: v ?? 1 })} />
          <NumField label="Models" value={custom.models} onChange={(v) => setCustom({ ...custom, models: v ?? 1 })} />
          <NumField label="FNP (+)" value={custom.feelNoPain} onChange={(v) => setCustom({ ...custom, feelNoPain: v })} />
          <label className="field grow">
            <span>Keywords</span>
            <input value={custom.keywords.join(', ')} onChange={(e) => setCustom({ ...custom, keywords: e.target.value.split(',').map((s) => s.trim()) })} />
          </label>
        </div>
      )}

      <details>
        <summary className="small">Situation and modifiers</summary>
        <div className="row small" style={{ margin: '6px 0' }}>
          {kind === 'ranged' && (
            <>
              <label className="row nowrap">
                <input type="checkbox" checked={opts.halfRange} onChange={(e) => set({ halfRange: e.target.checked })} /> Half range
              </label>
              <label className="row nowrap">
                <input type="checkbox" checked={opts.remainedStationary} onChange={(e) => set({ remainedStationary: e.target.checked })} /> Remained stationary
              </label>
              <label className="row nowrap">
                <input type="checkbox" checked={opts.targetInCover} onChange={(e) => set({ targetInCover: e.target.checked })} /> Target in cover
              </label>
            </>
          )}
          <label className="row nowrap">
            <input type="checkbox" checked={opts.charged} onChange={(e) => set({ charged: e.target.checked })} /> Charged this turn
          </label>
        </div>
        <div className="row">
          <ModSelect label="Hit mod" value={opts.hitMod} onChange={(v) => set({ hitMod: v })} />
          <ModSelect label="Wound mod" value={opts.woundMod} onChange={(v) => set({ woundMod: v })} />
          <ModSelect label="Save mod" value={opts.saveMod} onChange={(v) => set({ saveMod: v })} />
          <RerollSelect label="Hits" value={opts.rerollHits} onChange={(v) => set({ rerollHits: v })} />
          <RerollSelect label="Wounds" value={opts.rerollWounds} onChange={(v) => set({ rerollWounds: v })} />
        </div>
      </details>

      {plan && weapon && (
        <div className="card" style={{ marginTop: 10 }}>
          <dl className="kv">
            <dt>Attacks</dt>
            <dd>{describeAttacks(plan, opts)}</dd>
            <dt>Hit</dt>
            <dd>{plan.autoHit ? 'Automatic (Torrent)' : `${plan.hitOn > 6 ? 'only on 6s' : `${plan.hitOn}+`} · critical on 6`}</dd>
            <dt>Wound</dt>
            <dd>
              {plan.woundOn}+ (S{weapon.strength} vs T{target.toughness}: base {wt}+){plan.critWoundOn < 6 ? ` · critical on ${plan.critWoundOn}+` : ''}
            </dd>
            <dt>Save</dt>
            <dd>{plan.saveOn > 6 ? 'No save possible' : `${plan.saveOn}+ ${plan.saveIsInvuln ? '(invulnerable)' : `(Sv ${target.save}+, AP ${weapon.ap})`}`}</dd>
            <dt>Damage</dt>
            <dd>
              {plan.damageExpr}
              {plan.meltaExpr ? ` + ${plan.meltaExpr} (Melta)` : ''}
              {plan.damageBonus ? ` + ${plan.damageBonus}` : ''} per failed save (avg {averageDamage(plan).toFixed(1)}){plan.fnp ? ` · FNP ${plan.fnp}+` : ''}
            </dd>
          </dl>
          {!!plan.notes.length && (
            <ul className="small muted summary-list">
              {plan.notes.map((n) => (
                <li key={n}>
                  <Rich text={n} />
                </li>
              ))}
            </ul>
          )}
          {est && (
            <p className="small" style={{ marginBottom: 0 }}>
              <b>Expected:</b> {est.hits.toFixed(1)} hits → {est.wounds.toFixed(1)} wounds → {est.unsaved.toFixed(1)} unsaved → <b>{est.damage.toFixed(1)} damage</b>, ~
              {est.modelsDestroyed.toFixed(1)} models destroyed ({Math.round(est.wipeChance * 100)}% to destroy the unit)
            </p>
          )}
          {ab?.hazardous && <p className="small gold">Remember: hazard rolls for [HAZARDOUS] after this unit has attacked.</p>}
        </div>
      )}

      <h3 style={{ marginTop: 14 }}>Roll it step by step</h3>
      <div>
        {stageNames.map((name, i) => {
          const visible = i <= done;
          if (!visible) return null;
          return (
            <div key={name} className={`stage ${i === done ? 'current' : ''}`}>
              <div className="spread small">
                <b>
                  {i + 1}. {name}
                </b>
                <span className="muted">{stageHint(i, plan, opts, target)}</span>
              </div>
              {i === 0 && stages.a && (
                <>
                  <DiceFaces dice={stages.a.rolls} />
                  <div className="small">
                    <b>{stages.a.attacks}</b> attacks
                  </div>
                </>
              )}
              {i === 1 && stages.h && (
                <>
                  <DiceFaces dice={stages.h.dice} />
                  <div className="small">
                    <b>{stages.h.hits + stages.h.autoWounds}</b> hits
                    {stages.h.crits ? ` (${stages.h.crits} critical)` : ''}
                    {stages.h.sustainedExtra ? ` incl. ${stages.h.sustainedExtra} from Sustained Hits` : ''}
                    {stages.h.autoWounds ? ` · ${stages.h.autoWounds} auto-wound (Lethal Hits)` : ''}
                  </div>
                </>
              )}
              {i === 2 && stages.w && (
                <>
                  <DiceFaces dice={stages.w.dice} />
                  <div className="small">
                    <b>{stages.w.wounds}</b> wounds{stages.w.mortal ? ` + ${stages.w.mortal} Devastating Wounds (mortal)` : ''}
                  </div>
                </>
              )}
              {i === 3 && stages.s && (
                <>
                  <p className="tiny muted" style={{ margin: 0 }}>
                    Defender rolls. Green = saved.
                  </p>
                  <DiceFaces dice={stages.s.dice} />
                  <div className="small">
                    <b>{stages.s.unsaved}</b> failed saves
                  </div>
                </>
              )}
              {i === 4 && stages.d && (
                <>
                  <DiceFaces dice={stages.d.perAttack} />
                  {!!stages.d.fnpDice.length && (
                    <>
                      <span className="tiny muted">Feel No Pain:</span>
                      <DiceFaces dice={stages.d.fnpDice} />
                    </>
                  )}
                  <div className="small">
                    <b>{stages.d.damageDealt}</b> damage dealt, <b>{stages.d.modelsDestroyed}</b> model(s) destroyed
                    {stages.d.wasted ? ` (${stages.d.wasted} damage lost to overkill)` : ''}
                  </div>
                </>
              )}
              {i === done && done < 5 && (
                <button className="primary small" onClick={next} style={{ marginTop: 6 }}>
                  Roll {name.toLowerCase()}
                </button>
              )}
            </div>
          );
        })}
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <button onClick={rollAll}>Roll everything at once</button>
        <button onClick={() => (setStages({}), setApplied(false))}>Reset</button>
        {stages.d && (
          <button className="primary" onClick={apply} disabled={applied}>
            {applied ? '✓ Applied' : targetUnit ? `Apply to ${target.name}` : 'Log result'}
          </button>
        )}
      </div>
    </Modal>
  );
}

function stageHint(i: number, plan: ReturnType<typeof planAttack> | undefined, o: AttackOptions, t: TargetProfile) {
  if (!plan) return '';
  switch (i) {
    case 0:
      return describeAttacks(plan, o);
    case 1:
      return plan.autoHit ? 'auto-hit' : `need ${plan.hitOn}+${o.rerollHits !== 'none' ? `, re-roll ${o.rerollHits}` : ''}`;
    case 2:
      return `need ${plan.woundOn}+${plan.abilities.twinLinked ? ', twin-linked' : o.rerollWounds !== 'none' ? `, re-roll ${o.rerollWounds}` : ''}`;
    case 3:
      return plan.saveOn > 6 ? 'no save' : `save on ${plan.saveOn}+`;
    case 4:
      return `damage ${plan.damageExpr}${plan.fnp ? `, FNP ${plan.fnp}+` : ''} vs W${t.wounds}`;
  }
  return '';
}
