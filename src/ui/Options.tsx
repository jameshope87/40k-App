import type { Evaluator, RSel } from '../bsdata/engine';
import { type Node, groupEntries } from '../bsdata/index';
import { Stepper } from './common';

export interface OptionHandlers {
  setCount: (parentUid: string, node: Node, count: number) => void;
  choose: (parentUid: string, group: Node, node: Node | null) => void;
  /** Set the count of one particular selection (a model loadout). */
  setSelectionCount: (selUid: string, count: number) => void;
  /** Split one model off a loadout so it can have different wargear. */
  split: (selUid: string) => void;
  /** Merge a loadout into an identical one. */
  merge: (fromUid: string, intoUid: string) => void;
}

/** Signature of a selection's wargear, used to spot identical loadouts. */
function signature(r: RSel): string {
  return r.children
    .map((c) => `${c.node.key}x${c.sel.count}(${signature(c)})`)
    .sort()
    .join(',');
}

/** Short description of a loadout's chosen wargear, e.g. "Plasma pistol, Eviscerator". */
function loadoutSummary(ev: Evaluator, r: RSel): string {
  const names: string[] = [];
  const walk = (x: RSel) => {
    for (const c of x.children) {
      names.push(ev.nameOf(c.node, c));
      walk(c);
    }
  };
  walk(r);
  return names.join(', ');
}

/** Whether a group (recursively) contains anything that can be selected. */
function groupHasOptions(ev: Evaluator, group: Node, owner: RSel): boolean {
  if (!ev.isAvailable(group, owner)) return false;
  return group.children.some((c) => (c.kind === 'group' ? groupHasOptions(ev, c, owner) : ev.isAvailable(c, owner)));
}

function hasVisibleOptions(ev: Evaluator, r: RSel): boolean {
  return r.node.children.some((c) => {
    const sel = r.children.find((x) => x.node === c);
    if (!sel && !ev.isAvailable(c, r)) return false;
    if (c.kind === 'group') return groupHasOptions(ev, c, r) || ev.countOf(c, r, false) > 0;
    const lim = ev.limits(c, sel ?? ev.virtual(c, r));
    return !(lim.min === lim.max && lim.min > 0) || (sel ? hasVisibleOptions(ev, sel) : false);
  });
}

function costLabel(ev: Evaluator, node: Node, self: RSel) {
  const pills = [];
  const c = ev.cost(node, self);
  if (c) pills.push(<span key="pts" className="pill gold">{c > 0 ? '+' : ''}{c} pts</span>);
  for (const ct of ev.index.costTypes) {
    if (ct.id === ev.index.ptsTypeId || /crusade|experience|blackstone/i.test(ct.name) || node.costs[ct.id] === undefined) continue;
    const v = ev.cost(node, self, ct.id);
    if (v && !/^enhancements$/i.test(ct.name)) pills.push(<span key={ct.id} className="pill">{v} {ct.name}</span>);
  }
  return pills.length ? <>{pills}</> : null;
}

function EntryOption({ ev, owner, node, h }: { ev: Evaluator; owner: RSel; node: Node; h: OptionHandlers }) {
  const all = owner.children.filter((c) => c.node === node);
  if (all.length > 1 || (all.length === 1 && all[0].sel.count > 1 && hasVisibleOptions(ev, all[0]))) {
    return <Loadouts ev={ev} node={node} loadouts={all} h={h} />;
  }
  const selected = all[0];
  if (!selected && !ev.isAvailable(node, owner)) return null;
  const self = selected ?? ev.virtual(node, owner);
  const { min, max } = ev.limits(node, self);
  const count = selected?.sel.count ?? 0;
  const name = ev.nameOf(node, self);
  const fixed = min === max && min > 0 && count === min;
  const nested = selected && hasVisibleOptions(ev, selected);

  const control = fixed ? (
    <span className="muted small">{count}×</span>
  ) : max === 1 ? (
    <input type="checkbox" checked={count > 0} onChange={(e) => h.setCount(owner.sel.uid, node, e.target.checked ? 1 : 0)} />
  ) : (
    <Stepper value={count} max={max} onChange={(v) => h.setCount(owner.sel.uid, node, v)} />
  );

  const line = (
    <div className="opt">
      {control}
      <span className="name">
        {name}
        {min > 0 && !fixed && <span className="tiny muted"> (min {min})</span>}
      </span>
      {costLabel(ev, node, self)}
    </div>
  );

  if (!nested) return line;
  return (
    <div>
      {line}
      <details className="nested" open={!fixed || node.type === 'model'}>
        <summary className="tiny muted">Options for {name}</summary>
        <Options ev={ev} owner={selected!} container={selected!.node} h={h} />
      </details>
    </div>
  );
}

/**
 * Several selections of the same model entry ("loadouts"): each has its own
 * model count and wargear, e.g. 4× Marine with chainsword + 1× with eviscerator.
 */
