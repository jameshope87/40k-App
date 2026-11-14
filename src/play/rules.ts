/**
 * Step-by-step game flow for Play mode.
 *
 * Short, paraphrased guidance for the 11th edition turn structure, written for
 * use at the table and for learning the game. It is not a substitute for the
 * official Core Rules: details that sources disagree on are flagged with
 * "check the rulebook" rather than guessed. Unit, weapon and ability text
 * comes from the army data, not from here.
 *
 * To correct or extend the guidance, edit the data below; nothing else
 * depends on the wording. Checklist item ids must stay unique within a step
 * (ticks are saved against them).
 */

export type Helper =
  | 'muster'
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

export type ChecklistKind = 'do' | 'check' | 'think';

export interface ChecklistItem {
  id: string;
  kind: ChecklistKind;
  text: string;
}

/** Who makes the decisions in a step. */
export type Actor = 'active' | 'opponent' | 'both';

export interface Step {
  id: string;
  title: string;
  /** One sentence: what this step is for. */
  overview: string;
  actor: Actor;
  /** Things to do, check and think about. `**bold**` is rendered. */
  checklist: ChecklistItem[];
  /** Rules detail (bullets). `**bold**` is rendered. */
  summary: string[];
  dice?: DiceCall[];
  /** Interactive helper shown with this step (needs army lists for most). */
  helper?: Helper;
  /** What the other player can do in response (usually stratagems). */
  reactions?: string[];
  /** Easy-to-make mistakes. */
  mistakes?: string[];
}

export interface Phase {
  id: string;
  name: string;
  short: string;
  /** What the phase is about, shown when it starts. */
  intro: string;
  steps: Step[];
}

export const RULES_EDITION = '11th edition';

export const DISCLAIMER =
  'This guidance is a short paraphrased reminder for use at the table. Always check the official Core Rules and your mission pack for exact wording. Unit and weapon rules come from your army data.';

const c = (id: string, kind: ChecklistKind, text: string): ChecklistItem => ({ id, kind, text });

