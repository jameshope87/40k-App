/** Roster data model. Rosters are plain JSON so they can be stored and shared. */

export interface Selection {
  uid: string;
  /** Key of the data node (entry-link id, or entry id) this selection was made from. */
  key: string;
  /** Id of the underlying selection entry (target of the link). */
  entryId: string;
  name: string;
  /**
   * Number of this selection *per instance of its parent*. E.g. a unit
   * (count 1) containing "Warrior" (count 10) each carrying "Gauss flayer"
   * (count 1) means 10 gauss flayers in total.
   */
  count: number;
  children: Selection[];
  /** Optional player-chosen name for a unit, e.g. "Squad Ardias". */
  customName?: string;
}

export interface Force {
  uid: string;
  forceEntryId: string;
  catalogueId: string;
  selections: Selection[];
}

export interface Roster {
  uid: string;
  name: string;
  /** Data source this roster was built from ("owner/repo@branch"). */
  source: { repo: string; branch: string };
  gameSystemId: string;
  catalogueId: string;
  catalogueFile: string;
  catalogueName: string;
  forces: Force[];
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function cloneSelection(sel: Selection): Selection {
  return { ...sel, uid: uid(), children: sel.children.map(cloneSelection) };
}

/** Find a selection (and its parent list) anywhere in a force. */
export function findSelection(
  list: Selection[],
  uidToFind: string,
): { sel: Selection; parentList: Selection[]; parent: Selection | null } | undefined {
  const walk = (items: Selection[], parent: Selection | null): ReturnType<typeof findSelection> => {
    for (const s of items) {
      if (s.uid === uidToFind) return { sel: s, parentList: items, parent };
      const found = walk(s.children, s);
      if (found) return found;
    }
    return undefined;
  };
  return walk(list, null);
}
