/**
 * GameIndex: resolves a game system + catalogue (+ linked catalogues) into a
 * tree of `Node`s, following entry links and merging link overrides.
 */
import type {
  RawCondition,
  RawConditionGroup,
  RawConstraint,
  RawDataFile,
  RawEntry,
  RawForceEntry,
  RawInfoGroup,
  RawInfoLink,
  RawModifier,
  RawModifierGroup,
  RawProfile,
  RawRule,
} from './types';

/** A modifier with the conditions of any enclosing modifier groups attached. */
export interface FlatModifier extends RawModifier {
  guards: RawConditionGroup[];
}

export interface InfoItem {
  kind: 'profile' | 'rule';
  id: string;
  name: string;
  hidden: boolean;
  modifiers: FlatModifier[];
  profile?: RawProfile;
  rule?: RawRule;
}

export interface Node {
  /** Id selections use to refer to this node: the entry-link id, or the entry id. */
  key: string;
  /** Id of the underlying entry. */
  id: string;
  name: string;
  kind: 'entry' | 'group';
  /** unit | model | upgrade | group */
  type: string;
  hidden: boolean;
  collective: boolean;
  comment?: string;
  costs: Record<string, number>;
  constraints: RawConstraint[];
  modifiers: FlatModifier[];
  categoryIds: string[];
  primaryCategoryId?: string;
  defaultSelectionEntryId?: string;
  sortIndex?: number;
  infos: InfoItem[];
  children: Node[];
}

export function flattenModifiers(mods?: RawModifier[], groups?: RawModifierGroup[], guards: RawConditionGroup[] = []): FlatModifier[] {
  const out: FlatModifier[] = [];
  for (const m of mods ?? []) out.push({ ...m, guards });
  for (const g of groups ?? []) {
    const guard: RawConditionGroup = { type: 'and', conditions: g.conditions, conditionGroups: g.conditionGroups };
    const hasGuard = (g.conditions?.length ?? 0) + (g.conditionGroups?.length ?? 0) > 0;
    out.push(...flattenModifiers(g.modifiers, g.modifierGroups, hasGuard ? [...guards, guard] : guards));
  }
  return out;
}

const num = (v: unknown) => (typeof v === 'number' ? v : Number(v ?? 0) || 0);

export class GameIndex {
  readonly entries = new Map<string, RawEntry>();
  readonly groups = new Map<string, RawEntry>();
  readonly profiles = new Map<string, RawProfile>();
  readonly rules = new Map<string, RawRule>();
  readonly infoGroups = new Map<string, RawInfoGroup>();
  readonly categories = new Map<string, { id: string; name: string }>();
  readonly forceEntries: RawForceEntry[] = [];
  readonly costTypes: { id: string; name: string }[] = [];
  readonly files: RawDataFile[];
  readonly ptsTypeId: string;
  /** Root (army-list level) nodes available in this catalogue. */
  readonly rootNodes: Node[];

  private nodeCache = new WeakMap<object, Node>();

  constructor(
    readonly gameSystem: RawDataFile,
    readonly catalogue: RawDataFile,
    linkedCatalogues: (id: string) => RawDataFile | undefined,
  ) {
    // Collect catalogue + transitive catalogue links.
    const files: RawDataFile[] = [gameSystem];
    // Primary catalogue first so its entries win over same-named imported ones.
    const rootSources: RawDataFile[] = [];
    const visit = (cat: RawDataFile, importRoots: boolean) => {
      if (files.includes(cat)) return;
      files.push(cat);
      if (importRoots) rootSources.push(cat);
      for (const link of cat.catalogueLinks ?? []) {
        const target = linkedCatalogues(link.targetId);
        if (target) visit(target, importRoots && !!link.importRootEntries);
      }
    };
    visit(catalogue, true);
    rootSources.splice(1, 0, gameSystem);
    this.files = files;

    for (const f of files) {
      for (const e of f.sharedSelectionEntries ?? []) this.entries.set(e.id, e);
      for (const e of f.selectionEntries ?? []) this.entries.set(e.id, e);
      for (const g of f.sharedSelectionEntryGroups ?? []) this.groups.set(g.id, g);
      for (const p of f.sharedProfiles ?? []) this.profiles.set(p.id, p);
      for (const r of f.sharedRules ?? []) this.rules.set(r.id, r);
      for (const r of f.rules ?? []) this.rules.set(r.id, r);
      for (const ig of f.sharedInfoGroups ?? []) this.infoGroups.set(ig.id, ig);
      for (const c of f.categoryEntries ?? []) this.categories.set(c.id, { id: c.id, name: c.name });
      for (const fe of f.forceEntries ?? []) this.forceEntries.push(fe);
      for (const ct of f.costTypes ?? []) if (!this.costTypes.some((c) => c.id === ct.id)) this.costTypes.push({ id: ct.id, name: ct.name });
    }
    this.ptsTypeId = (this.costTypes.find((c) => /^(pts|points)$/i.test(c.name)) ?? this.costTypes[0])?.id ?? 'pts';

    const roots: Node[] = [];
    const names = new Set<string>();
    const add = (n: Node | undefined) => {
      // Imported catalogues often repeat configuration entries (e.g. "Detachment");
      // keep the first (primary catalogue / game system) one.
      if (!n || names.has(n.name)) return;
      names.add(n.name);
      roots.push(n);
    };
    for (const f of rootSources) {
      for (const e of f.selectionEntries ?? []) add(this.entryNode(e));
      for (const l of f.entryLinks ?? []) add(this.linkNode(l));
    }
    this.rootNodes = roots;
  }