export const PRE_BATTLE: Step[] = [
  {
    id: 'muster',
    title: 'Muster armies',
    overview: 'Agree the size of the game and make sure both armies are ready.',
    actor: 'both',
    checklist: [
      c('size', 'do', 'Agree the **battle size** (points limit) with your opponent.'),
      c('lists', 'do', 'Show each other your **army lists**.'),
      c('warlord', 'do', 'Choose your **Warlord**.'),
      c('attach', 'do', 'Attach **Leader** and **Support** units to their **bodyguard** units, and say which ones.'),
      c('points', 'check', 'Each list is within the points limit and uses its detachment and enhancement rules correctly.'),
      c('leader', 'check', 'Each Leader joins a unit its **Leader** ability allows.'),
      c('roles', 'think', 'Decide which units will **hold objectives** and which will **hunt** enemy units.'),
    ],
    summary: [
      'An attached unit (bodyguard plus Leader/Support) moves, shoots, fights and takes Battle-shock tests as **one unit**.',
      'Normally a bodyguard can have one Leader and one Support unit attached.',
    ],
    helper: 'muster',
  },
  {
    id: 'mission',
    title: 'Select mission',
    overview: 'Decide what you are fighting over and how victory points (VP) are scored.',
    actor: 'both',
    checklist: [
      c('primary', 'do', 'Choose or draw the **primary mission**, **deployment map** and any **mission rules**.'),
      c('secondary', 'do', 'Choose or draw **secondary missions** as your mission pack says.'),
      c('when', 'check', 'Agree **when** primary VP are scored (for example in the Command phase or at the end of the turn) and any VP caps.'),
      c('plan', 'think', 'Work out which objectives you can **realistically hold** each round, and which secondaries suit your army.'),
    ],
    summary: ['Victory points decide the winner, not how many models you destroy. Keep the mission in mind every turn.'],
  },
  {
    id: 'battlefield',
    title: 'Create the battlefield',
    overview: 'Set up terrain and objectives.',
    actor: 'both',
    checklist: [
      c('terrain', 'do', 'Set up the **terrain** features.'),
      c('objectives', 'do', 'Place the **objective markers** where the deployment map shows.'),
      c('agree', 'check', 'Agree what each terrain piece does: does it **block line of sight**? Is it a **terrain area** that gives cover?'),
      c('lanes', 'think', 'Spot the **firing lanes** and the places your units can **hide**.'),
    ],
    summary: ['Settling terrain questions now avoids arguments later.'],
  },
  {
    id: 'zones',
    title: 'Determine attacker and defender',
    overview: 'A roll-off decides who is the Attacker and who is the Defender, and so the deployment zones.',
    actor: 'both',
    checklist: [
      c('roll', 'do', '**Roll off**: each player rolls a D6, highest wins (re-roll ties).'),
      c('choose', 'do', 'The winner chooses **Attacker** or **Defender**, as the mission pack describes.'),
    ],
    summary: ['The deployment map shows which zone belongs to the Attacker and which to the Defender.'],
    dice: [{ label: 'Roll-off', expr: 'D6', note: 'Highest wins; re-roll ties' }],
  },
  {
    id: 'formations',
    title: 'Declare battle formations',
    overview: 'Secretly note how your army starts the battle.',
    actor: 'both',
    checklist: [
      c('reserves', 'do', 'Note which units start in **Reserves** (Deep Strike or Strategic Reserves).'),
      c('embark', 'do', 'Note which units start **embarked** in Transports.'),
      c('limit', 'check', 'Reserves stay within the **points limit** your mission pack gives.'),
      c('deadline', 'check', 'Strategic Reserves must arrive by the **end of battle round 3** or they count as destroyed.'),
      c('fast', 'think', 'A fast unit kept in reserve can **grab an objective** late in the game.'),
    ],
    summary: ['Write it down: these choices are revealed at the end of this step.'],
    helper: 'deploy',
  },
  {
    id: 'deploy',
    title: 'Deploy armies',
    overview: 'Place your units on the battlefield.',
    actor: 'both',
    checklist: [
      c('alternate', 'do', 'Take turns setting up units, as the mission says.'),
      c('wholly', 'check', 'Every model is **wholly within** your deployment zone (unless an ability such as **Infiltrators** says otherwise).'),
      c('hide', 'think', 'Hide valuable units **out of sight** of enemy guns.'),
      c('screen', 'think', 'Spread cheap units out to **block landing spots** for enemy Deep Strike.'),
    ],
    summary: ['Units with **Infiltrators** can deploy outside your zone, far enough from the enemy (see the ability).'],
  },
  {
    id: 'prebattle',
    title: 'Resolve pre-battle abilities',
    overview: 'Use abilities that happen before the first turn, such as Scouts moves.',
    actor: 'both',
    checklist: [
      c('scouts', 'do', 'Make **Scouts** moves and other pre-battle abilities, alternating as the rules say.'),
      c('check', 'check', 'Read the abilities on your units. Check the **Abilities that may apply** list below.'),
    ],
    summary: ['Players usually alternate, starting with the player who will take the first turn. Check your rulebook.'],
    helper: 'abilities',
  },
  {
    id: 'first',
    title: 'Determine who goes first',
    overview: 'Decide who takes the first turn of every battle round.',
    actor: 'both',
    checklist: [
      c('roll', 'do', '**Roll off** (or follow the mission pack). The winner goes first in every round.'),
      c('second', 'think', 'Going second lets you **react** to your opponent and often score last.'),
    ],
    summary: ['The battle lasts 5 battle rounds. Each round, both players take one turn.'],
    dice: [{ label: 'Roll-off', expr: 'D6' }],
    helper: 'firstTurn',
  },
];

