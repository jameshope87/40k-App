import { Fragment, type ReactNode, useEffect } from 'react';
import type { DieResult } from '../play/attack';

export function Loading({ text }: { text?: string }) {
  return (
    <div className="row muted" style={{ padding: 24, justifyContent: 'center' }}>
      <span className="spinner" /> {text || 'Loading…'}
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="card issues">
      <b className="red">Something went wrong</b>
      <p className="small">{error}</p>
      <p className="small muted">
        If you are offline, data you have opened before is still available. Otherwise check your connection, or load catalogue files manually under
        Data sources.
      </p>
      {onRetry && <button onClick={onRetry}>Retry</button>}
    </div>
  );
}

/** Render text with **bold** markers (used by BSData rules text and our summaries). */
export function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\^\^[^^]+\^\^)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('**') || p.startsWith('^^') ? <b key={i}>{p.slice(2, -2)}</b> : <Fragment key={i}>{p.replace(/\*([^*]+)\*/g, '$1')}</Fragment>,
      )}
    </>
  );
}

export function Modal({ onClose, children, title }: { onClose: () => void; children: ReactNode; title?: ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="sheet-modal" onClick={onClose}>
      <div className="panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="spread" style={{ marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <button className="icon ghost" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Stepper({ value, max = -1, onChange }: { value: number; max?: number; onChange: (v: number) => void }) {
  return (
    <span className="stepper">
      <button onClick={() => onChange(value - 1)} disabled={value <= 0} aria-label="Fewer">
        −
      </button>
      <span>{value}</span>
      <button onClick={() => onChange(value + 1)} disabled={max >= 0 && value >= max} aria-label="More">
        +
      </button>
    </span>
  );
}

export function Counter({ value, onChange, label, compact }: { value: number; onChange: (v: number) => void; label?: string; compact?: boolean }) {
  if (compact)
    return (
      <span className="counter">
        <span className="muted tiny">{label}</span>
        <div>
          <button className="small" onClick={() => onChange(Math.max(0, value - 1))} aria-label={`Decrease ${label ?? ''}`}>
            −
          </button>
          <b>{value}</b>
          <button className="small" onClick={() => onChange(value + 1)} aria-label={`Increase ${label ?? ''}`}>
            +
          </button>
        </div>
      </span>
    );
  return (
    <span className="counter">
      {label && <span className="muted small">{label}</span>}
      <button className="small" onClick={() => onChange(Math.max(0, value - 1))} aria-label={`Decrease ${label ?? ''}`}>
        −
      </button>
      <b>{value}</b>
      <button className="small" onClick={() => onChange(value + 1)} aria-label={`Increase ${label ?? ''}`}>
        +
      </button>
    </span>
  );
}

export function DiceFaces({ dice }: { dice: (number | DieResult)[] }) {
  if (!dice.length) return null;
  return (
    <div className="dice-row">
      {dice.map((d, i) => {
        const r = typeof d === 'number' ? { value: d, outcome: undefined } : d;
        return (
          <span key={i} className={`die ${r.outcome ?? ''}`} title={'rerolledFrom' in r && r.rerolledFrom ? `Re-rolled from ${r.rerolledFrom}` : undefined}>
            {r.value}
            {'rerolledFrom' in r && r.rerolledFrom ? <span className="rr">RR</span> : null}
          </span>
        );
      })}
    </div>
  );
}

export function timeAgo(t: number) {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(t).toLocaleDateString();
}
