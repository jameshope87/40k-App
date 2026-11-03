import { useMemo, useState } from 'react';
import { rostersStore, saveRoster, deleteRoster, useStore } from '../store';
import { useIndex } from '../useCatalogue';
import { Evaluator, type RSel } from '../bsdata/engine';
import type { GameIndex, Node } from '../bsdata/index';
import { navigate } from '../router';
import { ErrorBox, Loading } from './common';
import Options, { type OptionHandlers } from './Options';
import Datasheet from './Datasheet';
import { describeUnit } from '../roster/summary';
import { addRoot, chooseInGroup, duplicateSelection, removeSelection, renameSelection, rosterToText, setChildCount } from '../roster/ops';
import type { Roster } from '../roster/model';
import { KNOWN_SOURCES } from '../bsdata/loader';

const CATEGORY_ORDER = ['Configuration', 'Epic Hero', 'Character', 'Battleline', 'Dedicated Transport', 'Infantry', 'Mounted', 'Swarm', 'Beast', 'Monster', 'Vehicle', 'Fortification'];

function categoryOf(index: GameIndex, n: Node) {
  return n.primaryCategoryId ? index.categoryName(n.primaryCategoryId) : n.type === 'unit' || n.type === 'model' ? 'Other' : 'Configuration';
}

function sortCategories(names: string[]) {
  return [...new Set(names)].sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a);
    const ib = CATEGORY_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
  });
}

function modelSummary(r: RSel) {
  const models = r.children.filter((c) => c.node.type === 'model');
  if (!models.length) return '';
  const n = models.reduce((s, m) => s + m.sel.count, 0);
  return `${n} model${n === 1 ? '' : 's'}`;
}

