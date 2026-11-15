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

/** Casual games skip tournament-only procedure; matched play follows the event rules. */
export type PlayStyle = 'casual' | 'matched';

export interface ChecklistItem {
  id: string;
  kind: ChecklistKind;
  text: string;
  /** Only shown for this play style (both when omitted). */
  play?: PlayStyle;
}

/** Who makes the decisions in a step. */
export type Actor = 'active' | 'opponent' | 'both';

export interface Step {
  id: string;
  title: string;
  /** Only part of the game in this play style (both when omitted). */
  play?: PlayStyle;
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
  'This guidance is a short paraphrased reminder, checked against the 11th edition Core Rules and the Warhammer Event Companion. For exact wording, rare interactions and FAQs, use the official Core Rules and the Rules Appendix in the Warhammer 40,000 app. Unit and weapon rules come from your army data.';

const c = (id: string, kind: ChecklistKind, text: string, play?: PlayStyle): ChecklistItem => ({ id, kind, text, play });
/** Matched play (events / tournaments) only. */
const m = (id: string, kind: ChecklistKind, text: string) => c(id, kind, text, 'matched');
/** Casual play only. */
const k = (id: string, kind: ChecklistKind, text: string) => c(id, kind, text, 'casual');

export function applies(item: { play?: PlayStyle }, style: PlayStyle) {
  return !item.play || item.play === style;
}

/**
 * Pre-battle sequence. Matched play follows the order of the Warhammer Event
 * mission sequence; casual games skip the event-only steps.
 */
export const PRE_BATTLE: Step[] = [
  {
    id: 'muster',
    title: 'Muster armies',
    overview: 'Agree the size of the game and make sure both armies are ready.',
    actor: 'both',
    checklist: [
      c('size', 'do', 'Agree the **battle size** (points limit) with your opponent.'),
      k('small', 'think', 'Learning? A **small game** (around 500–1000 points) with a few units each is much easier to follow.'),
      c('lists', 'do', 'Show each other your **army lists**.'),
      c('warlord', 'do', 'Choose your **Warlord**.'),
      c('attach', 'do', 'Attach **Leader** and **Support** units to their **bodyguard** units, and say which ones.'),
      m('disposition', 'do', 'Choose one of your **Force Disposition** cards and record it on your roster.'),
      m('points', 'check', 'Each list is **legal**: within the points limit, built as the Warhammer 40,000 app allows, using the current points and rules updates.'),
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
    title: 'Determine mission',
    overview: 'Decide what you are fighting over and how victory points (VP) are scored.',
    actor: 'both',
    checklist: [
      k('agree', 'do', 'Agree a **mission**. For a first game, a simple one works well: hold more objectives than your opponent.'),
      k('cards', 'think', 'If you have a **mission deck**, you can use it as in matched play, or just pick cards you both like.'),
      m('primary', 'do', 'Find your **opponent’s Force Disposition symbol**. The Primary Mission listed against it is **your** Primary Mission.'),
      m('read', 'do', 'Read **both** Primary Missions so you know how each of you scores VP.'),
      c('when', 'check', 'Agree **when** VP are scored, for example in the Command phase or at the end of the turn.'),
      c('plan', 'think', 'Work out which objectives you can **realistically hold** each round.'),
    ],
    summary: ['Victory points decide the winner, not how many models you destroy. Keep the mission in mind every turn.'],
  },
  {
    id: 'layout',
    title: 'Determine a layout',
    play: 'matched',
    overview: 'Pick the terrain layout for this pair of Primary Missions.',
    actor: 'both',
    checklist: [
      m('abc', 'do', 'Each pair of Primary Missions has **layouts A, B and C** (in the Warhammer 40,000 app and the Event Companion). Use the one your event organiser says, or pick one at random.'),
      m('series', 'think', 'Events often cycle through the layouts in order across the rounds.'),
    ],
    summary: ['Layouts show where terrain, objectives and deployment zones go.'],
  },
  {
    id: 'battlefield',
    title: 'Create the battlefield',
    overview: 'Set up terrain and objectives.',
    actor: 'both',
    checklist: [
      m('table', 'do', 'Use a **44" × 60"** battlefield.'),
      m('areas', 'do', 'Set up the **terrain areas** shown on the layout, then the **terrain features** on them.'),
      k('table-casual', 'do', 'Use whatever table you have, and agree on its size.'),
      k('terrain', 'do', 'Set up plenty of **terrain**. Big pieces that block line of sight make the game better.'),
      c('objectives', 'do', 'Place the **objective markers**.'),
      c('areas-casual', 'check', 'Agree the boundary of each **terrain area** (a base or mat, or the space the pieces outline). Objectives are usually terrain areas.', 'casual'),
      c('agree', 'check', 'Agree each piece’s **category**:\n• **Exposed** (craters, debris).\n• **Light** (low walls, barricades): gives cover and blocks sight across its area.\n• **Dense** (ruins, buildings): blocks sight and slows big models.'),
      c('lanes', 'think', 'Spot the **firing lanes** and the places your units can **hide**.'),
    ],
    summary: ['Settling terrain questions now avoids arguments later.'],
  },
  {
    id: 'zones',
    title: 'Determine attacker and defender',
    overview: 'Pick battlefield edges, then roll off for Attacker and Defender.',
    actor: 'both',
    checklist: [
      c('edges', 'do', 'Agree which **battlefield edges** match the Attacker’s and Defender’s edges on the map.'),
      c('roll', 'do', '**Roll off**. The winner decides who is the **Attacker** and who is the **Defender**.'),
    ],
    summary: ['The map shows each player’s deployment zone and territory (the half of the battlefield containing their zone).'],
    dice: [{ label: 'Roll-off', expr: 'D6', note: 'Highest wins; re-roll ties' }],
  },
  {
    id: 'secondaries',
    title: 'Select secondary missions',
    overview: 'Secondary missions are extra ways to score VP.',
    actor: 'both',
    checklist: [
      k('skip', 'think', 'For your **first few games** you can skip secondary missions and just play the primary mission.'),
      c('choose', 'do', 'Secretly note whether you will use **Tactical** or **Fixed** secondary missions. If Fixed, note which **two**. Then reveal.'),
      c('fixed', 'check', '**Fixed**: your two cards are face-up and active **all game**, and can’t be discarded.'),
      c('tactical', 'check', '**Tactical**: shuffle your deck. You draw cards at the **start of each of your Command phases** (see the Command phase).'),
      c('which', 'think', 'Fixed is predictable. Tactical adapts, but you may draw cards you can’t achieve.'),
    ],
    summary: ['Secondary missions are checked at the end of **every** turn, for **both** players.'],
  },
  {
    id: 'formations',
    title: 'Declare battle formations',
    overview: 'Secretly note how your army starts the battle.',
    actor: 'both',
    checklist: [
      c('embark', 'do', 'Note which units start **embarked** in Transports.'),
      c('reserves', 'do', 'Note which units start in **Strategic Reserves**. All **AIRCRAFT** must start there.'),
      c('reveal', 'do', 'Reveal your choices.'),
      c('limit', 'check', 'Strategic Reserves (including units inside transports in reserves) can’t total more than **half** your army’s points limit.'),
      c('capacity', 'check', 'Units starting embarked must fit in the Transport’s **capacity**.'),
      c('deadline', 'check', 'Strategic Reserves must arrive by the **end of battle round 3** or they count as destroyed.'),
      c('fast', 'think', 'A fast unit kept in reserve can **grab an objective** late in the game.'),
    ],
    summary: ['Write it down: these choices are revealed at the end of this step.'],
    helper: 'deploy',
  },
  {
    id: 'deploy',
    title: 'Deploy armies',
    overview: 'Take turns placing units, one at a time.',
    actor: 'both',
    checklist: [
      c('alternate', 'do', 'Take turns setting up **one unit at a time**, starting with the **Defender**. Units in Strategic Reserves aren’t set up.'),
      c('wholly', 'check', 'Every model is **wholly within** your deployment zone (unless an ability such as **Infiltrators** says otherwise).'),
      c('titanic', 'check', 'After setting up a **TITANIC** unit, skip your next go.'),
      c('rest', 'check', 'Once you have finished, your opponent sets up all their remaining units.'),
      c('hide', 'think', 'Hide valuable units **out of sight** of enemy guns.'),
      c('screen', 'think', 'Spread cheap units out to **block landing spots** for enemy reserves.'),
    ],
    summary: ['**Infiltrators**: if every model has it, the unit can be set up anywhere more than **8"** from your opponent’s deployment zone and all enemy units.'],
  },
  {
    id: 'redeploy',
    title: 'Redeploy units',
    overview: 'Resolve rules that let you move units after deployment.',
    actor: 'both',
    checklist: [
      c('alternate', 'do', 'Players alternate resolving **redeploy** rules, starting with the **Attacker**.'),
      c('reserves', 'check', 'Units moved into Strategic Reserves here **don’t count** towards the reserves points limit.'),
    ],
    summary: ['Only some units have redeploy rules. If neither army has any, skip this step.'],
  },
  {
    id: 'first',
    title: 'Determine first turn',
    overview: 'Decide who takes the first turn of every battle round.',
    actor: 'both',
    checklist: [
      c('roll', 'do', '**Roll off**. The winner takes the **first turn** in every battle round.'),
      c('second', 'think', 'Going second lets you **react** to your opponent and often score last.'),
    ],
    summary: ['The battle lasts 5 battle rounds. Each round, both players take one turn.'],
    dice: [{ label: 'Roll-off', expr: 'D6' }],
    helper: 'firstTurn',
  },
  {
    id: 'prebattle',
    title: 'Resolve pre-battle rules',
    overview: 'Use abilities that happen before the first turn, such as Scouts moves.',
    actor: 'both',
    checklist: [
      c('alternate', 'do', 'Players alternate resolving **pre-battle rules**, starting with the player who takes the **first turn**.'),
      c('scouts', 'do', '**Scouts X"**: a unit wholly in your deployment zone can move up to X", ending more than **8"** from all enemy units. Instead, a Scouts unit in Strategic Reserves can be set up wholly within your deployment zone. A DEDICATED TRANSPORT whose passengers all have Scouts can also make the move.'),
      c('check', 'check', 'Read the abilities on your units. Check the **Abilities that may apply** list below.'),
    ],
    summary: ['After this step the first battle round begins.'],
    helper: 'abilities',
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
          c('round', 'do', 'First turn of a battle round? Resolve any **start of battle round** rules first.'),
          c('rules', 'do', 'Resolve any rules that happen at the **start of the turn**.'),
          c('plan-obj', 'think', 'Which **objectives** do you need to take or hold this turn?'),
          c('plan-kill', 'think', 'Which enemy units are the **biggest threats**, and which of your units can deal with them?'),
          c('plan-charge', 'think', 'Which units should **charge**? Don’t Advance them, and keep them within **12"** of their target.'),
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
        checklist: [
          c('abilities', 'do', 'Use any abilities that happen **at the start of your Command phase** (some give CP or buffs).'),
          c('draw', 'do', 'Using **Tactical** secondary missions? Draw two cards now (as your mission deck describes). They are active for you.'),
        ],
        summary: ['Check the **Abilities that may apply** list below if you loaded an army list.'],
        helper: 'abilities',
      },
      {
        id: 'cmd-cp',
        title: 'Gain Core CP',
        overview: 'Both players gain 1 Command Point (CP).',
        actor: 'both',
        checklist: [
          c('gain', 'do', '**Both players gain 1CP**, not just the active player.'),
          m('extra', 'check', 'Apart from this 1CP, each player can gain at most **1 extra CP per battle round** from all other rules, including discarding secondary missions.'),
          k('extra-casual', 'check', 'Gaining **extra CP** from other rules may be limited. Agree how you are handling it.'),
          c('save', 'think', 'Plan to keep **1–2CP** for reacting during your opponent’s turn.'),
        ],
        summary: [
          'You spend CP on **Stratagems**. You can’t use the same Stratagem more than once per phase, and a unit can’t be targeted by more than one Stratagem per phase.',
          'See **Core Stratagems** in the Glossary tab for what every army can use.',
        ],
        helper: 'cp',
      },
      {
        id: 'cmd-shock',
        title: 'Battle-shock',
        overview: 'Units that have suffered heavy losses test their nerve.',
        actor: 'active',
        checklist: [
          c('who', 'do', 'Find your units that are **at or below half-strength**, and units that are **already Battle-shocked**.'),
          c('roll', 'do', 'For each one, roll **2D6**. If the total is **equal to or more than** the unit’s **Ld** (the best Ld in the unit), it passes.'),
          c('mark', 'do', 'Units that fail are **Battle-shocked** (mark them with a token). A Battle-shocked unit that passes recovers.'),
          c('bravery', 'check', '**Insane Bravery** (1CP, once per battle): use it just before a roll to pass automatically. Your Stratagems can’t target a unit that is already Battle-shocked.'),
          c('effects', 'think', 'A Battle-shocked unit has **OC "–"**, so it can’t control objectives. Your Stratagems can’t target it, and it can’t start or finish **actions**.'),
        ],
        summary: [
          '**Starting strength** is the number of models in the unit at the start of the first battle round. An attached unit counts all of its models together.',
          '**At half-strength**: half of the starting models remain. For a single model, it has half of its W left. **Below**: fewer than that.',
          'Battle-shock lasts until the unit **passes a later roll**. It doesn’t wear off at the end of the turn.',
        ],
        dice: [{ label: 'Battle-shock roll', expr: '2D6', note: 'Pass on ≥ Ld' }],
        helper: 'battleshock',
        mistakes: ['Forgetting to re-test units that are already Battle-shocked.', 'Counting a Battle-shocked unit’s OC when checking objectives.'],
      },
      {
        id: 'cmd-abilities',
        title: 'Command abilities and end of phase',
        overview: 'Use Command phase abilities, then check your mission.',
        actor: 'active',
        checklist: [
          c('abilities', 'do', 'Resolve rules that happen **in** the Command phase (healing, orders, faction rules).'),
          c('end', 'do', 'At the **end** of the phase, resolve end-of-phase rules first, then **both players check their missions** for anything scored now.'),
          c('swap', 'check', '**Tactical** missions: **once per battle**, at the end of your Command phase, you can spend **1CP** to discard one active card and draw a new one.'),
        ],
        summary: ['Missions differ in when they score. Some score at the end of the Command phase, others at the end of the turn or battle round.'],
        helper: 'abilities',
      },
    ],
  },
  {
    id: 'movement',
    name: 'Movement phase',
    short: 'Move',
    intro: 'Every one of your units makes a move, even if it is to stay where it is.',
    steps: [
      {
        id: 'move-units',
        title: 'Move units (on the battlefield)',
        overview: 'Pick each unit in turn and choose how it moves.',
        actor: 'active',
        checklist: [
          c('every', 'do', 'Select **every unit** in your army, one at a time, including those in **reserves** or **embarked** (see the next step).'),
          c('choose', 'do', 'Choose a move type: **Remain stationary**, **Normal move** (up to M), **Advance** (M + D6) or, if engaged, **Fall back** (up to M).'),
          c('measure', 'do', 'Measure from the **closest part of the base**. Models can move through **friendly** models but not enemy ones.'),
          c('coherency', 'check', '**Coherency**: after moving, every model must be within **2"** of at least one other model in its unit, and within **9"** of every other model in it.'),
          c('engage', 'check', 'A Normal move or Advance must end **unengaged**: more than **2"** horizontally (or 5" vertically) from enemy models.'),
          c('advance', 'check', 'After an **Advance** the unit **can’t charge** or start an **action** this turn. It can only shoot with **[ASSAULT]** weapons.'),
          c('fallback', 'check', 'Fall back: an **Ordered Retreat** (only if not Battle-shocked) or a **Desperate Escape**. Desperate Escape: make a **hazard roll** for each model (each 1–2 is a mortal wound), the models may move through enemies, and the unit then takes a **Battle-shock roll** unless it is already Battle-shocked. Either way, the unit **can’t shoot, charge or start an action** this turn.'),
          c('terrain', 'check', 'Terrain: anyone can move through **exposed** and **light** terrain. Through **dense** terrain, only INFANTRY/BEASTS/SWARM/MOBILE can move freely. Other models can only pass sections up to 2" tall.'),
          c('fly', 'check', '**FLY**: declare **taking to the skies** before moving. Lose 2" of move, but ignore vertical distance and move over any models and terrain.'),
          c('mv', 'check', '**MONSTER/VEHICLE** models can make Normal moves and Advances through enemy models (but not other monsters or vehicles).'),
          c('objectives', 'think', 'End on **objectives**. An objective is usually a **terrain area**: be inside it. For a marker, be within 3".'),
          c('los', 'think', 'Stay **out of sight** of the enemy’s big guns, but **within range** of what you want to shoot.'),
          c('gaps', 'think', 'Don’t leave gaps more than 8" from your units where enemy reserves can arrive.'),
        ],
        summary: [
          '**[HEAVY]** weapons get +1 to hit if no model in the unit moved more than **3"** this turn (and it wasn’t set up this turn).',
          'A move that can’t end legally (coherency, ending on top of another model, its “after moving” conditions) can’t be made, and the models go back.',
        ],
        dice: [
          { label: 'Advance', expr: 'D6', note: 'Add to M this move' },
          { label: 'Hazard roll', expr: 'D6', target: 3, note: 'A 1–2 fails: 1 mortal wound (3 if MONSTER/VEHICLE)' },
        ],
        helper: 'move',
        mistakes: ['Advancing a unit you wanted to charge with.', 'Measuring from the middle of the base instead of the edge.', 'Leaving a unit out of coherency (models are removed at the end of the turn).'],
      },
      {
        id: 'move-reserves',
        title: 'Move units (reserves and transports)',
        overview: 'Still part of moving units: bring in reserves and disembark from transports.',
        actor: 'active',
        checklist: [
          c('round2', 'check', 'Strategic Reserves can only arrive from **battle round 2** onwards.'),
          c('ingress', 'do', '**Ingress move**: set the unit up wholly within **6" of a battlefield edge** and **more than 8" from all enemy units**. Before round 3, not in your opponent’s deployment zone.'),
          c('deepstrike', 'do', '**Deep Strike**: set up **anywhere more than 8" from all enemy units**, even in your opponent’s deployment zone.'),
          c('after', 'check', 'After an ingress move the unit can’t make another move until your **next Charge phase**, so it can still **charge**.'),
          c('disembark', 'do', '**Disembark** from a Transport that hasn’t Advanced or Fallen Back:\n• **Rapid**: the Transport moved. Set up within 3"; the unit can’t charge.\n• **Tactical**: the Transport stayed still or hasn’t moved yet. Set up within 3", then make a Normal move or Advance.\n• **Combat**: otherwise. Set up within 6", hazard roll per model; the unit is Battle-shocked and can’t charge.'),
          c('embark', 'do', '**Embark**: after a Normal move, Advance or Fall back, a unit wholly within 3" of a friendly Transport can get in (if there is room and it wasn’t set up this turn).'),
          c('deadline', 'check', 'Strategic Reserves that haven’t arrived by the **end of battle round 3** are destroyed (units in Transports that arrived are fine).'),
          c('where', 'think', 'Arrive where the unit can **shoot, charge or take an objective** without being easily destroyed.'),
        ],
        summary: [
          'If a Transport is destroyed, its passengers make an **emergency disembark**: hazard roll per model, set up within 6", and the unit is Battle-shocked and can’t charge.',
          '**Aircraft** start in Strategic Reserves, can only make ingress moves, and go back into reserves at the end of your opponent’s turn.',
        ],
        dice: [{ label: 'Hazard roll', expr: 'D6', target: 3, note: 'A 1–2 fails' }],
        helper: 'reserves',
        reactions: [
          'At the **end of your Movement phase** your opponent may use **Fire Overwatch** (1CP). One of their unengaged units snap-shoots at one visible enemy within 24", hitting only on unmodified 6s.',
          'Also at the end of your Movement phase: **Rapid Ingress** (1CP, not in round 1). One of their Strategic Reserves units arrives.',
        ],
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
        overview: 'Pick a unit, choose its shooting type, then pick targets for its weapons.',
        actor: 'active',
        checklist: [
          c('pick', 'do', 'Pick **one unit** that hasn’t shot yet. Units that **Fell Back** can’t shoot.'),
          c('type', 'do', 'Choose its **shooting type**: Normal, Assault, Close-quarters or Indirect (see Rules detail).'),
          c('weapons', 'do', 'For each model, pick which ranged weapons fire and a **target for each weapon**. Different weapons can target different units.'),
          c('target', 'check', 'Each target must be **visible** to the firing model, **within range**, and **unengaged**. Engaged MONSTER/VEHICLE targets can be shot at −1 to hit.'),
          c('visible', 'check', '**Visible**: a 1mm-wide line can be drawn from any part of the model to any part of the target. **Obscuring** terrain areas (with light or dense terrain) block sight across them. **Hidden** infantry in dense terrain can only be seen from within **15"**.'),
          c('threat', 'think', 'Shoot the **most dangerous** enemy, or the one standing on an objective you need.'),
          c('match', 'think', 'Match weapons to targets: **high S/AP/D** at tough targets, **many shots** at hordes. Use the attack calculator to compare.'),
        ],
        summary: [
          '**Normal shooting**: the unit is unengaged and didn’t Advance.',
          '**Assault shooting**: the unit is unengaged and Advanced. Only **[ASSAULT]** weapons can fire.',
          '**Close-quarters shooting**: the unit is engaged and didn’t Advance, and has **[CLOSE-QUARTERS]/[PISTOL]** weapons or is a MONSTER/VEHICLE. It can target units it is engaged with. Non-MONSTER/VEHICLE models can only use their close-quarters weapons. MONSTER/VEHICLE models are −1 to hit with other weapons, and **[BLAST]** can’t target a unit they are engaged with.',
          '**Indirect shooting**: the unit is unengaged, didn’t Advance and has **[INDIRECT FIRE]** weapons. Those weapons can target units that aren’t visible. The target counts as in **cover**, hit rolls can’t be re-rolled, and unmodified hit rolls of **1–5 fail**. If the unit remained stationary and the target is visible to a friendly unit, only **1–3** fail.',
          'A unit that shoots can’t start an **action** afterwards in that phase.',
        ],
        helper: 'shoot',
        reactions: ['At the **start of your Shooting phase** your opponent may use **Smokescreen** (1CP) on a SMOKE unit, giving it (and units it hides) the benefit of cover.'],
      },
      {
        id: 'shoot-resolve',
        title: 'Resolve attacks',
        overview: 'Roll to hit and to wound, the defender rolls saves, then damage is dealt.',
        actor: 'both',
        checklist: [
          c('dice', 'do', 'Gather **attack dice**: one D6 per attack (the weapon’s **A**). Weapons with the same BS, S, AP, D and abilities can be rolled together.'),
          c('hit', 'do', '**Hit roll**: an unmodified **1 fails**, an unmodified **6 is a Critical Hit**, otherwise you need **BS or more**.'),
          c('wound', 'do', '**Wound roll**: compare **S** with the target’s **T** (table in Rules detail). An unmodified 1 fails; an unmodified 6 is a **Critical Wound**.'),
          c('save', 'do', '**Saves**: the defender rolls **all** save dice together, then resolves them from the **lowest result up**.'),
          c('groups', 'do', 'The defender splits the unit into **allocation groups** and puts them in order: each **CHARACTER** is its own group and goes **last**; a group with a **wounded** model goes **first**.'),
          c('result', 'do', 'Each save die, lowest first, is checked against the current group: an unmodified 1 deals damage; ≥ the **invulnerable save** fails to hurt; or after applying **AP**, ≥ the **Sv** fails to hurt. Otherwise a wounded model (if any) in that group loses **D** wounds.'),
          c('cover', 'check', '**Benefit of cover** (BS worse by 1): if **every** model is INFANTRY/BEASTS/SWARM inside a terrain area, or isn’t fully visible because of terrain. **[IGNORES COVER]** cancels it.'),
          c('plunging', 'check', '**Plunging fire**: +1 BS if the shooter is on terrain 3" or higher (or is TOWERING and within 12") and the target has models at ground level.'),
          c('abilities', 'check', 'Weapon abilities: **[SUSTAINED HITS]**, **[LETHAL HITS]**, **[DEVASTATING WOUNDS]**, **[RAPID FIRE]**/**[MELTA]** at half range, **[HEAVY]** if it moved 3" or less, **[BLAST]**…'),
          c('fnp', 'check', '**Feel No Pain**: the defender rolls for each wound a model would lose.'),
          c('hazard', 'check', 'After the unit has shot, make a **hazard roll** for each **[HAZARDOUS]** weapon used (each 1–2 is a mortal wound).'),
        ],
        summary: [
          'Wound roll: S ≥ 2×T → **2+** · S > T → **3+** · S = T → **4+** · S < T → **5+** · S ≤ ½T → **6+**.',
          'Excess damage from one attack is lost when its model dies. Normal damage is resolved before mortal wounds.',
          '**Mortal wounds** skip all rolls and are dealt 1 wound at a time: wounded non-characters first, characters last. Mortal wounds from **[DEVASTATING WOUNDS]** can only damage **one model** per Critical Wound.',
          'Attacking an **attached unit** uses the highest **T** of its bodyguard models.',
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
          'Shooting at an enemy unit that is engaged (only allowed if it is a MONSTER/VEHICLE, at −1 to hit, or with close-quarters shooting).',
          'Forgetting the BS penalty for cover, or [HEAVY]’s +1 when the unit moved 3" or less.',
          'Letting [DEVASTATING WOUNDS] damage spill over to a second model.',
        ],
      },
    ],
  },
  {
    id: 'charge',
    name: 'Charge phase',
    short: 'Charge',
    intro: 'Units move into combat so they can fight, and strike first, in the Fight phase.',
    steps: [
      {
        id: 'charge-declare',
        title: 'Charge',
        overview: 'Declare a charge, roll 2D6 for the distance, then move into combat.',
        actor: 'active',
        checklist: [
          c('eligible', 'check', 'The unit is **within 12"** of an enemy, **not engaged**, didn’t **Advance or Fall back**, and hasn’t started an **action**.'),
          c('declare', 'do', 'Declare a charge with the unit, then roll **2D6**. That is its **maximum charge distance**.'),
          c('targets', 'do', 'If you can (and want to) make the charge move, pick **charge targets**: enemy units within 12" **and** within the rolled distance.'),
          c('move', 'do', 'Move each model up to the rolled distance, ending **closer** to a target. Models that can end within **1"** of a target must, and models that can end **engaged** must.'),
          c('after', 'check', 'The unit must end **engaged with every target**, and **not engaged** with any unit that isn’t a target. Otherwise the charge fails and it doesn’t move.'),
          c('first', 'check', 'A unit that charges has **Fights First** until the end of the turn.'),
          c('two', 'check', 'A roll of **2** can never succeed, because the unit couldn’t get within 2".'),
          c('reroll', 'think', 'A poor roll can be re-rolled with **Command Re-roll** (1CP). Both dice are re-rolled.'),
          c('crush', 'think', 'MONSTER/VEHICLE units that finish a charge can use **Crushing Impact** (1CP) to inflict mortal wounds.'),
          c('contest', 'think', 'Charging an enemy on an objective **contests** it.'),
        ],
        summary: ['Units that charged gain charge bonuses this turn (for example **[LANCE]**: +1 to wound).'],
        dice: [{ label: 'Charge roll', expr: '2D6', note: 'Max distance in inches' }],
        helper: 'charge',
        reactions: [
          'At the **end of your Charge phase** your opponent may use **Heroic Intervention** (1CP, or +1CP for Into the Fray). One of their unengaged units within 12" of the enemy declares a charge.',
        ],
        mistakes: ['Charging with a unit that Advanced.', 'Picking a target that is further than the rolled distance.', 'Ending the charge engaged with a unit you didn’t declare.'],
      },
    ],
  },
  {
    id: 'fight',
    name: 'Fight phase',
    short: 'Fight',
    intro: 'Units in combat attack with their melee weapons. Both players’ units fight.',
    steps: [
      {
        id: 'fight-pilein',
        title: 'Pile in',
        overview: 'Units in combat (or that charged) can move up to 3" closer.',
        actor: 'both',
        checklist: [
          c('active', 'do', 'The **active player** makes pile-in moves with their eligible units first, then the **opponent**. Piling in is optional.'),
          c('eligible', 'check', 'Eligible: the unit is **engaged**, **charged this turn**, or was picked for an **overrun fight**.'),
          c('targets', 'check', 'Pile in towards **every enemy it is engaged with**. If not engaged, pile in towards enemy units within **5"**.'),
          c('move', 'check', 'Up to **3"** per model. Models already in **base contact** with an enemy don’t move. Each moving model ends closer to the closest target, and **engaged** if possible.'),
          c('more', 'think', 'Pile in so as many models as possible are engaged and able to **fight**.'),
        ],
        summary: ['Afterwards the unit must be engaged, and models that started engaged with an enemy must still be engaged with it.'],
        helper: 'pilein',
      },
      {
        id: 'fight-fight',
        title: 'Fight',
        overview: 'Units take turns to attack in melee.',
        actor: 'both',
        checklist: [
          c('eligible', 'check', 'Eligible to fight: units that are **engaged** (or were at the start of this step) or that **charged** this turn. **Every eligible unit must fight.**'),
          c('first', 'do', '**Fights First** units (including every unit that **charged**) fight first. Players alternate picking one, starting with the **active player**.'),
          c('rest', 'do', 'Then the **remaining** units alternate, starting with the player who moved the sequence on.'),
          c('weapon', 'do', 'Each model picks **one** melee weapon (plus any **[EXTRA ATTACKS]** weapons) and can only target units it is **engaged** with. Attacks can be split between targets.'),
          c('resolve', 'do', 'Resolve attacks as in shooting: hit with **WS**, wound, saves, damage.'),
          c('overrun', 'check', '**Overrun fight**: a unit that is unengaged when picked (or became engaged during this step) makes an extra pile-in move, then fights.'),
          c('pass', 'check', 'If all your eligible units are more than **5"** from every enemy, you can pass.'),
          c('hazard', 'check', 'Hazard rolls for **[HAZARDOUS]** melee weapons after the unit has fought.'),
          c('order', 'think', 'Choose your **most important fight first**, before the enemy can kill your models.'),
        ],
        summary: ['After a non-Fights-First fight, if any Fights First unit is now eligible, go back to resolving Fights First units.'],
        dice: [
          { label: 'Hit rolls', expr: 'D6' },
          { label: 'Wound rolls', expr: 'D6' },
          { label: 'Saves', expr: 'D6' },
        ],
        helper: 'fight',
        reactions: [
          '**Counteroffensive** (2CP): just after one of your units has fought, your opponent can make one of theirs fight next.',
          '**Epic Challenge** (1CP): when a CHARACTER unit is picked to fight, one CHARACTER model’s melee weapons gain **[PRECISION]**.',
        ],
        mistakes: ['Forgetting that the opponent’s units in combat also fight.', 'Forgetting that units that charged have Fights First.', 'Attacking with a model that isn’t engaged with the target.'],
      },
      {
        id: 'fight-consolidate',
        title: 'Consolidate',
        overview: 'Units that fought can move up to 3".',
        actor: 'both',
        checklist: [
          c('order', 'do', 'The **active player** consolidates first, then the **opponent**. Consolidating is optional.'),
          c('modes', 'check', 'Pick the first mode that applies:\n• **Still engaged**: move towards every enemy you are engaged with.\n• **Enemy within 3"**: move to engage one or more of them.\n• **Objective within 3"**: move into range of it.'),
          c('move', 'check', 'Up to **3"**. Models in base contact with an enemy don’t move.'),
          c('new', 'think', 'Consolidating into enemy units that **haven’t fought** forces them to fight you now. Be careful.'),
          c('lock', 'think', 'Consolidate onto an **objective**, or into an enemy to tie it up.'),
        ],
        summary: ['Each unit can make only one consolidation move.'],
        helper: 'consolidate',
      },
    ],
  },
  {
    id: 'end',
    name: 'End of turn',
    short: 'End',
    intro: 'Tidy up, check objectives and score victory points.',
    steps: [
      {
        id: 'end-turn',
        title: 'End of turn and scoring',
        overview: 'Resolve end-of-turn rules, then check missions and score VP.',
        actor: 'both',
        checklist: [
          c('rules', 'do', 'Resolve rules that happen at the **end of the turn** (not mission rules).'),
          c('coherency', 'do', 'Units **out of coherency** must remove models until they are back in coherency.'),
          c('control', 'do', 'Check **objective control**: add up the **OC** of each player’s models within range of each objective. Higher total controls it. A tie means nobody controls it, unless it is **secured**.'),
          c('primary', 'do', '**Both players** check their missions: score **primary** VP if your Primary Mission scores now.'),
          c('secondary', 'do', '**Both players**, starting with the active player, score **secondary missions** achieved. With Tactical missions, discard each one you achieve.'),
          c('discard', 'do', 'Active player with Tactical missions: you can **discard** active secondaries you don’t want, gaining **1CP**.'),
          c('roundend', 'do', 'Second player’s turn? Resolve **end of battle round** rules, then missions again.'),
          c('shocked', 'check', 'Battle-shocked units have **OC "–"**.'),
          m('caps', 'check', 'VP limits: **primary** up to **45VP** (max **15** per battle round); **secondary** up to **45VP** (max **15** per round, and **20** per Fixed card). VP over a limit are lost.'),
          c('end', 'check', 'The battle ends after **battle round 5**. Players keep taking turns even if one army has been wiped out.'),
          c('cp', 'think', 'Keep some **CP** for your opponent’s turn.'),
        ],
        summary: [
          'Objective control is actually checked at the **end of every phase** and turn, so a unit moving off an objective mid-turn can lose it.',
          'An objective is normally a **terrain area**: models inside it are in range. For a marker (not on a terrain area), models within 3" horizontally and 5" vertically are in range.',
          'A **secured** objective stays yours, even with no units on it, until your opponent’s level of control is higher at the end of a phase.',
          'At the end of the battle, the player with the most VP wins. Equal VP is a draw.',
        ],
        helper: 'score',
      },
    ],
  },
];

