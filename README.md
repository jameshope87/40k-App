# Muster & Battle: a Warhammer 40,000 list builder and game companion

An unofficial web app, also packaged for Android, for:

1. **Building army lists** from the community-maintained [BSData](https://github.com/BSData) catalogues. This is the same data BattleScribe and New Recruit use, and it covers every faction.
2. **Playing a game step by step.** The app walks both players through every step of the battle:
   - a short rules summary for the current step
   - which dice to roll, with one-tap dice buttons
   - abilities from your army that may apply right now
   - an attack helper that rolls hits, wounds, saves and damage one stage at a time and tracks casualties

It runs in any modern browser, installs as a PWA (offline capable) and builds as a native Android app with Capacitor.

> Unofficial fan-made tool, not affiliated with or endorsed by Games Workshop. Warhammer 40,000 is a trademark of Games Workshop. No rules text is bundled with the app. Unit, weapon and ability text is downloaded from BSData at runtime. The turn-by-turn summaries in Play mode are short paraphrased reminders written for this app. Always check the official Core Rules.

## Features

### List builder
- Choose a data source. The default is `BSData/wh40k-11e` (11th edition). `BSData/wh40k-10e` and any custom BSData-format repo also work.
- Pick a faction, then add units grouped by battlefield role, with search.
- Configure options: model counts, wargear choices, enhancements, warlord, detachment, battle size.
- **Model loadouts:** split models off a squad ("Split off 1") so they can take different wargear, e.g. 4× chainsword + 1× eviscerator. Groups with identical wargear can be merged back.
- Live points total against the battle-size limit, including the extra cost of repeat copies of a unit ("Requisition Thresholds") where the data defines it.
- Validation driven entirely by the data: min/max constraints, per-unit wargear limits (e.g. max 2 eviscerators in the unit), data-defined rules such as "Max 1 per 5 models", detachment points, enhancement limits, required characters and more.
- A datasheet for every unit: stats, ranged and melee weapons, abilities, rules and keywords.
- **Leader / Support attachments:** attach characters to their bodyguard units.
  - Only units the data says are eligible are offered.
  - The "one Leader and one Support per bodyguard" limits are checked.
  - Abilities that depend on an attached character (for example Feel No Pain 5+ with a Technomancer) switch on automatically.
- Rename, duplicate and remove units. Copy the list as text, or export/import it as JSON.
- **Unit photos:** take or choose photos of your painted models.
  - By default a photo is shown for every unit of that datasheet. You can also give one unit its own photo.
  - Photos are shrunk on the device (about 1280px JPEG) and stored in its built-in database (IndexedDB).
  - They appear on unit cards and in Play mode.

### Backup & restore
- One file holds all army lists, games, settings and photos.
- In the Android app it opens the share screen, so you can save it straight to Google Drive, Files or email. In a browser it downloads.
- **Restore** either *merges* (keeps the most recently edited copy of each list and game) or *replaces* everything. It also accepts a single exported list.
- The home screen reminds you if you haven't backed up for 14 days.
- Records are merged by `uid` and `updatedAt`, ready for future cloud sync.
- Catalogues are cached in IndexedDB, so the app works offline once a faction has been opened. You can also load `.json`/`.cat`/`.gst` files from your device.

### Play mode
- **Attached units** act as one unit: one move, one Battle-shock test, one charge. They shoot and fight with every member's weapons, and are listed together. Attacks against them use the bodyguard's profile. The attached characters can also be picked as targets on their own, for [PRECISION]. When the bodyguard is destroyed, its characters carry on as separate units.
- **Pre-battle checklist:** muster, mission, battlefield, attacker/defender, battle formations (mark units in reserves), deployment, pre-battle abilities, first turn.
- **Turn flow:** Start of turn → Command → Movement → Shooting → Charge → Fight → End of turn, for 5 battle rounds.
- Each step shows a rules summary, dice calls, "watch for" stratagem reminders and an interactive helper:
  - **Command:** gain CP for both players, and Battle-shock tests (2D6 vs Ld) for units at half strength or already shocked.
  - **Movement:** record each unit's move (stationary, normal, Advance with an automatic D6, Fall Back), and bring units in from reserves.
  - **Shooting / Fight:** attack helper per unit (see below).
  - **Charge:** 2D6 charge rolls, and marks units that charged (for Lance and similar effects).
  - **End of turn:** quick buttons for primary and secondary VP.
- **Attack helper:** pick a weapon and a target (from the opponent's list, or custom stats). It works out:
  - hit, wound (S vs T), save (AP vs armour, or the invulnerable save) and damage
  - Torrent, Lethal Hits, Sustained Hits, Devastating Wounds, Twin-linked, Anti-X, Blast, Rapid Fire, Melta, Heavy, Lance, Ignores Cover, cover, re-rolls, ±1 modifiers and Feel No Pain
  - the expected damage and the chance to destroy the unit

  Then roll **step by step** (or all at once) and apply the casualties.
- Scoreboard with CP and VP, a per-unit wound and status tracker, a game log, a glossary, and a floating dice roller.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests
npm run build      # production build in dist/
```

The first time you create a list, the app downloads the game system file and the faction's catalogues from GitHub (`raw.githubusercontent.com`). After that they are cached on the device.

### Web hosting

`dist/` is a static site with relative paths, so it works on any static host. `.github/workflows/pages.yml` deploys it to GitHub Pages. Enable it under **Settings → Pages → Source: GitHub Actions**.

### Android

The `android/` folder is a [Capacitor](https://capacitorjs.com) project that wraps the web build.

- **Without installing anything:** run the **Android APK** workflow (`.github/workflows/android.yml`) from the Actions tab. When it finishes, download `muster-debug-apk` from the run's artifacts and install it on your phone. You need to allow installing from unknown sources.
- **With Android Studio** (JDK 21 and the Android SDK required):
  ```bash
  npm run android:sync   # build the web app and copy it into android/
  npm run android:open   # open the project in Android Studio, then Run ▶
  ```

## How it works

| Area | Files |
| --- | --- |
| BSData download, caching, XML→JSON | `src/bsdata/loader.ts`, `src/bsdata/xml.ts` |
| Resolving entries, links, profiles and rules into a node tree | `src/bsdata/index.ts` |
| Rules engine: modifiers, conditions, repeats, constraints, costs, validation, default selections | `src/bsdata/engine.ts` |
| Roster model, editing operations, datasheet extraction | `src/roster/*` |
| Play mode: phases and step summaries (edit these to correct or extend the reminders) | `src/play/rules.ts` |
| Dice, attack sequence and Monte-Carlo estimates | `src/play/dice.ts`, `src/play/attack.ts` |
| Game state and turn flow | `src/play/game.ts` |
| UI (React) | `src/ui/**` |

To test the engine against a local checkout of a BSData repo:

```bash
git clone --depth 1 https://github.com/BSData/wh40k-11e /tmp/wh40k-11e
BSDATA_DIR=/tmp/wh40k-11e BSDATA_CAT=Necrons npx vitest run integration
```

## Known limitations / ideas for next steps

- The rules engine covers the commonly used subset of the BattleScribe format. Rarer features are not implemented:
  - New Recruit's `affects` modifiers
  - profile characteristic modifiers
  - percentage constraints
  - in-unit associations (such as icons or instruments assigned to models)
- In Play mode, damage to an attached unit is applied to the bodyguard. Pick the character as the target when attacks can be allocated to it.
- The Play-mode summaries follow the 11th edition turn structure as a quick reference. They are deliberately brief, and some edge cases are left to the rulebook.
- Planned: accounts with cloud sync (Supabase), building on the backup format.
- Ideas: shared game sessions between two phones, mission and secondary card tracking, Crusade support, importing New Recruit / BattleScribe `.rosz` files.
