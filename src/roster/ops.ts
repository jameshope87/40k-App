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
    // Detach anything that was attached to the removed unit.
    for (const root of s) {
      if (!root.attachments) continue;
      for (const [k, v] of Object.entries(root.attachments)) if (v === selUid) delete root.attachments[k];
    }
  });
}

/** Attach a root selection to another unit through one of its associations (or detach with null). */
export function setAttachment(roster: Roster, selUid: string, associationId: string, targetUid: string | null): Roster {
  return edit(roster, (s) => {
    const sel = s.find((x) => x.uid === selUid);
    if (!sel) return;
    const next = { ...(sel.attachments ?? {}) };
    if (targetUid) next[associationId] = targetUid;
    else delete next[associationId];
    sel.attachments = Object.keys(next).length ? next : undefined;
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

/** Set the count of one specific selection (0 removes it). */
export function setSelectionCount(roster: Roster, selUid: string, count: number): Roster {
  return edit(roster, (s) => {
    const f = findSelection(s, selUid);
    if (!f) return;
    if (count <= 0) f.parentList.splice(f.parentList.indexOf(f.sel), 1);
    else f.sel.count = count;
  });
}

/**
 * Split `n` models off a selection into a new, separate selection of the same
 * entry with a copy of its wargear, so they can be given different options
 * (e.g. 4× Marine with chainswords + 1× Marine with an eviscerator).
 */
export function splitSelection(roster: Roster, selUid: string, n = 1): { roster: Roster; uid?: string } {
  let newUid: string | undefined;
  const next = edit(roster, (s) => {
    const f = findSelection(s, selUid);
    if (!f || f.sel.count <= n) return;
    const copy = cloneSelection(f.sel);
    copy.count = n;
    copy.customName = undefined;
    newUid = copy.uid;
    f.sel.count -= n;
    f.parentList.splice(f.parentList.indexOf(f.sel) + 1, 0, copy);
  });
  return { roster: next, uid: newUid };
}

/** Merge a selection into another one of the same entry (same parent): counts add up, wargear of the target is kept. */
export function mergeSelection(roster: Roster, fromUid: string, intoUid: string): Roster {
  return edit(roster, (s) => {
    const from = findSelection(s, fromUid);
    const into = findSelection(s, intoUid);
    if (!from || !into || from.parentList !== into.parentList) return;
    into.sel.count += from.sel.count;
    from.parentList.splice(from.parentList.indexOf(from.sel), 1);
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
  const label = (r: RSel) => (r.sel.customName ? `${r.sel.customName} (${ev.nameOf(r.node, r)})` : ev.nameOf(r.node, r));
  const attachments = ev.attachments();
  for (const r of ev.roots) {
    const pts = ev.totalCost(r);
    const cat = r.node.primaryCategoryId ? index.categoryName(r.node.primaryCategoryId) : '';
    lines.push(`${label(r)}${pts ? ` [${pts} pts]` : ''}${cat && cat !== 'Configuration' ? ` — ${cat}` : ''}`);
    for (const a of attachments) if (a.from === r && a.to) lines.push(`  ↳ Attached to ${label(a.to)} (${a.label})`);
    lines.push('');
  }
  return lines.join('\n');
}