/** The core stratagems every army can use, in brief (own wording; see the Core Rules for the full text). */
export const CORE_STRATAGEMS: { name: string; cp: string; when: string; effect: string }[] = [
  { name: 'Command Re-roll', cp: '1CP', when: 'Any phase, just after you make an Advance, charge, damage, hazard, hit, save or wound roll (or roll for number of attacks).', effect: 'Re-roll it. A charge roll is re-rolled in full.' },
  { name: 'Insane Bravery', cp: '1CP', when: 'Your Battle-shock step, just before a Battle-shock roll.', effect: 'The roll automatically passes. Once per battle.' },
  { name: 'Epic Challenge', cp: '1CP', when: 'Fight phase, when a friendly CHARACTER unit is picked to fight.', effect: 'One CHARACTER model’s melee weapons gain [PRECISION] this phase.' },
  { name: 'Explosives', cp: '1CP', when: 'Your Shooting phase.', effect: 'An unengaged EXPLOSIVES/GRENADES unit that can shoot and didn’t Advance picks a visible enemy within 8". Roll six D6: each 4+ is a mortal wound.' },
  { name: 'Crushing Impact', cp: '1CP', when: 'Your Charge phase, just after a MONSTER/VEHICLE unit ends a charge move.', effect: 'Pick an enemy it is engaged with and roll D6s equal to one of its models’ T. Each 1 hurts your unit; each 5+ is a mortal wound on the enemy (max 6).' },
  { name: 'Rapid Ingress', cp: '1CP', when: 'End of your opponent’s Movement phase (not in battle round 1).', effect: 'One of your Strategic Reserves units (not AIRCRAFT) makes an ingress move.' },
  { name: 'Fire Overwatch', cp: '1CP', when: 'End of your opponent’s Movement phase.', effect: 'One unengaged unit (not TITANIC) snap-shoots one visible enemy within 24". It only hits on unmodified 6s, and hit rolls can’t be re-rolled.' },
  { name: 'Smokescreen', cp: '1CP', when: 'Start of your opponent’s Shooting phase.', effect: 'Your SMOKE unit, and units it hides, have the benefit of cover this phase.' },
  { name: 'Heroic Intervention', cp: '1CP (+1CP)', when: 'End of your opponent’s Charge phase.', effect: 'One unengaged unit within 12" of enemies charges. VEHICLES only if they are CHARACTERS or WALKERS. It can only target units that charged, or, for +1CP, any enemy within 6" with the roll capped at 6.' },
  { name: 'Counteroffensive', cp: '2CP', when: 'Your opponent’s Fight phase, just after an enemy unit has fought.', effect: 'One of your units that can fight gets Fights First and must fight next.' },
];

