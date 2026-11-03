/**
 * Types describing the BattleScribe data format (as published by BSData).
 *
 * BSData repositories ship either XML (`.gst`/`.cat`) or the equivalent JSON
 * (`.json`, used by wh40k-11e). The XML loader converts into this same JSON
 * shape so the rest of the app only deals with one representation.
 *
 * Only the fields the app uses are typed; everything else passes through.
 */

export type Scalar = string | number | boolean;

export interface RawCondition {
  type: string; // atLeast, atMost, greaterThan, lessThan, equalTo, notEqualTo, instanceOf, notInstanceOf
  field: string; // "selections", "forces", a cost type id, ...
  scope: string; // self, parent, force, roster, primary-catalogue, ancestor, or an entry/category id
  childId?: string;
  value?: number | string;
  includeChildSelections?: boolean;
  includeChildForces?: boolean;
  percentValue?: boolean;
}

export interface RawConditionGroup {
  type?: 'and' | 'or' | string;
  conditions?: RawCondition[];
  conditionGroups?: RawConditionGroup[];
}

export interface RawRepeat {
  field: string;
  scope: string;
  childId?: string;
  value?: number | string;
  repeats?: number | string;
  roundUp?: boolean;
  includeChildSelections?: boolean;
  includeChildForces?: boolean;
}

export interface RawModifier {
  type: string; // set, increment, decrement, append, prepend, add, remove, ...
  field: string; // hidden, name, a cost type id, a constraint id, ...
  value?: Scalar;
  affects?: string;
  conditions?: RawCondition[];
  conditionGroups?: RawConditionGroup[];
  repeats?: RawRepeat[];
}

export interface RawModifierGroup {
  type?: string;
  conditions?: RawCondition[];
  conditionGroups?: RawConditionGroup[];
  repeats?: RawRepeat[];
  modifiers?: RawModifier[];
  modifierGroups?: RawModifierGroup[];
}

export interface RawConstraint {
  id: string;
  type: 'min' | 'max' | string;
  field: string;
  scope: string;
  value: number | string;
  childId?: string;
  includeChildSelections?: boolean;
  includeChildForces?: boolean;
  percentValue?: boolean;
  message?: string;
}

export interface RawCost {
  name?: string;
  typeId: string;
  value: number | string;
}

export interface RawCharacteristic {
  name: string;
  typeId?: string;
  $text?: string;
}

export interface RawProfile {
  id: string;
  name: string;
  hidden?: boolean;
  typeId?: string;
  typeName?: string;
  characteristics?: RawCharacteristic[];
  modifiers?: RawModifier[];
  modifierGroups?: RawModifierGroup[];
}

export interface RawRule {
  id: string;
  name: string;
  hidden?: boolean;
  description?: string;
  alias?: string[] | string;
  modifiers?: RawModifier[];
  modifierGroups?: RawModifierGroup[];
}

export interface RawInfoLink {
  id: string;
  name?: string;
  hidden?: boolean;
  targetId: string;
  type: 'profile' | 'rule' | 'infoGroup' | string;
  modifiers?: RawModifier[];
  modifierGroups?: RawModifierGroup[];
}

export interface RawInfoGroup {
  id: string;
  name: string;
  hidden?: boolean;
  profiles?: RawProfile[];
  rules?: RawRule[];
  infoLinks?: RawInfoLink[];
  infoGroups?: RawInfoGroup[];
  modifiers?: RawModifier[];
  modifierGroups?: RawModifierGroup[];
}

export interface RawCategoryLink {
  id?: string;
  name?: string;
  targetId: string;
  primary?: boolean;
  constraints?: RawConstraint[];
  modifiers?: RawModifier[];
  modifierGroups?: RawModifierGroup[];
}

/** Shared shape of selectionEntry, selectionEntryGroup and entryLink. */
export interface RawEntry {
  id: string;
  name: string;
  type?: string; // unit, model, upgrade (entries); selectionEntry / selectionEntryGroup (links)
  hidden?: boolean;
  targetId?: string;
  collective?: boolean;
  comment?: string;
  defaultSelectionEntryId?: string;
  costs?: RawCost[];
  constraints?: RawConstraint[];
  modifiers?: RawModifier[];
  modifierGroups?: RawModifierGroup[];
  categoryLinks?: RawCategoryLink[];
  selectionEntries?: RawEntry[];
  selectionEntryGroups?: RawEntry[];
  entryLinks?: RawEntry[];
  profiles?: RawProfile[];
  rules?: RawRule[];
  infoLinks?: RawInfoLink[];
  infoGroups?: RawInfoGroup[];
}

export interface RawCategoryEntry {
  id: string;
  name: string;
  hidden?: boolean;
  constraints?: RawConstraint[];
  modifiers?: RawModifier[];
}

export interface RawForceEntry {
  id: string;
  name: string;
  hidden?: boolean;
  categoryLinks?: RawCategoryLink[];
  constraints?: RawConstraint[];
  modifiers?: RawModifier[];
  modifierGroups?: RawModifierGroup[];
  forceEntries?: RawForceEntry[];
}

export interface RawCatalogueLink {
  id: string;
  name?: string;
  targetId: string;
  importRootEntries?: boolean;
}

export interface RawProfileType {
  id: string;
  name: string;
  characteristicTypes?: { id: string; name: string }[];
}

export interface RawCostType {
  id: string;
  name: string;
  defaultCostLimit?: number;
  hidden?: boolean;
}

/** Common shape of a game system (.gst) and a catalogue (.cat). */
export interface RawDataFile {
  id: string;
  name: string;
  type?: 'gameSystem' | 'catalogue' | string;
  revision?: number | string;
  library?: boolean;
  gameSystemId?: string;
  costTypes?: RawCostType[];
  profileTypes?: RawProfileType[];
  categoryEntries?: RawCategoryEntry[];
  forceEntries?: RawForceEntry[];
  catalogueLinks?: RawCatalogueLink[];
  entryLinks?: RawEntry[];
  selectionEntries?: RawEntry[];
  sharedSelectionEntries?: RawEntry[];
  sharedSelectionEntryGroups?: RawEntry[];
  sharedProfiles?: RawProfile[];
  sharedRules?: RawRule[];
  sharedInfoGroups?: RawInfoGroup[];
  rules?: RawRule[];
}