function UnitCard({ ev, r, open, onToggle, h, roster, update }: { ev: Evaluator; r: RSel; open: boolean; onToggle: () => void; h: OptionHandlers; roster: Roster; update: (r: Roster) => void }) {
  const pts = ev.totalCost(r);
  const isUnit = r.node.type === 'unit' || r.node.type === 'model';
  const name = ev.nameOf(r.node, r);
  return (
    <div className={`unit-card ${open ? 'open' : ''}`}>
      <div className="head" onClick={onToggle}>
        <div className="grow">
          <div className="ellipsis">
            <b>{r.sel.customName || name}</b>
            {r.sel.customName && <span className="muted small"> · {name}</span>}
          </div>
          <div className="tiny muted ellipsis">
            {isUnit
              ? modelSummary(r)
              : r.children
                  .map((c) => ev.nameOf(c.node, c))
                  .join(', ') || 'Choose an option'}
          </div>
        </div>
        {pts > 0 && <span className="pill gold">{pts} pts</span>}
        <span className="muted">{open ? '▾' : '▸'}</span>
      </div>
      {open && (
        <div className="body">
          <div style={{ paddingTop: 8 }}>
            <Options ev={ev} owner={r} container={r.node} h={h} />
          </div>
          {isUnit && (
            <>
              <div className="row" style={{ margin: '10px 0' }}>
                <button
                  className="small"
                  onClick={() => {
                    const n = prompt('Unit name (leave empty to reset)', r.sel.customName ?? '');
                    if (n !== null) update(renameSelection(roster, r.sel.uid, n));
                  }}
                >
                  Rename
                </button>
                <button className="small" onClick={() => update(duplicateSelection(roster, r.sel.uid).roster)}>
                  Duplicate
                </button>
                <button className="small danger" onClick={() => update(removeSelection(roster, r.sel.uid))}>
                  Remove
                </button>
              </div>
              <Datasheet sheet={describeUnit(ev, r)} compact />
            </>
          )}
          {!isUnit && (
            <div className="row" style={{ marginTop: 8 }}>
              <button className="small danger" onClick={() => update(removeSelection(roster, r.sel.uid))}>
                Remove
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AddUnits({ ev, index, onAdd }: { ev: Evaluator; index: GameIndex; onAdd: (n: Node) => void }) {
  const [q, setQ] = useState('');
  const available = useMemo(() => index.rootNodes.filter((n) => ev.isAvailable(n, null)), [ev, index]);
  const filtered = available.filter((n) => n.name.toLowerCase().includes(q.toLowerCase()));
  const cats = sortCategories(filtered.map((n) => categoryOf(index, n)));
  return (
    <div>
      <input placeholder="Search units…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: '100%' }} />
      {cats.map((cat) => (
        <div key={cat}>
          <div className="section-title">{cat}</div>
          <div className="card" style={{ padding: 0 }}>
            {filtered
              .filter((n) => categoryOf(index, n) === cat)
              .map((n) => {
                const v = ev.virtual(n, null);
                const pts = ev.cost(n, v);
                return (
                  <div key={n.key} className="list-item" onClick={() => onAdd(n)}>
                    <div className="grow ellipsis">{ev.nameOf(n, v)}</div>
                    {pts > 0 && <span className="small muted">{pts}</span>}
                    <span className="gold">＋</span>
                  </div>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function RosterEditor({ uid }: { uid: string }) {
  const rosters = useStore(rostersStore);
  const roster = rosters.find((r) => r.uid === uid);
  const source = roster ? (KNOWN_SOURCES.find((s) => s.repo === roster.source.repo && s.branch === roster.source.branch) ?? { ...roster.source, label: roster.source.repo }) : undefined;
  const { index, error, progress } = useIndex(source, roster?.catalogueFile);
  const [open, setOpen] = useState<string | null>(null);
  const [tab, setTab] = useState<'army' | 'add'>('army');
  const [menu, setMenu] = useState(false);
  const [copied, setCopied] = useState('');

  const ev = useMemo(() => (index && roster ? new Evaluator(index, roster) : undefined), [index, roster]);
  const issues = useMemo(() => ev?.validate() ?? [], [ev]);

  if (!roster) {
    return (
      <div className="page">
        <p>List not found.</p>
        <button onClick={() => navigate('/')}>Back</button>
      </div>
    );
  }

  const update = (r: Roster) => saveRoster(r);
  const h: OptionHandlers = {
    setCount: (parentUid, node, count) => ev && update(setChildCount(ev, roster, parentUid, node, count)),
    choose: (parentUid, group, node) => {
      if (!ev) return;
      if (node) update(chooseInGroup(ev, roster, parentUid, group, node));
      else {
        // "None": clear every selection of the group.
        let next = roster;
        for (const n of group.children) next = setChildCount(new Evaluator(index!, next), next, parentUid, n, 0);
        update(next);
      }
    },
  };

  const points = ev?.rosterCost() ?? 0;
  const limit = ev?.pointsLimit();
  const over = limit !== undefined && points > limit;

  const exportText = async () => {
    if (!ev || !index) return;
    const text = rosterToText(ev, roster, index);
    try {
      await navigator.clipboard.writeText(text);
      setCopied('List copied to clipboard');
    } catch {
      setCopied(text);
    }
    setMenu(false);
  };
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(roster, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${roster.name.replace(/[^\w-]+/g, '_')}.json`;
    a.click();
    setMenu(false);
  };

  const add = (n: Node) => {
    if (!ev) return;
    const res = addRoot(ev, roster, n);
    update(res.roster);
    setOpen(res.uid);
    setTab('army');
  };

  const roots = ev?.roots ?? [];
  const cats = index ? sortCategories(roots.map((r) => categoryOf(index, r.node))) : [];

  return (
    <>
      <div className="topbar">
        <button className="icon ghost" onClick={() => navigate('/')} aria-label="Back">
          ←
        </button>
        <div className="title">
          <span
            onClick={() => {
              const n = prompt('List name', roster.name);
              if (n) update({ ...roster, name: n });
            }}
          >
            {roster.name}
          </span>
          <div className="sub ellipsis">{roster.catalogueName}</div>
        </div>
        <span className={`pill ${over ? 'red' : 'gold'}`} style={{ fontSize: '0.85rem' }}>
          {points}
          {limit ? ` / ${limit}` : ''} pts
        </span>
        <div style={{ position: 'relative' }}>
          <button className="icon" onClick={() => setMenu(!menu)} aria-label="Menu">
            ⋮
          </button>
          {menu && (
            <div className="card" style={{ position: 'absolute', right: 0, top: 44, zIndex: 30, width: 220, display: 'grid', gap: 6, boxShadow: 'var(--shadow)' }}>
              <button onClick={exportText}>Copy as text</button>
              <button onClick={exportJson}>Export file (.json)</button>
              <button onClick={() => navigate(`/play?roster=${roster.uid}`)}>Play a game with this list</button>
              <button
                className="danger"
                onClick={() => {
                  if (confirm('Delete this list?')) {
                    deleteRoster(roster.uid);
                    navigate('/');
                  }
                }}
              >
                Delete list
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="page">
        {error && <ErrorBox error={error} onRetry={() => location.reload()} />}
        {!index && !error && <Loading text={progress} />}
        {copied && (
          <div className="card small" onClick={() => setCopied('')}>
            {copied.includes('\n') ? <pre style={{ whiteSpace: 'pre-wrap' }}>{copied}</pre> : copied} <span className="muted">(tap to dismiss)</span>
          </div>
        )}
        {ev && index && (
          <>
            {!!issues.length && (
              <details className="card issues" style={{ marginBottom: 12 }}>
                <summary>
                  <b className="red">
                    {issues.length} issue{issues.length > 1 ? 's' : ''}
                  </b>{' '}
                  <span className="small muted">with this list</span>
                </summary>
                <ul className="small">
                  {issues.map((i, k) => (
                    <li key={k} onClick={() => i.selUid && setOpen(i.selUid)} className={i.severity === 'warning' ? 'muted' : ''}>
                      {i.message}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <div className="tabs mobile-only" style={{ marginBottom: 12 }}>
              <button className={tab === 'army' ? 'active' : ''} onClick={() => setTab('army')}>
                Army ({roots.filter((r) => r.node.type === 'unit' || r.node.type === 'model').length})
              </button>
              <button className={tab === 'add' ? 'active' : ''} onClick={() => setTab('add')}>
                ＋ Add units
              </button>
            </div>
            <div className="editor">
              <div className={tab === 'add' ? '' : 'desktop-only'}>
                <h3 className="desktop-only">Add units</h3>
                <AddUnits ev={ev} index={index} onAdd={add} />
              </div>
              <div className={tab === 'army' ? '' : 'desktop-only'}>
                {!roots.length && <p className="muted">Your army is empty. Add units to get started.</p>}
                {cats.map((cat) => (
                  <div key={cat}>
                    <div className="section-title">{cat}</div>
                    {roots
                      .filter((r) => categoryOf(index, r.node) === cat)
                      .map((r) => (
                        <UnitCard
                          key={r.sel.uid}
                          ev={ev}
                          r={r}
                          open={open === r.sel.uid}
                          onToggle={() => setOpen(open === r.sel.uid ? null : r.sel.uid)}
                          h={h}
                          roster={roster}
                          update={update}
                        />
                      ))}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