export const MAX_ROUNDS = 5;

/** What changes between a casual game and matched (event / tournament) play. */
export const PLAY_STYLES: { style: PlayStyle; title: string; blurb: string; points: string[] }[] = [
  {
    style: 'casual',
    title: 'Casual game',
    blurb: 'A friendly game at home or the club. Play the core rules, agree everything else with your opponent, and keep it moving.',
    points: [
      'The **core rules** are the same as in matched play: turn order, the attack sequence, objectives and OC, Battle-shock, CP and Stratagems.',
      'Agree the **mission and table** together. Any table size and terrain you like is fine. Use plenty of line-of-sight-blocking terrain.',
      'For your first games, play **small** (around 500–1000 points) and skip **secondary missions**.',
      'You can ignore event extras: Force Disposition cards, terrain layouts, VP caps, the extra-CP limit and Battle Ready VP. Use any you both like.',
      'If you hit a rules question you can’t settle, **roll off** and look it up after the game.',
    ],
  },
  {
    style: 'matched',
    title: 'Matched play / event',
    blurb: 'Tournaments and organised events, following the Warhammer Event Companion.',
    points: [
      '**Lists must be legal**: within the points limit, using the current points and rules updates (the Warhammer 40,000 app is the reference).',
      '**Missions** come from the Chapter Approved Mission Deck. Your Primary Mission is set by your **opponent’s Force Disposition** card.',
      'The battlefield is **44" × 60"**, using the event **terrain layout** (A, B or C) for your missions.',
      '**Secondary missions**: choose Tactical or two Fixed missions before the battle.',
      '**Primary VP**: up to 45VP, max 15 per battle round.',
      '**Secondary VP**: up to 45VP, max 15 per battle round, and 20 per Fixed card.',
      '**Battle Ready** (painted) army: +10VP.',
      '**CP**: apart from the 1CP each Command phase, at most **1 extra CP per battle round**.',
      'The pre-battle steps follow a set order (Defender deploys first, Attacker redeploys first, and so on).',
      'Rules questions: the app’s **Rules Appendix**, errata, FAQs and rules updates decide them.',
    ],
  },
];

