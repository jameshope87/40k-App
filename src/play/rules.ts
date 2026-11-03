/**
 * Step-by-step game flow for Play mode.
 *
 * These are short, paraphrased reminders of the 11th edition turn structure,
 * written for quick reference at the table. They are not a substitute for the
 * official Core Rules: always check the rulebook / your mission pack for exact
 * wording, distances and edge cases. Unit, weapon and ability rules text in
 * the app comes from the BSData catalogues instead.
 *
 * To correct or extend a summary, edit the data below. Nothing else depends on
 * the wording.
 */

export type Helper =
  | 'cp'
  | 'battleshock'
  | 'move'
  | 'reserves'
  | 'shoot'
  | 'charge'
  | 'pilein'
  | 'fight'
  | 'consolidate'
  | 'score'
  | 'abilities'
  | 'deploy'
  | 'firstTurn';

export interface DiceCall {
  label: string;
  expr: string; // e.g. "2D6"
  /** Success threshold shown with the result, e.g. 4 for "4+" */
  target?: number;
  note?: string;
}

export interface Step {
  id: string;
  title: string;
  /** Bullet points; `**bold**` is rendered. */
  summary: string[];
  dice?: DiceCall[];
  /** Interactive helper shown with this step. */
  helper?: Helper;
  /** Reminder of stratagems / abilities that commonly trigger here. */
  watchFor?: string[];
}

export interface Phase {
  id: string;
  name: string;
  short: string;
  steps: Step[];
}

export const RULES_EDITION = '11th edition';

export const DISCLAIMER =
  'Rules summaries are short paraphrased reminders for use at the table. Always check the official Core Rules and your mission pack for exact wording. Unit and weapon rules text comes from the BSData catalogue you built your list from.';

export const PRE_BATTLE: Step[] = [
  {
    id: 'muster',
    title: 'Muster armies',
    summary: [
      'Each player picks their army list. Check the points total and that the list is valid.',
      'Choose your **Warlord**.',
      'Attach **Leader** and **Support** units to their **bodyguard** units. Each bodyguard can normally have one leader and one support unit.',
    ],
  },
  {
    id: 'mission',
    title: 'Select mission',
    summary: [
      'Agree the mission: primary mission, deployment map and any mission rules (for example from your mission deck or pack).',
      'Note when and how primary victory points (VP) are scored.',
      'Choose or draw secondary missions as the mission pack says.',
    ],
  },
  {
    id: 'battlefield',
    title: 'Create the battlefield',
    summary: ['Set up terrain features and place the objective markers as shown on the deployment map.'],
  },
  {
    id: 'zones',
    title: 'Determine attacker and defender',
    summary: ['Roll off. The winner decides who is the **Attacker** and who is the **Defender**, which sets the deployment zones.'],
    dice: [{ label: 'Roll-off', expr: 'D6', note: 'Each player rolls; highest wins (re-roll ties).' }],
  },
  {
    id: 'formations',
    title: 'Declare battle formations',
    summary: [
      'Secretly note which units start **embarked** in transports and which start in **Reserves** (for example Deep Strike or Strategic Reserves).',
      'Reserves are limited by points. See your mission pack for the limit.',
      'Strategic Reserves that have not arrived by the end of the third battle round count as destroyed.',
    ],
  },
  {
    id: 'deploy',
    title: 'Deploy armies',
    summary: [
      'Players alternate setting up units wholly within their deployment zone, as the mission describes.',
      'Units with **Infiltrators** can be set up outside the deployment zone, far enough from the enemy (see the ability).',
    ],
    helper: 'deploy',
  },
  {
    id: 'prebattle',
    title: 'Resolve pre-battle abilities',
    summary: [
      'Resolve abilities used before the battle, such as **Scouts** moves. Players alternate, starting with the player who will go first unless the rules say otherwise.',
    ],
    helper: 'abilities',
  },
  {
    id: 'first',
    title: 'Determine who goes first',
    summary: ['Roll off (or follow the mission pack). The winner takes the first turn of each battle round.'],
    dice: [{ label: 'Roll-off', expr: 'D6' }],
    helper: 'firstTurn',
  },
];