export const TURN: Phase[] = [
  {
    id: 'start',
    name: 'Start of turn',
    short: 'Start',
    intro: 'A new turn begins. Take a moment to plan before anything moves.',
    steps: [
      {
        id: 'start-turn',
        title: 'Start of turn',
        overview: 'Resolve start-of-turn rules and plan your turn.',
        actor: 'active',
        checklist: [
          c('rules', 'do', 'Resolve any rules that happen at the **start of the turn**.'),
          c('plan-obj', 'think', 'Which **objectives** do you need to take or hold this turn?'),
          c('plan-kill', 'think', 'Which enemy units are the **biggest threats**, and which of your units can deal with them?'),
          c('plan-charge', 'think', 'Which units should **charge**? Don’t Advance them if so.'),
        ],
        summary: ['Planning your whole turn now (moves, shooting targets, charges) avoids mistakes such as Advancing a unit you wanted to charge with.'],
      },
    ],
  },
  {
    id: 'command',
    name: 'Command phase',
    short: 'Cmd',
    intro: 'Gain Command Points, check your units’ nerve and use command abilities.',
    steps: [
      {
        id: 'cmd-start',
        title: 'Start of Command phase',
        overview: 'Resolve rules that trigger at the start of this phase.',
        actor: 'active',
        checklist: [c('abilities', 'do', 'Use any abilities that happen **at the start of your Command phase** (some give CP or buffs).')],
        summary: ['Check the **Abilities that may apply** list below if you loaded an army list.'],
        helper: 'abilities',
      },
      {
        id: 'cmd-cp',
        title: 'Gain Command Points',
        overview: 'Both players gain 1 Command Point (CP).',
        actor: 'both',
        checklist: [
          c('gain', 'do', '**Both players gain 1CP**, not just the active player.'),
          c('extra', 'check', 'Gaining **extra CP** from other rules may be limited. Check before adding more.'),
          c('save', 'think', 'Plan to keep **1–2CP** for reacting during your opponent’s turn.'),
        ],
        summary: ['You spend CP on **Stratagems**. Each Stratagem can normally be used once per phase, and a unit can be targeted by only one Stratagem per phase.'],
        helper: 'cp',
      },
      {
        id: 'cmd-shock',
        title: 'Battle-shock step',
        overview: 'Units that have suffered heavy losses test their nerve.',
        actor: 'active',
        checklist: [
          c('who', 'do', 'Find your units at **half-strength or below**, and units **already Battle-shocked**.'),
          c('roll', 'do', 'For each one, roll **2D6**. If the total is **equal to or more than** its **Leadership (Ld)**, it passes.'),
          c('mark', 'do', 'Mark units that fail as **Battle-shocked** (a token helps). A shocked unit that passes recovers.'),
          c('bravery', 'check', '**Insane Bravery** (1CP, once per battle) passes a test automatically, but can’t be used on a unit that is already Battle-shocked.'),
          c('oc', 'think', 'A Battle-shocked unit has **OC 0**, so it can’t hold objectives. Your Stratagems can’t target it either.'),
        ],
        summary: [
          'Half-strength: half or fewer of the unit’s starting models remain (for a single model, half or fewer of its starting wounds). Check the exact threshold in the rulebook.',
          'Battle-shock now lasts until the unit **passes a later test**. It doesn’t wear off at the end of the turn.',
        ],
        dice: [{ label: 'Battle-shock test', expr: '2D6', note: 'Pass on ≥ Ld' }],
        helper: 'battleshock',
        mistakes: ['Forgetting to re-test units that are already Battle-shocked.', 'Counting a Battle-shocked unit’s OC when checking objectives.'],
      },
      {
        id: 'cmd-abilities',
        title: 'Command abilities and scoring',
        overview: 'Use Command phase abilities and score anything your mission scores now.',
        actor: 'active',
        checklist: [
          c('abilities', 'do', 'Use abilities that happen **in or at the end of the Command phase** (healing, orders, faction rules).'),
          c('primary', 'check', 'Does your mission score **primary VP in the Command phase**? If so, score now.'),
          c('secondary', 'check', 'Draw or choose **secondary missions** now if your mission pack says so.'),
        ],
        summary: ['Missions differ in when they score. Some score here, others at the end of the turn.'],
        helper: 'abilities',
      },
    ],
  },
  {
    id: 'movement',
    name: 'Movement phase',
    short: 'Move',
    intro: 'Move your units, then bring in reinforcements.',
    steps: [
      {
        id: 'move-units',
        title: 'Move units',
        overview: 'Choose how each of your units moves.',
        actor: 'active',
        checklist: [
          c('choose', 'do', 'For each unit pick one: **Remain Stationary**, **Normal move**, **Advance** or (if engaged) **Fall Back**.'),
          c('measure', 'do', 'Measure from the **edge of the base**. No model may move further than allowed.'),
          c('mark', 'do', 'Mark units that **Advanced** or **Fell Back**, because it limits what they can do later.'),
          c('engage', 'check', 'A Normal move or Advance can’t end within **Engagement Range (2")** of an enemy.'),
          c('advance', 'check', 'An **Advance** adds a D6 to M, but then the unit **can’t charge** and can only shoot **[ASSAULT]** weapons.'),
          c('fallback', 'check', 'Falling Back: **Ordered Retreat** (not if Battle-shocked) or **Desperate Escape**. Desperate Escape needs hazard rolls and a Battle-shock test. Units that Fall Back normally **can’t shoot or charge**.'),
          c('fly', 'check', '**FLY** units must declare **taking to the skies** before they move.'),
          c('objectives', 'think', 'End moves **on objectives** (usually within 3" of the marker; check your mission).'),
          c('los', 'think', 'Stay **out of sight** of the enemy’s big guns, but **within range** of what you want to shoot.'),
          c('gaps', 'think', 'Don’t leave gaps where enemy units can **Deep Strike** next to your weak units.'),
        ],
        summary: [
          'Remain Stationary matters for **[HEAVY]** weapons (+1 to hit).',
          'Desperate Escape: models can move through enemy models, but the unit makes **hazard rolls** (mortal wounds on failures, more for MONSTER/VEHICLE) and, if not already Battle-shocked, a **Battle-shock** test. Check the exact numbers in the rulebook.',
          'Terrain: follow the movement rules for climbing and moving through terrain features.',
        ],
        dice: [
          { label: 'Advance', expr: 'D6', note: 'Add to M this move' },
          { label: 'Hazard roll', expr: 'D6', note: 'See Desperate Escape / Hazardous' },
        ],
        helper: 'move',
        reactions: ['Your opponent may react to units moving or arriving with a **Fire Overwatch**-type Stratagem.'],
        mistakes: ['Advancing a unit you wanted to charge with.', 'Measuring from the middle of the base instead of the edge.', 'Forgetting that Fall Back normally stops shooting and charging.'],
      },
      {
        id: 'move-reserves',
        title: 'Reinforcements (ingress moves)',
        overview: 'Bring units in from Reserves.',
        actor: 'active',
        checklist: [
          c('arrive', 'do', 'Choose which **Reserve** units arrive this turn and set them up with an **ingress move** (Deep Strike, Strategic Reserves).'),
          c('distance', 'check', 'Set them up the **required distance from enemy models** (see the unit’s ability and the rulebook).'),
          c('first', 'check', 'Check from which **battle round** reserves may arrive under your mission pack.'),
          c('nomove', 'check', 'A unit that arrives can’t make other moves until your **next Charge phase**, so it may still be able to charge.'),
          c('deadline', 'check', 'Strategic Reserves that haven’t arrived by the **end of round 3** count as destroyed.'),
          c('where', 'think', 'Arrive where the unit can **shoot, charge or take an objective** without being easily destroyed.'),
        ],
        summary: ['**Aircraft** can only arrive by ingress moves.'],
        helper: 'reserves',
        reactions: ['At the end of *your* Movement phase your opponent may bring in a unit with **Rapid Ingress** (1CP).'],
      },
    ],
  },
  {
    id: 'shooting',
    name: 'Shooting phase',
    short: 'Shoot',
    intro: 'Your units fire their ranged weapons, one unit at a time.',
    steps: [
      {
        id: 'shoot-select',
        title: 'Select a unit to shoot',
        overview: 'Pick a unit, decide how it shoots, and choose targets for all its weapons.',
        actor: 'active',
        checklist: [
          c('pick', 'do', 'Pick **one unit** that hasn’t shot yet.'),
          c('type', 'do', 'Choose its **shooting type** (see the Rules detail below).'),
          c('targets', 'do', 'Declare **targets for every weapon** before rolling any dice.'),
          c('eligible', 'check', 'Units that **Fell Back** can’t normally shoot. Units that **Advanced** can only use **[ASSAULT]** weapons.'),
          c('range', 'check', 'The target must be **visible** and **within range** (measure to the closest model).'),
          c('engaged', 'check', 'Engaged units can only shoot with **close-quarters** rules (e.g. **[PISTOL]**/**[CLOSE-QUARTERS]** weapons).'),
          c('threat', 'think', 'Shoot the **most dangerous** enemy, or the one standing on an objective you need.'),
          c('match', 'think', 'Match weapons to targets: **high S/AP/D** at tough targets, **many shots** at hordes. Use the attack calculator to compare.'),
        ],
        summary: [
          '**Normal shooting**: the unit did not Advance and is not engaged.',
          '**Assault shooting**: the unit Advanced. Only **[ASSAULT]** weapons can shoot.',
          '**Close-quarters shooting**: for engaged units, using **[CLOSE-QUARTERS]/[PISTOL]** weapons (or as MONSTER/VEHICLE rules allow).',
          '**Indirect shooting**: **[INDIRECT FIRE]** weapons can target units that aren’t visible.',
        ],
        helper: 'shoot',
        reactions: ['Your opponent may use a defensive Stratagem such as **Smokescreen** when their unit is targeted.'],
      },
      {
        id: 'shoot-resolve',
        title: 'Resolve attacks',
        overview: 'Roll to hit, roll to wound, the defender saves, then apply damage.',
        actor: 'both',
        checklist: [
          c('hit', 'do', '**Hit roll**: one D6 per attack. Hit on **BS or more**. A 6 always hits (**Critical Hit**). A 1 always misses.'),
          c('wound', 'do', '**Wound roll**: compare **S** with **T** (see the Rules detail). A 6 is a **Critical Wound**.'),
          c('allocate', 'do', 'The **defender allocates** the attacks to models in their unit.'),
          c('save', 'do', 'The **defender saves**: Sv worsened by **AP**, or an **invulnerable save** if better (AP doesn’t affect it).'),
          c('damage', 'do', 'Each failed save deals **D** damage to that model. Excess damage is lost (mortal wounds carry over). Remove destroyed models.'),
          c('cover', 'check', '**Cover**: if the target has the benefit of cover, the attacker’s **BS is worse by 1** (not for **[IGNORES COVER]**).'),
          c('abilities', 'check', 'Apply weapon abilities: **[SUSTAINED HITS]**, **[LETHAL HITS]**, **[DEVASTATING WOUNDS]**, **[RAPID FIRE]**/**[MELTA]** at half range, **[HEAVY]** if stationary…'),
          c('fnp', 'check', '**Feel No Pain**: the defender rolls for each wound the model would lose.'),
          c('hazard', 'check', 'After the unit has shot, make **hazard rolls** for **[HAZARDOUS]** weapons.'),
        ],
        summary: [
          'Wound roll: S ≥ 2×T → **2+** · S > T → **3+** · S = T → **4+** · S < T → **5+** · S ≤ ½T → **6+**.',
          'Hit and wound rolls: modifiers are limited. An unmodified 6 always succeeds and an unmodified 1 always fails.',
          'Cover only counts when the rules allow it (for example infantry wholly within a terrain area). Check the rulebook.',
          'Repeat for each unit you want to shoot with.',
        ],
        dice: [
          { label: 'Hit rolls', expr: 'D6' },
          { label: 'Wound rolls', expr: 'D6' },
          { label: 'Saves', expr: 'D6' },
        ],
        helper: 'shoot',
        mistakes: [
          'Applying AP to an invulnerable save.',
          'Forgetting the +1 to hit for [HEAVY] when the unit stayed still.',
          'Forgetting extra attacks or damage from [RAPID FIRE] and [MELTA] at half range.',
          'Rolling saves before the defender has allocated the attacks.',
        ],
      },
    ],
  },
  {
    id: 'charge',
    name: 'Charge phase',
    short: 'Charge',
    intro: 'Units move into combat so they can fight in the Fight phase.',
    steps: [
      {
        id: 'charge-declare',
        title: 'Charge',
        overview: 'Roll the charge distance, choose targets in reach, then move into combat.',
        actor: 'active',
        checklist: [
          c('eligible', 'check', 'The unit **didn’t Advance or Fall Back** this turn.'),
          c('roll', 'do', 'Roll **2D6**. That is the unit’s **maximum charge distance** this phase.'),
          c('declare', 'do', 'Declare **charge targets** within that distance.'),
          c('move', 'do', 'Move each model up to the rolled distance. The unit must end within **Engagement Range (2")** of **every target**. Base contact isn’t required.'),
          c('fail', 'check', 'If it can’t do that, the charge **fails** and the unit doesn’t move.'),
          c('reroll', 'think', 'A poor roll can be re-rolled with **Command Re-roll** (1CP).'),
          c('contest', 'think', 'Charging an enemy on an objective **contests** it and stops it shooting freely next turn.'),
        ],
        summary: ['Units that charged gain charge bonuses this turn (for example **[LANCE]**: +1 to wound).'],
        dice: [{ label: 'Charge roll', expr: '2D6', note: 'Max distance in inches' }],
        helper: 'charge',
        reactions: ['Your opponent may use **Fire Overwatch** when you charge, or **Heroic Intervention** at the end of your Charge phase.'],
        mistakes: ['Charging with a unit that Advanced.', 'Declaring a target that is out of range of the roll.'],
      },
    ],
  },
  {
    id: 'fight',
    name: 'Fight phase',
    short: 'Fight',
    intro: 'Units in combat attack with their melee weapons. Both players’ units can fight.',
    steps: [
      {
        id: 'fight-pilein',
        title: 'Pile in',
        overview: 'Every unit in combat (or that charged) shuffles up to 3" closer.',
        actor: 'both',
        checklist: [
          c('active', 'do', 'The **active player** piles in **all** their eligible units first: up to **3"**, ending closer to the enemy.'),
          c('opponent', 'do', 'Then the **opponent** piles in all of theirs.'),
          c('eligible', 'check', 'Eligible: units that are **engaged** or **charged this turn**.'),
          c('more', 'think', 'Pile in so as many models as possible are close enough to **fight**.'),
        ],
        summary: ['Pile-in moves happen together at the start of the phase, not unit by unit.'],
        helper: 'pilein',
      },
      {
        id: 'fight-fight',
        title: 'Fight',
        overview: 'Units take turns to attack in melee.',
        actor: 'both',
        checklist: [
          c('first', 'do', '**Fights First** units fight first, then everyone else.'),
          c('alternate', 'do', 'Players **alternate** choosing a unit to fight, starting with the **active player**.'),
          c('resolve', 'do', 'Each unit attacks with its **melee weapons**: hit (**WS**), wound, allocate, save, damage, as in shooting.'),
          c('models', 'check', 'Only models **close enough to the enemy** can fight. Check the rulebook for exactly which.'),
          c('overrun', 'check', 'If a unit’s target is destroyed before it fights, it may be able to **overrun**: pile in again and fight something else nearby.'),
          c('hazard', 'check', 'Hazard rolls for **[HAZARDOUS]** melee weapons after fighting.'),
          c('order', 'think', 'Choose your **most important fight first**, before the enemy can kill your models.'),
        ],
        summary: ['Every eligible unit on **both sides** gets to fight. It isn’t only the player whose turn it is.'],
        dice: [
          { label: 'Hit rolls', expr: 'D6' },
          { label: 'Wound rolls', expr: 'D6' },
          { label: 'Saves', expr: 'D6' },
        ],
        helper: 'fight',
        reactions: ['**Counteroffensive** (2CP) lets a player fight next, out of the normal order.'],
        mistakes: ['Forgetting that the opponent’s units in combat also fight.', 'Using ranged-weapon BS instead of the melee weapon’s WS.'],
      },
      {
        id: 'fight-consolidate',
        title: 'Consolidate',
        overview: 'After fighting, units move up to 3" towards the enemy or an objective.',
        actor: 'both',
        checklist: [
          c('move', 'do', 'Units that fought can **consolidate up to 3"** towards the nearest enemy.'),
          c('objective', 'check', 'If no enemy is in reach but an **objective** is, they must move towards it.'),
          c('order', 'do', 'The **active player** consolidates all of theirs, then the opponent.'),
          c('lock', 'think', 'Consolidate into another enemy unit to **tie it up** in combat, or onto an **objective**.'),
        ],
        summary: ['Consolidation moves happen together after all fights.'],
        helper: 'consolidate',
      },
    ],
  },
  {
    id: 'end',
    name: 'End of turn',
    short: 'End',
    intro: 'Score victory points and get ready for the next turn.',
    steps: [
      {
        id: 'end-turn',
        title: 'End of turn and scoring',
        overview: 'Resolve end-of-turn rules, check objectives and score VP.',
        actor: 'active',
        checklist: [
          c('rules', 'do', 'Resolve rules that happen at the **end of the turn**.'),
          c('control', 'do', 'Check **objective control**: add up the **OC** of each player’s models in range of each marker. The higher total controls it.'),
          c('score', 'do', 'Score **primary** and **secondary** VP your mission gives now.'),
          c('cards', 'do', 'Discard or draw secondary missions as your mission pack says.'),
          c('shocked', 'check', 'Battle-shocked units count as **OC 0**.'),
          c('end', 'check', 'If both players have had a turn, the **battle round ends**. The battle ends after **round 5** unless the mission says otherwise.'),
          c('cp', 'think', 'Keep some **CP** for your opponent’s turn.'),
        ],
        summary: ['Write scores down as you go. The scoreboard at the top keeps a running total.'],
        helper: 'score',
      },
    ],
  },
];

