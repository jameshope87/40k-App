/**
 * Roster evaluation: applies BattleScribe modifiers/conditions, computes
 * costs and validates constraints for a roster against a GameIndex.
 *
 * This implements the commonly used subset of the BattleScribe rules engine:
 *  - modifiers on hidden / name / costs / constraint values
 *    (set, increment, decrement, append, prepend, multiply) incl. repeats
 *  - conditions and condition groups (and/or) on "selections", "forces" and
 *    cost fields, with scopes self / parent / force / roster /
 *    primary-catalogue / ancestor-by-id
 *  - min/max constraints on selections and costs
 */
import type { RawCondition, RawConditionGroup, RawConstraint, RawForceEntry, RawRepeat } from './types';
import { type FlatModifier, type GameIndex, type InfoItem, type Node, findChildNode, groupEntries } from './index';
import { type Force, type Roster, type Selection, uid } from '../roster/model';

/** A selection resolved against the data. */
export interface RSel {
  sel: Selection;
  node: Node;
  parent: RSel | null;
  children: RSel[];
  /** Total number of this selection in the army (product of counts from the root). */
  mult: number;
  virtual?: boolean;
}

/** Pseudo-scope standing for the whole force/roster. */
const FORCE = Symbol('force');
const PRIMARY_CATALOGUE = Symbol('primary-catalogue');
type ScopeTarget = RSel | typeof FORCE | typeof PRIMARY_CATALOGUE | null;

export interface Issue {
  severity: 'error' | 'warning';
  message: string;
  selUid?: string;
}

const num = (v: unknown) => (typeof v === 'number' ? v : Number(v ?? 0) || 0);

export class Evaluator {
  readonly roots: RSel[];
  readonly orphans: Selection[] = [];
  readonly forceEntry?: RawForceEntry;
  private memo = new Map<string, unknown>();
  private depth = 0;

  constructor(
    readonly index: GameIndex,
    readonly roster: Roster,
    readonly force: Force = roster.forces[0],
  ) {
    this.forceEntry = index.forceEntry(force?.forceEntryId);
    this.roots = [];
    for (const sel of force?.selections ?? []) {
      const node = index.rootNodes.find((n) => n.key === sel.key) ?? index.rootNodes.find((n) => n.id === sel.entryId);
      if (!node) {
        this.orphans.push(sel);
        continue;
      }
      this.roots.push(this.resolve(sel, node, null));
    }
  }

  private resolve(sel: Selection, node: Node, parent: RSel | null): RSel {
    const r: RSel = { sel, node, parent, children: [], mult: (parent?.mult ?? 1) * sel.count };
    for (const child of sel.children) {
      const cn = findChildNode(node, child.key, child.entryId);
      if (!cn) {
        this.orphans.push(child);
        continue;
      }
      r.children.push(this.resolve(child, cn, r));
    }
    return r;
  }

  /** A not-yet-selected placeholder for `node` under `parent` (for evaluating options). */
  virtual(node: Node, parent: RSel | null): RSel {
    return {
      sel: { uid: `virtual:${parent?.sel.uid ?? 'root'}:${node.key}`, key: node.key, entryId: node.id, name: node.name, count: 0, children: [] },
      node,
      parent,
      children: [],
      mult: 0,
      virtual: true,
    };
  }

  // ---- generic field evaluation -------------------------------------------

  private cached<T>(key: string, fn: () => T): T {
    if (this.memo.has(key)) return this.memo.get(key) as T;
    const v = fn();
    this.memo.set(key, v);
    return v;
  }

  applyModifiers<T extends string | number | boolean>(mods: FlatModifier[], field: string, base: T, self: ScopeTarget): T {
    let value: string | number | boolean = base;
    if (this.depth > 20) return base; // guard against pathological recursion
    this.depth++;
    try {
      for (const m of mods) {
        if (m.field !== field || m.affects) continue;
        if (!m.guards.every((g) => this.evalGroup(g, self))) continue;
        if (!this.evalConditions(m.conditions, m.conditionGroups, self)) continue;
        const times = m.repeats?.length ? this.repeatTimes(m.repeats, self) : 1;
        if (times <= 0) continue;
        value = this.applyOne(m, value, times);
      }
    } finally {
      this.depth--;
    }
    return value as T;
  }