export const TURN: Phase[] = [
  {
    id: 'start',
    name: 'Start of turn',
    short: 'Start',
    steps: [
      {
        id: 'start-turn',
        title: 'Start of turn',
        summary: [
          'Resolve any rules that happen at the **start of the turn**.',
          'Units in **Strategic Reserves** can arrive later in the turn using ingress moves.',
        ],
      },
    ],
  },
  {
    id: 'command',
    name: 'Command phase',
    short: 'Cmd',
    steps: [
      {
        id: 'cmd-start',
        title: 'Start of Command phase',
        summary: ['Resolve rules that happen at the start of the Command phase, such as abilities that gain extra CP.'],
        helper: 'abilities',
      },
      {
        id: 'cmd-cp',
        title: 'Gain Command Points',
        summary: ['**Both players gain 1CP.** Other sources of CP are limited by the core rules, so check before adding more.'],
        helper: 'cp',
      },
      {
        id: 'cmd-shock',
        title: 'Battle-shock step',
        summary: [
          'Take a **Battle-shock test** for each of your units that is **at or below half-strength**, and for each unit that is **already Battle-shocked**.',
          'Roll **2D6**. If the result is **equal to or greater than** the unit’s **Leadership (Ld)**, the test is passed. A Battle-shocked unit that passes recovers.',
          'A **Battle-shocked** unit has **OC 0** and cannot be targeted by its own side’s **Stratagems**. It stays Battle-shocked until it passes a later test.',
          'Half-strength: half or fewer of the unit’s starting models remain (for a single model, half or fewer of its starting wounds). The app flags these units for you. Check the Core Rules for the exact threshold.',
        ],
        dice: [{ label: 'Battle-shock test', expr: '2D6', note: 'Pass on ≥ Ld' }],
        helper: 'battleshock',
        watchFor: ['Insane Bravery (1CP, core stratagem): automatically pass a battle-shock test. Once per battle.'],
      },
      {
        id: 'cmd-abilities',
        title: 'Command abilities and end of phase',
        summary: [
          'Resolve abilities used in or at the end of the Command phase, such as healing or reanimation, and faction rules.',
          'Check the mission. Some primary missions score VP in the Command phase.',
        ],
        helper: 'abilities',
      },
    ],
  },
  {
    id: 'movement',
    name: 'Movement phase',
    short: 'Move',
    steps: [
      {
        id: 'move-units',
        title: 'Move units',
        summary: [
          'Select each unit in turn and choose one option:',
          '• **Remain Stationary**: doesn’t move (needed for **[HEAVY]** weapon bonuses).',
          '• **Normal move**: an unengaged unit moves up to its **M** characteristic. It cannot end within Engagement Range (2") of enemy models.',
          '• **Advance**: roll **D6** and add it to M. The unit can only shoot with **[ASSAULT]** weapons (assault shooting) and **cannot charge** this turn.',
          '• **Fall Back** (engaged units only): an **Ordered Retreat** (not allowed if Battle-shocked) or a **Desperate Escape**, which needs hazard rolls and a battle-shock roll. Units that fall back normally cannot shoot or charge this turn.',
          '**FLY** units can declare that they **take to the skies** before moving, which changes how they move over models and terrain.',
          'Engagement Range is **2"**.',
        ],
        dice: [
          { label: 'Advance', expr: 'D6', note: 'Add to M this move' },
          { label: 'Hazard roll', expr: 'D6', note: 'See Hazardous / Desperate Escape' },
        ],
        helper: 'move',
        watchFor: ['Opponent: Fire Overwatch-style reactions may happen when you move. Check your stratagems.'],
      },
      {
        id: 'move-reserves',
        title: 'Reinforcements (ingress moves)',
        summary: [
          'Units arriving from **Reserves** (Deep Strike, Strategic Reserves) make an **ingress move**. Set them up as their rules allow, at the required distance from enemy models.',
          'A unit that makes an ingress move cannot make any other kind of move until your next Charge phase.',
          '**Aircraft** can only arrive by ingress moves.',
        ],
        helper: 'reserves',
        watchFor: ['Opponent: Rapid Ingress (core stratagem) lets a reserve unit arrive at the end of *your* opponent’s Movement phase.'],
      },
    ],
  },
  {
    id: 'shooting',
    name: 'Shooting phase',
    short: 'Shoot',
    steps: [
      {
        id: 'shoot-select',
        title: 'Select a unit to shoot',
        summary: [
          'Pick one eligible unit and choose how it shoots:',
          '• **Normal shooting**: the unit did not Advance and is not engaged.',
          '• **Assault shooting**: the unit Advanced. Only **[ASSAULT]** weapons can shoot.',
          '• **Close-quarters shooting**: for engaged units with **[CLOSE-QUARTERS]/[PISTOL]** weapons (or that are MONSTER/VEHICLE, per the rules).',
          '• **Indirect shooting**: uses **[INDIRECT FIRE]** weapons against targets that aren’t visible.',
          'Units that Fell Back (or made an ingress move this turn, if restricted) cannot normally shoot.',
          'Choose targets for each weapon. They must be visible and within range.',
        ],
        helper: 'shoot',
      },
      {
        id: 'shoot-resolve',
        title: 'Resolve attacks',
        summary: [
          '**1. Hit roll:** roll one D6 per attack. Hit on **≥ BS**. An unmodified **6 is a Critical Hit** and always hits. An unmodified **1 always fails**.',
          '**2. Wound roll:** compare **S** with the target’s **T**: S ≥ 2×T → 2+, S > T → 3+, S = T → 4+, S < T → 5+, S ≤ ½T → 6+. An unmodified 6 is a **Critical Wound**.',
          '**3. Allocate:** the defender allocates attacks to models in their unit, following the core rules’ allocation order (for example, already-wounded models first).',
          '**4. Saving throw:** the defender rolls. Save on **≥ Sv worsened by AP**, or use an **invulnerable save** (not affected by AP). An unmodified 1 always fails.',
          '**5. Damage:** each failed save inflicts **D** damage. Excess damage from one attack is lost. Mortal wounds spill over. **Feel No Pain** rolls happen per wound lost.',
          'Cover: a target with the **benefit of cover** makes the attack’s **BS worse by 1** (unless **[IGNORES COVER]**).',
          'After the unit has shot, make **hazard rolls** for any **[HAZARDOUS]** weapons it used.',
        ],
        dice: [
          { label: 'Hit rolls', expr: 'D6' },
          { label: 'Wound rolls', expr: 'D6' },
          { label: 'Saves', expr: 'D6' },
        ],
        helper: 'shoot',
        watchFor: ['Opponent: defensive stratagems such as Go to Ground or Smokescreen can be used when a unit is targeted.'],
      },
    ],
  },
  {
    id: 'charge',
    name: 'Charge phase',
    short: 'Charge',
    steps: [
      {
        id: 'charge-declare',
        title: 'Charge',
        summary: [
          'Select an eligible unit. It must not have Advanced or Fallen Back this turn.',
          'Roll **2D6** first. That is the **maximum charge distance**. Then declare charge targets within that distance.',
          'Make the **charge move**: each model can move up to the rolled distance. The unit must end within **Engagement Range (2")** of every charge target. Base-to-base contact is not required.',
          'If the move cannot be made, the charge fails and the unit doesn’t move.',
          'Units that charged gain charge bonuses this turn (e.g. **[LANCE]**).',
        ],
        dice: [{ label: 'Charge roll', expr: '2D6', note: 'Max distance in inches' }],
        helper: 'charge',
        watchFor: ['Opponent: reactive stratagems (e.g. Heroic Intervention / Overwatch-style) may trigger on a charge.'],
      },
    ],
  },
  {
    id: 'fight',
    name: 'Fight phase',
    short: 'Fight',
    steps: [
      {
        id: 'fight-pilein',
        title: 'Pile in',
        summary: [
          'Every unit that is **engaged** or **charged this turn** can **pile in up to 3"**, with each model ending closer to the enemy.',
          'The **active player** piles in **all** of their eligible units first, then the opponent piles in all of theirs.',
        ],
        helper: 'pilein',
      },
      {
        id: 'fight-fight',
        title: 'Fight',
        summary: [
          '**Fights First** units fight before everything else. Then the remaining eligible units fight.',
          'Players alternate selecting units to fight, starting with the active player.',
          'Resolve melee attacks the same way as shooting (hit with **WS**, wound, allocate, save, damage).',
          'If a unit’s target is destroyed before it fights, it may be able to **overrun**: pile in again and fight a nearby enemy (see the core rules).',
          'After fighting, make hazard rolls for **[HAZARDOUS]** melee weapons.',
        ],
        dice: [
          { label: 'Hit rolls', expr: 'D6' },
          { label: 'Wound rolls', expr: 'D6' },
          { label: 'Saves', expr: 'D6' },
        ],
        helper: 'fight',
        watchFor: ['Counter-attack stratagems can let a unit fight out of sequence.'],
      },
      {
        id: 'fight-consolidate',
        title: 'Consolidate',
        summary: [
          'After all fights, units that fought can **consolidate up to 3"** towards the nearest enemy.',
          'If no enemy is in reach but an **objective marker** is, they must consolidate towards it.',
          'All consolidation moves happen together in this step: the active player first, then the opponent.',
        ],
        helper: 'consolidate',
      },
    ],
  },
  {
    id: 'end',
    name: 'End of turn',
    short: 'End',
    steps: [
      {
        id: 'end-turn',
        title: 'End of turn and scoring',
        summary: [
          'Resolve **end of turn** rules.',
          'Score **victory points** as your mission describes (primary and secondary missions, actions completed).',
          'If both players have had a turn, the **battle round** ends. The battle ends after **battle round 5** unless the mission says otherwise.',
        ],
        helper: 'score',
      },
    ],
  },
];