export const MAX_ROUNDS = 5;

/** Short glossary for quick look-up in Play mode. */
export const GLOSSARY: { term: string; text: string }[] = [
  { term: 'Active player', text: 'The player whose turn it is. Most steps are for them, but the opponent still saves, fights back and can use Stratagems.' },
  { term: 'Engagement Range', text: 'Within 2" horizontally of an enemy model (and close enough vertically). Units in Engagement Range are “engaged”.' },
  { term: 'Critical Hit', text: 'An unmodified hit roll of 6. Triggers [SUSTAINED HITS] and [LETHAL HITS].' },
  { term: 'Critical Wound', text: 'An unmodified wound roll of 6 (or lower with [ANTI-X]). Triggers [DEVASTATING WOUNDS].' },
  { term: 'Mortal wounds', text: 'Damage with no hit, wound or save rolls. Excess damage carries over to other models.' },
  { term: 'Battle-shocked', text: 'OC becomes 0 and your own Stratagems cannot target the unit. Lasts until a later test is passed.' },
  { term: 'Half-strength', text: 'Half or fewer of the starting models remain, or a single model has half or fewer of its starting wounds. Check the exact threshold in the rulebook.' },
  { term: 'Objective Control (OC)', text: 'Add up the OC of each player’s models in range of an objective marker. The higher total controls it.' },
  { term: 'Invulnerable save', text: 'A save that is never modified by AP. Use it instead of the armour save if it is better.' },
  { term: 'Feel No Pain X+', text: 'Each time a model would lose a wound, roll a D6. On X+ that wound is not lost.' },
  { term: 'Benefit of cover', text: 'Ranged attacks against the unit have their BS worsened by 1, unless the weapon has [IGNORES COVER].' },
  { term: 'Re-rolls', text: 'A dice can never be re-rolled more than once. Re-rolls happen before modifiers are applied.' },
  { term: 'Modifiers', text: 'Hit and wound rolls: an unmodified 6 always succeeds and an unmodified 1 always fails.' },
  { term: 'Stratagems', text: 'Special actions paid for with CP. Normally each can be used once per phase, and each unit can be targeted by one per phase.' },
  { term: 'Hazard roll', text: 'A D6 rolled after using [HAZARDOUS] weapons or a Desperate Escape. Failures cause mortal wounds.' },
];

export function allSteps() {
  return TURN.flatMap((p) => p.steps.map((s) => ({ phase: p, step: s })));
}