  categoryName(id: string) {
    return this.categories.get(id)?.name ?? id;
  }

  costName(id: string) {
    return this.costTypes.find((c) => c.id === id)?.name ?? id;
  }

  forceEntry(id?: string): RawForceEntry | undefined {
    return this.forceEntries.find((f) => f.id === id) ?? this.forceEntries[0];
  }

  // ---- node construction -------------------------------------------------

  entryNode(raw: RawEntry, kind: 'entry' | 'group' = 'entry'): Node {
    const cached = this.nodeCache.get(raw);
    if (cached) return cached;
    const node = this.buildNode(kind, raw, undefined);
    this.nodeCache.set(raw, node);
    return node;
  }

  linkNode(link: RawEntry): Node | undefined {
    const cached = this.nodeCache.get(link);
    if (cached) return cached;
    const isGroup = link.type === 'selectionEntryGroup';
    const target = link.targetId ? (isGroup ? this.groups.get(link.targetId) : this.entries.get(link.targetId)) : undefined;
    if (!target) return undefined;
    const node = this.buildNode(isGroup ? 'group' : 'entry', target, link);
    this.nodeCache.set(link, node);
    return node;
  }

  private buildNode(kind: 'entry' | 'group', target: RawEntry, link: RawEntry | undefined): Node {
    const costs: Record<string, number> = {};
    for (const c of target.costs ?? []) costs[c.typeId] = num(c.value);
    for (const c of link?.costs ?? []) costs[c.typeId] = num(c.value);
    const catLinks = [...(target.categoryLinks ?? []), ...(link?.categoryLinks ?? [])];
    const primary = catLinks.find((c) => c.primary);
    const index = this;
    const node: Node = {
      key: link?.id ?? target.id,
      id: target.id,
      name: link?.name || target.name,
      kind,
      type: kind === 'group' ? 'group' : (target.type ?? 'upgrade'),
      hidden: !!(target.hidden || link?.hidden),
      collective: !!(target.collective || link?.collective),
      comment: target.comment ?? link?.comment,
      costs,
      constraints: [...(target.constraints ?? []), ...(link?.constraints ?? [])],
      modifiers: [
        ...flattenModifiers(target.modifiers, target.modifierGroups),
        ...flattenModifiers(link?.modifiers, link?.modifierGroups),
      ],
      categoryIds: catLinks.map((c) => c.targetId),
      primaryCategoryId: primary?.targetId,
      defaultSelectionEntryId: link?.defaultSelectionEntryId ?? target.defaultSelectionEntryId,
      sortIndex: (link as { sortIndex?: number } | undefined)?.sortIndex ?? (target as { sortIndex?: number }).sortIndex,
      get infos(): InfoItem[] {
        const value = [...index.infoItems(target), ...(link ? index.infoItems(link) : [])];
        Object.defineProperty(node, 'infos', { value });
        return value;
      },
      get children(): Node[] {
        const value = [...index.childNodes(target), ...(link ? index.childNodes(link) : [])];
        Object.defineProperty(node, 'children', { value });
        return value;
      },
    };
    return node;
  }

