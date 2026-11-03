import { useState } from 'react';
import { Modal, DiceFaces } from './common';
import { rollDice, rollDie } from '../play/dice';
import type { DieResult } from '../play/attack';

interface Roll {
  label: string;
  dice: DieResult[];
  total: number;
  successes?: number;
}

type RerollMode = 'none' | 'ones' | 'fails';

/** Global dice roller (floating button). Other components can open it with a preset via `openDice`. */
let externalOpen: ((preset: { count?: number; sides?: number; target?: number; label?: string }) => void) | null = null;
export function openDice(preset: { count?: number; sides?: number; target?: number; label?: string }) {
  externalOpen?.(preset);
}

export default function DiceTray() {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(1);
  const [sides, setSides] = useState(6);
  const [target, setTarget] = useState<number | ''>('');
  const [reroll, setReroll] = useState<RerollMode>('none');
  const [label, setLabel] = useState('');
  const [history, setHistory] = useState<Roll[]>([]);

  externalOpen = (p) => {
    setCount(p.count ?? 1);
    setSides(p.sides ?? 6);
    setTarget(p.target ?? '');
    setLabel(p.label ?? '');
    setOpen(true);
  };

  const roll = () => {
    const t = target === '' ? undefined : target;
    const judge = (v: number): DieResult['outcome'] => (t === undefined ? 'success' : v >= t && v !== 1 ? (v === 6 && sides === 6 ? 'crit' : 'success') : 'fail');
    const dice: DieResult[] = rollDice(count, sides).map((v) => {
      let r: DieResult = { value: v, outcome: judge(v) };
      if (t !== undefined && ((reroll === 'ones' && v === 1) || (reroll === 'fails' && r.outcome === 'fail'))) {
        const v2 = rollDie(sides);
        r = { value: v2, outcome: judge(v2), rerolledFrom: v };
      }
      return r;
    });
    const total = dice.reduce((s, d) => s + d.value, 0);
    const successes = t === undefined ? undefined : dice.filter((d) => d.outcome !== 'fail').length;
    const display = t === undefined ? dice.map((d) => ({ ...d, outcome: 'success' as const })) : dice;
    setHistory((h) => [{ label: label || `${count}D${sides}${t ? ` (${t}+)` : ''}`, dice: display, total, successes }, ...h].slice(0, 12));
  };

  const quick = (c: number, s: number) => {
    setCount(c);
    setSides(s);
  };

  return (
    <>
      <button className="fab" onClick={() => setOpen(true)} aria-label="Dice roller">
        🎲
      </button>
      {open && (
        <Modal onClose={() => setOpen(false)} title="Dice roller">
          <div className="row" style={{ marginBottom: 10 }}>
            <button className="small" onClick={() => quick(1, 6)}>
              D6
            </button>
            <button className="small" onClick={() => quick(2, 6)}>
              2D6
            </button>
            <button className="small" onClick={() => quick(1, 3)}>
              D3
            </button>
            <button className="small" onClick={() => quick(10, 6)}>
              10D6
            </button>
            <button className="small" onClick={() => quick(20, 6)}>
              20D6
            </button>
          </div>
          <div className="row">
            <label className="field">
              <span>Dice</span>
              <input type="number" min={1} max={200} value={count} onChange={(e) => setCount(Math.max(1, Math.min(200, Number(e.target.value) || 1)))} style={{ width: 80 }} />
            </label>
            <label className="field">
              <span>Sides</span>
              <select value={sides} onChange={(e) => setSides(Number(e.target.value))}>
                <option value={6}>D6</option>
                <option value={3}>D3</option>
              </select>
            </label>
            <label className="field">
              <span>Succeed on</span>
              <select value={target} onChange={(e) => setTarget(e.target.value === '' ? '' : Number(e.target.value))}>
                <option value="">— (sum)</option>
                {[2, 3, 4, 5, 6].map((t) => (
                  <option key={t} value={t}>
                    {t}+
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Re-roll</span>
              <select value={reroll} onChange={(e) => setReroll(e.target.value as RerollMode)} disabled={target === ''}>
                <option value="none">None</option>
                <option value="ones">1s</option>
                <option value="fails">Failures</option>
              </select>
            </label>
          </div>
          <button className="primary" style={{ width: '100%' }} onClick={roll}>
            Roll {count}D{sides}
            {target !== '' ? ` needing ${target}+` : ''}
          </button>
          <div style={{ marginTop: 12 }}>
            {history.map((h, i) => (
              <div key={i} className="stage" style={{ opacity: i ? 0.7 : 1 }}>
                <div className="spread small">
                  <b>{h.label}</b>
                  <span>{h.successes !== undefined ? <b className="green">{h.successes} success{h.successes === 1 ? '' : 'es'}</b> : <b>Total {h.total}</b>}</span>
                </div>
                <DiceFaces dice={h.dice} />
              </div>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}