/** Short glossary for quick look-up in Play mode. */
export const GLOSSARY: { term: string; text: string }[] = [
  { term: 'Active player', text: 'The player whose turn it is. When a unit is moving, shooting or fighting, its controller is the active player until that is done.' },
  { term: 'Engagement Range / engaged', text: 'Within 2" horizontally and 5" vertically of an enemy model. Units with models in Engagement Range of each other are engaged.' },
  { term: 'Coherency', text: 'Every model must be within 2" (and 5" vertically) of at least one other model in its unit, and within 9" of every other model. At the end of each turn, units out of coherency remove models until they are back in it.' },
  { term: 'Starting strength', text: 'The number of models in a unit at the start of the first battle round (an attached unit counts all its models).' },
  { term: 'Half-strength', text: 'At half-strength: half the starting models are left (a single model: half its W). Below: fewer than that. Battle-shock rolls are taken at or below half-strength.' },
  { term: 'Battle-shocked', text: 'Its OC becomes "–", your Stratagems can’t target it, and it can’t start or complete actions. Lasts until it passes a later Battle-shock roll.' },
  { term: 'Leadership / Battle-shock roll', text: 'Roll 2D6: equal to or more than the unit’s Ld passes.' },
  { term: 'Objectives', text: 'Usually a terrain area: models inside it are in range. Markers that aren’t on a terrain area count models within 3" horizontally and 5" vertically. Add up OC in range at the end of each phase and turn. Higher total controls it; a tie means nobody controls it unless it is secured.' },
  { term: 'Critical Hit', text: 'An unmodified hit roll of 6. Triggers [SUSTAINED HITS] and [LETHAL HITS].' },
  { term: 'Critical Wound', text: 'An unmodified wound roll of 6 (or lower with [ANTI-X]). Triggers [DEVASTATING WOUNDS].' },
  { term: 'Saves and allocation', text: 'The defender rolls all saves together, then resolves them from the lowest result up. Each CHARACTER is its own allocation group and goes last; a group with a wounded model goes first.' },
  { term: 'Invulnerable save', text: 'Not affected by AP. If a save roll is equal to or more than the InSv, the attack fails.' },
  { term: 'Mortal wounds', text: 'No hit, wound or save rolls. Dealt one wound at a time: wounded non-characters first, characters last. Resolved after normal damage.' },
  { term: 'Hazard roll', text: 'Roll a D6: on a 1–2 the unit suffers 1 mortal wound (3 if every model is a MONSTER/VEHICLE).' },
  { term: 'Feel No Pain X+', text: 'Each time a model would lose a wound, roll a D6. On X+ that wound is not lost.' },
  { term: 'Benefit of cover', text: 'If every model in the target is INFANTRY/BEASTS/SWARM inside a terrain area, or not fully visible because of terrain, ranged attacks have their BS worsened by 1 (not with [IGNORES COVER]).' },
  { term: 'Visible / fully visible', text: 'Visible: a 1mm-wide line can be drawn from the shooter to any part of the target model. Fully visible: every part facing the shooter can be seen.' },
  { term: 'Obscuring / Solid / Hidden', text: 'Obscuring: terrain areas with light or dense terrain block sight across them, unless one of the models is inside. Solid: you can’t see through small gaps in dense terrain 3" or less from the ground. Hidden: INFANTRY/BEASTS/SWARM in an area with dense terrain that didn’t shoot this turn or last turn can only be seen from within 15".' },
  { term: 'Plunging fire', text: '+1 BS against a target at ground level when shooting from terrain 3" or higher, or as a TOWERING model within 12".' },
  { term: 'Actions', text: 'Can’t be started by units that are Battle-shocked, engaged, have OC 0, Advanced or Fell Back. A unit that starts one can’t shoot or charge that turn. Moving (other than piling in or consolidating) cancels it.' },
  { term: 'Stratagems', text: 'Cost CP. You can’t use the same one twice in a phase, and a unit can’t be targeted by more than one per phase.' },
  { term: 'Re-rolls', text: 'A dice can never be re-rolled more than once. Re-rolls happen before modifiers are applied.' },
];

export function allSteps() {
  return TURN.flatMap((p) => p.steps.map((s) => ({ phase: p, step: s })));
}