  private childNodes(raw: RawEntry): Node[] {
    const out: Node[] = [];
    for (const e of raw.selectionEntries ?? []) out.push(this.entryNode(e, 'entry'));
    for (const l of raw.entryLinks ?? []) {
      const n = this.linkNode(l);
      if (n) out.push(n);
    }
    for (const g of raw.selectionEntryGroups ?? []) out.push(this.entryNode(g, 'group'));
    // Stable sort by sortIndex where provided.
    return out
      .map((n, i) => ({ n, i }))
      .sort((a, b) => (a.n.sortIndex ?? 1e9) - (b.n.sortIndex ?? 1e9) || a.i - b.i)
      .map((x) => x.n);
  }

  infoItems(raw: {
    profiles?: RawProfile[];
    rules?: RawRule[];
    infoLinks?: RawInfoLink[];
    infoGroups?: RawInfoGroup[];
  }, inherited: FlatModifier[] = [], inheritedHidden = false): InfoItem[] {
    const out: InfoItem[] = [];
    for (const p of raw.profiles ?? [])
      out.push({ kind: 'profile', id: p.id, name: p.name, hidden: inheritedHidden || !!p.hidden, profile: p, modifiers: [...inherited, ...flattenModifiers(p.modifiers, p.modifierGroups)] });
    for (const r of raw.rules ?? [])
      out.push({ kind: 'rule', id: r.id, name: r.name, hidden: inheritedHidden || !!r.hidden, rule: r, modifiers: [...inherited, ...flattenModifiers(r.modifiers, r.modifierGroups)] });
    for (const l of raw.infoLinks ?? []) {
      const mods = [...inherited, ...flattenModifiers(l.modifiers, l.modifierGroups)];
      const hidden = inheritedHidden || !!l.hidden;
      if (l.type === 'profile') {
        const p = this.profiles.get(l.targetId);
        if (p) out.push({ kind: 'profile', id: p.id, name: l.name || p.name, hidden: hidden || !!p.hidden, profile: p, modifiers: [...mods, ...flattenModifiers(p.modifiers, p.modifierGroups)] });
      } else if (l.type === 'rule') {
        const r = this.rules.get(l.targetId);
        if (r) out.push({ kind: 'rule', id: r.id, name: l.name || r.name, hidden: hidden || !!r.hidden, rule: r, modifiers: [...mods, ...flattenModifiers(r.modifiers, r.modifierGroups)] });
      } else if (l.type === 'infoGroup') {
        const g = this.infoGroups.get(l.targetId);
        if (g) out.push(...this.infoItems(g, [...mods, ...flattenModifiers(g.modifiers, g.modifierGroups)].filter((m) => m.field === 'hidden'), hidden || !!g.hidden));
      }
    }
    for (const g of raw.infoGroups ?? [])
      out.push(...this.infoItems(g, [...inherited, ...flattenModifiers(g.modifiers, g.modifierGroups)].filter((m) => m.field === 'hidden'), inheritedHidden || !!g.hidden));
    return out;
  }

  /** Look up a rule by name (e.g. weapon keyword "Lethal Hits"). */
  findRuleByName(name: string): RawRule | undefined {
    const n = name.toLowerCase().replace(/\s+\d+\+?$|\s+x$/i, '').trim();
    for (const r of this.rules.values()) if (r.name.toLowerCase() === n) return r;
    for (const r of this.rules.values()) if (r.name.toLowerCase().startsWith(n)) return r;
    return undefined;
  }
}

/** Find the child node for `key` beneath `node`, looking through groups. */
export function findChildNode(node: Node, key: string, entryId?: string): Node | undefined {
  for (const c of node.children) {
    if (c.kind === 'entry' && (c.key === key || (entryId && c.id === entryId && c.key === entryId))) return c;
    if (c.kind === 'group') {
      const inner = findChildNode(c, key, entryId);
      if (inner) return inner;
    }
  }
  // Fall back to matching the underlying entry id (data may have re-linked it).
  if (entryId) {
    for (const c of node.children) {
      if (c.kind === 'entry' && c.id === entryId) return c;
      if (c.kind === 'group') {
        const inner = findChildNode(c, '\u0000', entryId);
        if (inner) return inner;
      }
    }
  }
  return undefined;
}

/** Every selectable entry inside a group (recursing into nested groups). */
export function groupEntries(group: Node): Node[] {
  const out: Node[] = [];
  for (const c of group.children) {
    if (c.kind === 'entry') out.push(c);
    else out.push(...groupEntries(c));
  }
  return out;
}

export type { RawCondition };