  private applyOne(m: FlatModifier, value: string | number | boolean, times: number): string | number | boolean {
    const mv = m.value;
    switch (m.type) {
      case 'set':
        if (typeof value === 'boolean') return mv === true || mv === 'true';
        if (typeof value === 'number') return num(mv);
        return String(mv ?? '');
      case 'increment':
        return num(value) + num(mv) * times;
      case 'decrement':
        return num(value) - num(mv) * times;
      case 'multiply':
        return num(value) * Math.pow(num(mv), times);
      case 'append':
        return `${value} ${mv ?? ''}`.trim();
      case 'prepend':
        return `${mv ?? ''} ${value}`.trim();
      default:
        return value;
    }
  }

  isHidden(node: Node, self: RSel): boolean {
    return this.cached(`h:${self.sel.uid}:${node.key}`, () => this.applyModifiers(node.modifiers, 'hidden', node.hidden, self));
  }

  nameOf(node: Node, self: RSel): string {
    return this.cached(`n:${self.sel.uid}:${node.key}`, () => this.applyModifiers(node.modifiers, 'name', node.name, self));
  }

  /** Cost of one instance of `node` (not including children). */
  cost(node: Node, self: RSel, typeId = this.index.ptsTypeId): number {
    return this.cached(`c:${self.sel.uid}:${node.key}:${typeId}`, () =>
      this.applyModifiers(node.modifiers, typeId, node.costs[typeId] ?? 0, self),
    );
  }

  /** Total cost of a selection including everything beneath it. */
  totalCost(r: RSel, typeId = this.index.ptsTypeId): number {
    const relative = (x: RSel, m: number): number =>
      this.cost(x.node, x, typeId) * m + x.children.reduce((s, c) => s + relative(c, m * c.sel.count), 0);
    return relative(r, r.sel.count);
  }

  rosterCost(typeId = this.index.ptsTypeId): number {
    return this.roots.reduce((s, r) => s + this.totalCost(r, typeId), 0);
  }

  // ---- conditions ----------------------------------------------------------

  evalConditions(conditions: RawCondition[] | undefined, groups: RawConditionGroup[] | undefined, self: ScopeTarget): boolean {
    for (const c of conditions ?? []) if (!this.evalCondition(c, self)) return false;
    for (const g of groups ?? []) if (!this.evalGroup(g, self)) return false;
    return true;
  }

  evalGroup(g: RawConditionGroup, self: ScopeTarget): boolean {
    const results = [
      ...(g.conditions ?? []).map((c) => () => this.evalCondition(c, self)),
      ...(g.conditionGroups ?? []).map((cg) => () => this.evalGroup(cg, self)),
    ];
    if (!results.length) return true;
    return g.type === 'or' ? results.some((f) => f()) : results.every((f) => f());
  }

  private ancestors(self: ScopeTarget): RSel[] {
    const out: RSel[] = [];
    let cur = self && typeof self === 'object' ? self : null;
    while (cur) {
      out.push(cur);
      cur = cur.parent;
    }
    return out;
  }

  resolveScope(scope: string, self: ScopeTarget): ScopeTarget {
    switch (scope) {
      case 'self':
        return self;
      case 'parent':
        return self && typeof self === 'object' ? (self.parent ?? FORCE) : FORCE;
      case 'force':
      case 'roster':
        return FORCE;
      case 'primary-catalogue':
        return PRIMARY_CATALOGUE;
      case 'root-entry': {
        const chain = this.ancestors(self);
        return chain.length ? chain[chain.length - 1] : FORCE;
      }
      case 'ancestor':
        return self && typeof self === 'object' ? (self.parent ?? FORCE) : FORCE;
      default: {
        const found = this.ancestors(self).find((a) => this.matches(a, scope));
        if (found) return found;
        if (this.forceEntry && scope === this.forceEntry.id) return FORCE;
        return null;
      }
    }
  }

  matches(r: RSel, childId: string | undefined): boolean {
    if (!childId || childId === 'any') return true;
    const n = r.node;
    if (childId === n.type) return true;
    return n.id === childId || n.key === childId || n.categoryIds.includes(childId);
  }

  private instanceOf(target: ScopeTarget, childId: string | undefined, scope: string, self: ScopeTarget): boolean {
    if (!childId) return false;
    if (target === PRIMARY_CATALOGUE) return this.index.catalogue.id === childId;
    if (target === FORCE) {
      const fe = this.forceEntry;
      return !!fe && (fe.id === childId || (fe.categoryLinks ?? []).some((c) => c.targetId === childId)) || this.index.catalogue.id === childId;
    }
    if (!target) return false;
    if (scope === 'ancestor') return this.ancestors(self).slice(1).some((a) => this.matches(a, childId));
    return this.matches(target, childId);
  }