export const MAX_ROUNDS = 5;

/** Short glossary for quick look-up in Play mode. */
export const GLOSSARY: { term: string; text: string }[] = [
  { term: 'Engagement Range', text: 'Within 2" horizontally (and 5" vertically) of an enemy model.' },
  { term: 'Critical Hit', text: 'An unmodified hit roll of 6. Triggers [SUSTAINED HITS] and [LETHAL HITS].' },
  { term: 'Critical Wound', text: 'An unmodified wound roll of 6 (or lower with [ANTI-X]). Triggers [DEVASTATING WOUNDS].' },
  { term: 'Mortal wounds', text: 'Damage with no hit, wound or save rolls. Excess damage carries over to other models.' },
  { term: 'Battle-shocked', text: 'OC becomes 0 and your own Stratagems cannot target the unit. Lasts until a later test is passed.' },
  { term: 'Half-strength', text: 'Half or fewer of the starting models remain, or a single model has half or fewer of its starting wounds. Check the Core Rules for the exact threshold.' },
  { term: 'Invulnerable save', text: 'A save that is never modified by AP. Use it instead of the armour save if it is better.' },
  { term: 'Feel No Pain X+', text: 'Each time a model would lose a wound, roll a D6. On X+ that wound is not lost.' },
  { term: 'Re-rolls', text: 'A dice can never be re-rolled more than once. Re-rolls happen before modifiers are applied.' },
  { term: 'Modifiers', text: 'Hit and wound rolls: an unmodified 6 always succeeds and an unmodified 1 always fails.' },
];

export function allSteps() {
  return TURN.flatMap((p) => p.steps.map((s) => ({ phase: p, step: s })));
}