function Loadouts({ ev, node, loadouts, h }: { ev: Evaluator; node: Node; loadouts: RSel[]; h: OptionHandlers }) {
  const first = loadouts[0];
  const { min, max } = ev.limits(node, first);
  const total = loadouts.reduce((s, l) => s + l.sel.count, 0);
  const name = ev.nameOf(node, first);
  const bad = total < min || (max >= 0 && total > max);
  return (
    <div className="loadouts">
      <div className="opt">
        <span className="name">
          <b>{name}</b>{' '}
          <span className={`tiny ${bad ? 'red' : 'muted'}`}>
            {total} model{total === 1 ? '' : 's'}
            {max >= 0 ? ` (${min}–${max})` : min ? ` (min ${min})` : ''}
          </span>
        </span>
        {costLabel(ev, node, first)}
      </div>
      {loadouts.map((l, i) => {
        const twin = loadouts.slice(0, i).find((o) => signature(o) === signature(l));
        return (
          <div key={l.sel.uid} className="loadout">
            <div className="opt">
              <Stepper value={l.sel.count} max={max >= 0 ? l.sel.count + Math.max(0, max - total) : -1} onChange={(v) => h.setSelectionCount(l.sel.uid, v)} />
              <span className="name small">
                {loadouts.length > 1 ? `Group ${i + 1}` : 'All models'}
                <span className="tiny muted ellipsis" style={{ display: 'block' }}>
                  {loadoutSummary(ev, l) || 'No wargear'}
                </span>
              </span>
              {l.sel.count > 1 && (
                <button className="small" onClick={() => h.split(l.sel.uid)} title="Give one model different wargear">
                  Split off 1
                </button>
              )}
              {twin && (
                <button className="small" onClick={() => h.merge(l.sel.uid, twin.sel.uid)} title="Same wargear as an earlier group">
                  Merge
                </button>
              )}
            </div>
            <details className="nested" open>
              <summary className="tiny muted">
                Wargear{l.sel.count > 1 ? ` for these ${l.sel.count} models` : ''}
              </summary>
              <Options ev={ev} owner={l} container={l.node} h={h} />
            </details>
          </div>
        );
      })}
      {loadouts.length === 1 && first.sel.count > 1 && (
        <p className="tiny muted" style={{ margin: '2px 0 6px' }}>
          Options apply to every model in a group. Use <b>Split off 1</b> to give a model different wargear.
        </p>
      )}
    </div>
  );
}

function GroupOption({ ev, owner, group, h }: { ev: Evaluator; owner: RSel; group: Node; h: OptionHandlers }) {
  const self = ev.virtual(group, owner);
  if (!groupHasOptions(ev, group, owner) && !ev.countOf(group, owner, false)) return null;
  const { min, max } = ev.limits(group, self);
  const count = ev.countOf(group, owner, false);
  const members = group.children;
  const simple = max === 1 && members.every((m) => m.kind === 'entry');
  const range = max < 0 ? (min ? `${min}+` : '') : min === max ? `${min}` : `${min}–${max}`;
  const bad = count < min || (max >= 0 && count > max);

  return (
    <div className="opt-group">
      <div className="label">
        {group.name}
        {range && <span className={bad ? 'red' : ''}> · choose {range}</span>}
        {!simple && max !== 1 && <span className="muted"> · selected {count}</span>}
      </div>
      {simple ? (
        <>
          {min === 0 && (
            <label className="opt">
              <input type="radio" checked={count === 0} onChange={() => h.choose(owner.sel.uid, group, null)} />
              <span className="name muted">None</span>
            </label>
          )}
          {groupEntries(group).map((n) => {
            const selected = owner.children.find((c) => c.node === n);
            if (!selected && !ev.isAvailable(n, owner)) return null;
            const s = selected ?? ev.virtual(n, owner);
            return (
              <div key={n.key}>
                <label className="opt">
                  <input type="radio" checked={!!selected} onChange={() => h.choose(owner.sel.uid, group, n)} />
                  <span className="name">{ev.nameOf(n, s)}</span>
                  {costLabel(ev, n, s)}
                </label>
                {selected && hasVisibleOptions(ev, selected) && (
                  <div className="nested">
                    <Options ev={ev} owner={selected} container={selected.node} h={h} />
                  </div>
                )}
              </div>
            );
          })}
        </>
      ) : (
        <Options ev={ev} owner={owner} container={group} h={h} />
      )}
    </div>
  );
}

export default function Options({ ev, owner, container, h }: { ev: Evaluator; owner: RSel; container: Node; h: OptionHandlers }) {
  return (
    <>
      {container.children.map((c) =>
        c.kind === 'group' ? <GroupOption key={c.key} ev={ev} owner={owner} group={c} h={h} /> : <EntryOption key={c.key} ev={ev} owner={owner} node={c} h={h} />,
      )}
    </>
  );
}