  private scopeChildren(target: ScopeTarget): RSel[] {
    if (target === FORCE) return this.roots;
    if (target && typeof target === 'object') return target.children;
    return [];
  }

  /** Measure a field (selections / forces / cost) within a scope. */
  measure(field: string, childId: string | undefined, target: ScopeTarget, recursive: boolean): number {
    if (target === null || target === PRIMARY_CATALOGUE) return 0;
    if (field === 'selections') {
      let total = 0;
      const walk = (list: RSel[], m: number) => {
        for (const r of list) {
          const cm = m * r.sel.count;
          if (this.matches(r, childId)) total += cm;
          if (recursive) walk(r.children, cm);
        }
      };
      walk(this.scopeChildren(target), 1);
      return total;
    }
    if (field === 'forces') {
      if (!childId || childId === 'any') return 1;
      return this.forceEntry?.id === childId ? 1 : 0;
    }
    if (this.index.costTypes.some((c) => c.id === field)) {
      if (target === FORCE) return this.rosterCost(field);
      return this.totalCost(target, field) / Math.max(1, target.sel.count);
    }
    return 0;
  }

  evalCondition(c: RawCondition, self: ScopeTarget): boolean {
    const target = this.resolveScope(c.scope, self);
    if (c.type === 'instanceOf') return this.instanceOf(target, c.childId, c.scope, self);
    if (c.type === 'notInstanceOf') return !this.instanceOf(target, c.childId, c.scope, self);
    const recursive = !!c.includeChildSelections || target === FORCE && c.field !== 'selections';
    const v = this.measure(c.field, c.childId, target, recursive);
    const want = num(c.value);
    switch (c.type) {
      case 'atLeast':
        return v >= want;
      case 'atMost':
        return v <= want;
      case 'greaterThan':
        return v > want;
      case 'lessThan':
        return v < want;
      case 'equalTo':
        return v === want;
      case 'notEqualTo':
        return v !== want;
      default:
        return false;
    }
  }

  private repeatTimes(repeats: RawRepeat[], self: ScopeTarget): number {
    let times = 0;
    for (const r of repeats) {
      const target = this.resolveScope(r.scope, self);
      const v = this.measure(r.field, r.childId, target, !!r.includeChildSelections);
      const per = num(r.value) || 1;
      const ratio = v / per;
      times += (r.roundUp ? Math.ceil(ratio) : Math.floor(ratio)) * (num(r.repeats) || 1);
    }
    return times;
  }

  // ---- constraints ---------------------------------------------------------

  constraintValue(c: RawConstraint, mods: FlatModifier[], self: ScopeTarget): number {
    return this.applyModifiers(mods, c.id, num(c.value), self);
  }

  /** min/max (field "selections", scope parent) for a node, after modifiers. */
  limits(node: Node, self: RSel): { min: number; max: number } {
    let min = 0;
    let max = -1;
    for (const c of node.constraints) {
      if (c.field !== 'selections' || c.scope !== 'parent') continue;
      const v = this.constraintValue(c, node.modifiers, self);
      if (c.type === 'min') min = Math.max(min, v);
      if (c.type === 'max') max = max < 0 ? v : Math.min(max, v);
    }
    return { min, max };
  }

  /** Whether a node can currently be added (not hidden and not limited to 0). */
  isAvailable(node: Node, parent: RSel | null): boolean {
    if (this.isCrusadeOnly(node)) return false;
    const self = this.virtual(node, parent);
    if (this.isHidden(node, self)) return false;
    for (const c of node.constraints) {
      if (c.type !== 'max' || c.field !== 'selections') continue;
      if (this.constraintValue(c, node.modifiers, self) === 0) return false;
    }
    return true;
  }

  /** Crusade-only content is hidden unless the force itself is a Crusade force. */
  isCrusadeOnly(node: Node): boolean {
    if (/crusade/i.test(this.forceEntry?.name ?? '')) return false;
    return /crusade/i.test(node.comment ?? '') || /^crusade$/i.test(node.name);
  }

