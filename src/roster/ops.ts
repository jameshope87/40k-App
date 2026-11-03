/** Immutable roster operations used by the editor. */
import type { Evaluator, RSel } from '../bsdata/engine';
import { groupEntries, type Node } from '../bsdata/index';
import { type Roster, type Selection, cloneSelection, findSelection } from './model';
import type { GameIndex } from '../bsdata/index';

export function findRSel(ev: Evaluator, selUid: string): RSel | undefined {
  const walk = (list: RSel[]): RSel | undefined => {
    for (const r of list) {
      if (r.sel.uid === selUid) return r;
      const f = walk(r.children);
      if (f) return f;
    }
    return undefined;
  };
  return walk(ev.roots);
}

function edit(roster: Roster, fn: (sels: Selection[]) => void): Roster {
  const next = structuredClone(roster);
  fn(next.forces[0].selections);
  return next;
}

export function addRoot(ev: Evaluator, roster: Roster, node: Node): { roster: Roster; uid: string } {
  const sel = ev.createSelection(node, null);
  return { roster: edit(roster, (s) => s.push(sel)), uid: sel.uid };
}

export function removeSelection(roster: Roster, selUid: string): Roster {
  return edit(roster, (s) => {
    const f = findSelection(s, selUid);
    if (f) f.parentList.splice(f.parentList.indexOf(f.sel), 1);
  });
}

export function duplicateSelection(roster: Roster, selUid: string): { roster: Roster; uid?: string } {
  let newUid: string | undefined;
  const next = edit(roster, (s) => {
    const f = findSelection(s, selUid);
    if (!f) return;
    const copy = cloneSelection(f.sel);
    newUid = copy.uid;
    f.parentList.splice(f.parentList.indexOf(f.sel) + 1, 0, copy);
  });
  return { roster: next, uid: newUid };
}

export function renameSelection(roster: Roster, selUid: string, name: string): Roster {
  return edit(roster, (s) => {
    const f = findSelection(s, selUid);
    if (f) f.sel.customName = name.trim() || undefined;
  });
}

/** Set the per-parent count of `node` beneath the selection `parentUid`. */
export function setChildCount(ev: Evaluator, roster: Roster, parentUid: string, node: Node, count: number): Roster {
  const parent = findRSel(ev, parentUid);
  if (!parent) return roster;
  const existing = parent.children.find((c) => c.node === node);
  const created = !existing && count > 0 ? ev.createSelection(node, parent, count) : undefined;
  return edit(roster, (s) => {
    const p = findSelection(s, parentUid)?.sel;
    if (!p) return;
    const idx = p.children.findIndex((c) => existing && c.uid === existing.sel.uid);
    if (count <= 0) {
      if (idx >= 0) p.children.splice(idx, 1);
    } else if (idx >= 0) {
      p.children[idx].count = count;
    } else if (created) {
      p.children.push(created);
    }
  });
}

/** Pick one entry of a "choose one" group, replacing any other choice. */
export function chooseInGroup(ev: Evaluator, roster: Roster, parentUid: string, group: Node, node: Node, count = 1): Roster {
  const parent = findRSel(ev, parentUid);
  if (!parent) return roster;
  const members = new Set(groupEntries(group));
  const keep = parent.children.find((c) => c.node === node);
  const created = keep ? undefined : ev.createSelection(node, parent, count);
  return edit(roster, (s) => {
    const p = findSelection(s, parentUid)?.sel;
    if (!p) return;
    const removeUids = new Set(parent.children.filter((c) => members.has(c.node) && c.node !== node).map((c) => c.sel.uid));
    p.children = p.children.filter((c) => !removeUids.has(c.uid));
    if (created) p.children.push(created);
  });
}

/** Plain-text army list for sharing. */
export function rosterToText(ev: Evaluator, roster: Roster, index: GameIndex): string {
  const lines: string[] = [];
  const total = ev.rosterCost();
  lines.push(`${roster.name} — ${roster.catalogueName} — ${total} pts`);
  lines.push('');
  const sub = (r: RSel, depth: number) => {
    for (const c of r.children) {
      const name = ev.nameOf(c.node, c);
      lines.push(`${'  '.repeat(depth)}• ${c.sel.count > 1 ? `${c.sel.count}x ` : ''}${name}`);
      sub(c, depth + 1);
    }
  };
  for (const r of ev.roots) {
    const pts = ev.totalCost(r);
    const cat = r.node.primaryCategoryId ? index.categoryName(r.node.primaryCategoryId) : '';
    lines.push(`${r.sel.customName ? `${r.sel.customName} (${ev.nameOf(r.node, r)})` : ev.nameOf(r.node, r)}${pts ? ` [${pts} pts]` : ''}${cat && cat !== 'Configuration' ? ` — ${cat}` : ''}`);
    sub(r, 1);
    lines.push('');
  }
  return lines.join('\n');
}