  /** Army points limit from the force constraints (e.g. set by Battle Size), if any. */
  pointsLimit(): number | undefined {
    const fe = this.forceEntry;
    if (!fe) return undefined;
    const mods = (fe.modifiers ?? []).map((m) => ({ ...m, guards: [] }));
    for (const c of fe.constraints ?? []) {
      if (c.type !== 'max' || c.field !== this.index.ptsTypeId) continue;
      const v = this.constraintValue(c, mods, FORCE);
      if (v > 0) return v;
    }
    return undefined;
  }

  /** Root entries that must be present (e.g. Battle Size, Detachment). */
  requiredRootNodes(): Node[] {
    return this.index.rootNodes.filter(
      (n) =>
        this.isAvailable(n, null) &&
        n.constraints.some((c) => c.type === 'min' && c.field === 'selections' && this.constraintValue(c, n.modifiers, this.virtual(n, null)) > 0),
    );
  }

  /** Count of selections of `node` (an entry, or any entry of a group) beneath `target`. */
  countOf(node: Node, target: ScopeTarget, recursive: boolean): number {
    const keys = new Set(node.kind === 'group' ? groupEntries(node).map((n) => n.key) : [node.key]);
    let total = 0;
    const walk = (list: RSel[], m: number) => {
      for (const r of list) {
        const cm = m * r.sel.count;
        if (keys.has(r.node.key)) total += cm;
        if (recursive) walk(r.children, cm);
      }
    };
    walk(this.scopeChildren(target), 1);
    return total;
  }

  private checkConstraint(
    c: RawConstraint,
    mods: FlatModifier[],
    label: string,
    measure: () => number,
    self: ScopeTarget,
    issues: Issue[],
    selUid?: string,
  ) {
    const limit = this.constraintValue(c, mods, self);
    if (c.type === 'max' && limit < 0) return;
    const isCost = c.field !== 'selections';
    if (isCost && c.type === 'max' && limit === 0 && c.field === this.index.ptsTypeId) return; // no limit set
    const have = measure();
    const ok = c.type === 'min' ? have >= limit : c.type === 'max' ? have <= limit : true;
    if (ok) return;
    const fieldName = isCost ? this.index.costName(c.field) : '';
    const message = c.message
      ? c.message.replace(/\{value\}/g, String(limit))
      : isCost
        ? `${label}: ${fieldName} ${c.type === 'min' ? 'must be at least' : 'cannot exceed'} ${limit} (currently ${have})`
        : `${label}: ${c.type === 'min' ? 'needs at least' : 'allows at most'} ${limit} (currently ${have})`;
    issues.push({ severity: 'error', message, selUid });
  }

  validate(): Issue[] {
    const issues: Issue[] = [];
    const seen = new Set<string>();
    for (const o of this.orphans) issues.push({ severity: 'warning', message: `"${o.name}" is no longer in the data and was ignored.`, selUid: o.uid });

    // Force-level constraints (points limit, detachment points, enhancements...)
    const fe = this.forceEntry;
    if (fe) {
      const feMods = [...(fe.modifiers ?? []), ...[]].map((m) => ({ ...m, guards: [] }));
      for (const c of fe.constraints ?? []) {
        this.checkConstraint(c, feMods, 'Army', () => this.measure(c.field, c.childId, FORCE, true), FORCE, issues);
      }
      for (const cl of fe.categoryLinks ?? []) {
        const mods = (cl.modifiers ?? []).map((m) => ({ ...m, guards: [] }));
        for (const c of cl.constraints ?? []) {
          const name = cl.name ?? this.index.categoryName(cl.targetId);
          this.checkConstraint(c, mods, name, () => this.measure(c.field === 'selections' ? 'selections' : c.field, cl.targetId, FORCE, true), FORCE, issues);
        }
      }
    }

    // Root entries.
    for (const node of this.index.rootNodes) {
      const selected = this.roots.filter((r) => r.node === node);
      const self = selected[0] ?? this.virtual(node, null);
      if (!selected.length && this.isHidden(node, self)) continue;
      for (const c of node.constraints) {
        if (c.field === 'selections' && c.scope === 'self') continue;
        const tgt = c.scope === 'parent' ? FORCE : this.resolveScope(c.scope, self);
        if (c.field === 'selections' && tgt !== FORCE) continue;
        if (c.field !== 'selections' && !selected.length) continue;
        this.checkConstraint(
          c,
          node.modifiers,
          this.nameOf(node, self),
          () => (c.field === 'selections' ? this.countOf(node, FORCE, c.scope !== 'parent' || !!c.includeChildSelections) : this.measure(c.field, c.childId, tgt, true)),
          self,
          issues,
          selected[0]?.sel.uid,
        );
      }
    }

    // Everything beneath each selection.
    const visit = (r: RSel) => {
      this.checkChildren(r, r.node, issues, seen);
      for (const c of r.children) visit(c);
    };
    this.roots.forEach(visit);
    return issues;
  }

  private checkChildren(owner: RSel, container: Node, issues: Issue[], seen: Set<string>) {
    for (const child of container.children) {
      const selected = owner.children.find((c) => c.node === child);
      const self = selected ?? this.virtual(child, owner);
      const hidden = this.isHidden(child, self);
      if (hidden && !(child.kind === 'entry' ? selected : this.countOf(child, owner, false))) continue;
      for (const c of child.constraints) {
        if (c.field !== 'selections') {
          if (!selected || c.scope === 'parent') continue;
          const tgt = this.resolveScope(c.scope, self);
          this.checkConstraint(c, child.modifiers, this.nameOf(child, self), () => this.measure(c.field, c.childId, tgt, true), self, issues, owner.sel.uid);
          continue;
        }
        if (c.scope === 'parent') {
          this.checkConstraint(
            c,
            child.modifiers,
            `${owner.sel.customName || owner.sel.name} › ${this.nameOf(child, self)}`,
            () => this.countOf(child, owner, !!c.includeChildSelections),
            self,
            issues,
            owner.sel.uid,
          );
        } else if (c.scope === 'force' || c.scope === 'roster') {
          const k = `${child.key}:${c.id}`;
          if (seen.has(k) || (!selected && c.type === 'max')) continue;
          seen.add(k);
          this.checkConstraint(c, child.modifiers, this.nameOf(child, self), () => this.countOf(child, FORCE, true), self, issues, owner.sel.uid);
        }
      }
      if (child.kind === 'group') this.checkChildren(owner, child, issues, seen);
    }
  }

  // ---- helpers for building selections ------------------------------------

  /** Info items (profiles/rules) visible for a selection. */
  visibleInfos(r: RSel): { item: InfoItem; name: string }[] {
    return r.node.infos
      .filter((i) => !this.applyModifiers(i.modifiers, 'hidden', i.hidden, r))
      .map((item) => ({ item, name: this.applyModifiers(item.modifiers, 'name', item.name, r) }));
  }

  /** Build a new selection for `node` under `parent` with default sub-selections. */
  createSelection(node: Node, parent: RSel | null, count = 1): Selection {
    const sel: Selection = { uid: uid(), key: node.key, entryId: node.id, name: node.name, count, children: [] };
    const r: RSel = { sel, node, parent, children: [], mult: (parent?.mult ?? 1) * count };
    this.fillDefaults(r, node);
    return sel;
  }

  private addChild(owner: RSel, node: Node, count: number) {
    const existing = owner.children.find((c) => c.node === node);
    if (existing) {
      existing.sel.count += count;
      return;
    }
    const sel = this.createSelection(node, owner, count);
    owner.sel.children.push(sel);
    owner.children.push({ sel, node, parent: owner, children: [], mult: owner.mult * count });
  }

  private fillDefaults(owner: RSel, container: Node) {
    for (const child of container.children) {
      const self = this.virtual(child, owner);
      if (this.isHidden(child, self)) continue;
      const { min } = this.limits(child, self);
      if (child.kind === 'entry') {
        if (min > 0) this.addChild(owner, child, min);
        continue;
      }
      // Group: first apply defaults of its own children, then top up to the group minimum.
      this.fillDefaults(owner, child);
      const have = this.countOf(child, owner, false);
      let remaining = min - have;
      if (remaining <= 0 || child.defaultSelectionEntryId === 'none') continue;
      const options = groupEntries(child).filter((e) => !this.isHidden(e, this.virtual(e, owner)));
      const preferred = options.find((e) => e.key === child.defaultSelectionEntryId || e.id === child.defaultSelectionEntryId);
      const ordered = preferred ? [preferred, ...options.filter((o) => o !== preferred)] : options;
      for (const opt of ordered) {
        if (remaining <= 0) break;
        const lim = this.limits(opt, this.virtual(opt, owner));
        const current = owner.children.find((c) => c.node === opt)?.sel.count ?? 0;
        const room = lim.max < 0 ? remaining : Math.max(0, lim.max - current);
        const add = Math.min(remaining, room);
        if (add > 0) {
          this.addChild(owner, opt, add);
          remaining -= add;
        }
      }
    }
  }
}
