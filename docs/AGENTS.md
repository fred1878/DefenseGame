# Agent guide — DefenseGame

Code-only top-down real-time action RPG: **town by day**, **defend the settlement by night**. No game editor. Work is TypeScript + JSON.

**Stack:** Phaser 4 · Vite · TypeScript · Vitest · Playwright. Installable PWA on the Pages build; **Android APK** on GitHub Releases (Capacitor; iOS / stores not yet). Playable build: https://fred1878.github.io/DefenseGame/

## Product loop

BootScene (load `public/data/*.json` + assets, restore save) → TownScene (upgrades, start night) → DefenseScene (real-time waves, wall HP) → TownScene.

**Invariant:** defense code never edits town state (gold, buildings, gear) field by field. At night end, `scenes/defense/DefenseNightEnd.ts` calls the pure rules in `systems/nightEndRules.ts` once (`resolveCampaignNightEndSave` → `resolveCampaignNightEnd` → `applyNightResultDetailed` in `core/save/GameState.ts`, or `resolveRunExitSave` → `applyEndlessRunExit` for endless and wave-planner runs), then persists the returned `SaveGame`. `DefenseNightEnd` itself only does presentation (HUD, loot panel, return button, SFX).

## Commands

```bash
npm install
npm run dev              # Vite, http://127.0.0.1:5173
npm run verify           # typecheck + lint + check:arch + vitest (default agent check)
npm run typecheck        # tsc: src, e2e, configs
npm run lint             # Biome check: lint + formatting; warnings fail too (CI gate)
npm run knip             # unused files/exports/deps (CI only — never run this in an agent session)
npm run check:arch       # import cycles + layer rules vs scripts/data/architecture-baseline.json (CI gate)
npm run format           # Biome formatter (fix what `lint` reports as unformatted)
npm run test             # Vitest only
npm run test:coverage    # Vitest + coverage thresholds
npm run build            # tsc -b + production bundle → dist/
npm run build:e2e        # production build with E2E hooks
npm run test:e2e         # Playwright (run build:e2e first; not part of verify)
npm run preview
npm run sim:economy      # headless campaign economy sim → sim-output/ (see ECONOMY_SIM.md)
```

Use `verify` after ordinary edits. Run Playwright or `test:coverage` only for e2e or coverage work, or a merge-ready PR. CI: [TESTING.md](./TESTING.md), [CI_RELEASES.md](./CI_RELEASES.md). Node 24 (`.nvmrc`).

## Repository layout

```text
src/
  bootstrap.ts    # Production entry; dynamic import of gameMain
  gameMain.ts     # Phaser.Game (portrait 540×1200, FIT + autoRound)
  config/         # Layout/engine constants only — no gameplay numbers
  content/        # Asset keys, spell catalog ids
  core/           # data/: DataStore, normalize* (JSON validation); save/: GameState, saveTypes, saveSlots, migrations; render/: display scale, hi-DPI, pixel render; root: registry keys, events, run modes
  tuning/         # Read-only store (`tuning(key)` / `setTuning`); filled once from public/data JSON
  gear/           # Items, inventory, shops, loot rolls, night loot summary
  talents/        # Talent tree rules, text, runtime
  sim/            # Economy simulator (scripts/econ-sim.mjs → src/sim/economy/)
  input/          # VirtualStick, input modality, modal backdrop
  combat/         # rules/: hitboxes, damage, knockback, SpellCastController, SpellEffects; fx/: combat VFX + telegraphs
  debug/          # DebugState flags + debug drawers
  entities/       # Player, Enemy, projectiles
  ai/             # EnemyBrain (entry) + brainShared (helpers) + behaviors/
  pathfinding/    # Nav grid, A*, LOS
  scenes/         # Boot, Town, Defense, DebugMenu
  scenes/defense/ # DefenseScene helpers (HUD, ticks, spells, e2e, night end)
  systems/        # WaveSpawner, night-end rules, endless roster/scheduler, town building menu
  ui/             # hud/ (SpellBar, CastBar, HUD layout), panels/ (modal panels), touch/ (touch buttons), layout/ (screenLayout, text style), theme/, per-panel folders
  audio/          # SFX helpers (public/assets/audio/sfx)
  world/          # Ground layers, camera, spawn points
  test/           # Vitest Phaser stub, input fakes, and real-Phaser scene harness (`test/scene/`)
  e2e/            # installE2E hooks (VITE_E2E=true or ?e2e=1)
public/data/      # Runtime JSON (Boot fetches via DataStore.loadAll; sim/tests also import the same files)
public/assets/    # Sprites/audio (do not edit binaries in Cursor)
scripts/          # build/ (Phaser bundle, install, size + PWA asserts, version), assets/ (icons, MobileRPG sync, PWA icons), capture/ (local screenshot / video proofs), check-architecture, econ-sim, sim-fights, data/
vendor/           # Trimmed Phaser bundle; its sha256 in phaser-defense.manifest.json is checked on install
docs/             # AGENTS, DATA_FIELDS, ITEMS, TALENTS, ECONOMY_SIM, TESTING, CI_RELEASES, WAVES, ROADMAP
```

Prefer a new JSON row + a small behavior module over growing scene files.

## Where constants live

| Layer | Path | Holds |
|-------|------|--------|
| Engine | `src/config/` | Canvas/layout, HUD px, render depths. **No gameplay numbers.** |
| Code content | `src/content/` | Texture keys/paths (`assets.ts`), spell ids (`spells.ts`) |
| Runtime JSON | `public/data/` | enemies, enemy-ai, gameplay, damage-numbers, player, defense-maps, spell_input, spells, entity-physics, hit-flash, waves, buildings, items, loot, consumables, shops, talents… Missing fields throw `ConfigLoadError`. Schema: [DATA_FIELDS.md](./DATA_FIELDS.md). Gear design: [ITEMS.md](./ITEMS.md). Talents: [TALENTS.md](./TALENTS.md). |
| Tuning store | `src/tuning/gameTuning.ts` | Read-only `tuning(key)` after Boot (and the sim) load JSON. Edit the JSON files, not this module. The same files are fetched at runtime and bundled for the sim/tests **on purpose**, so values stay easy to edit in `public/data/`. |

Save shapes: `src/core/save/saveTypes.ts` (`SaveGame`, `NightResult`, `SAVE_VERSION`). Reading stored saves goes through `saveRepository.parseStoredSave` (one validator for the autosave and slots). **Bumping `SAVE_VERSION` needs a step in `core/save/migrations.ts` plus a `fixtures/save-vN.json` fixture**; `migrations.test.ts` fails if a step is missing.

## Conventions

- **Content vs code:** new enemy = row in `enemies.json` + `src/ai/behaviors/*` if needed (ranged kiters reuse `behaviors/rangedKite.ts`). Changing boot-required JSON keys means updating `DATA_FIELDS.md` in the same PR (`dataFieldsDoc.test.ts` checks both ways).
- **Vitest:** don't assert against shipped `public/data/*.json` values; use inline fixtures.
- **Combat:** Arcade bodies for movement; custom hitboxes for attacks. Player FSM `idle → windup → active → recovery` (damage only in `active`). Objective is `townWallHp`.
- **Input:** one owner at a time via `src/input/inputModality.ts`. Modals use `acquireModalInput` + `bindModalDimBackdrop`; host scenes react to `INPUT_MODALITY_CHANGED`.
- **Save safety:** extend `SaveGame` only with backward-compatible defaults in `createNewSave()` (`core/save/GameState.ts`).
- **Debug world scale:** `DebugMenuScene` cycles session-only `registry.worldPixelScale` (1×/2×/3× vs default 2× art). Scales the full defense footprint (`defenseFieldPx`, ground tiles, camera/physics bounds, nav grid extent, obstacles, wall band, spawns); HUD stays unscaled (`worldUnit` / `worldDisplayPx` in `config/worldScale.ts`; the debug setters live in `core/render/worldPixelScale.ts`).
- **CI:** typecheck, Biome lint, knip (CI only — agents don't run it), `check:arch`, unit tests (`test:coverage` floors are in `vitest.config.ts` and only ever go up), build and Chromium Playwright must stay green. Scene tests (`src/**/*.scene.test.ts`) boot real Phaser under jsdom + `@napi-rs/canvas`; see [TESTING.md](./TESTING.md). Delete dead code rather than adding knip ignores. Merges to main publish Pages.
- **Balance:** prefer `npm run sim:economy` when changing `waves.json`, `loot.json`, shop prices, or affix power — [ECONOMY_SIM.md](./ECONOMY_SIM.md).
- **Defense pooling:** projectile sprites via `src/entities/projectilePool.ts` (`releaseProjectileSprite` on despawn); enemy shells via `DefenseEnemySpawner` + `reconfigureEnemyInstance`. Scene shutdown calls `destroyProjectilePool` / `destroyDefenseEnemyPool`.

## Related docs

[DATA_FIELDS.md](./DATA_FIELDS.md) · [ITEMS.md](./ITEMS.md) · [TALENTS.md](./TALENTS.md) · [ECONOMY_SIM.md](./ECONOMY_SIM.md) · [TESTING.md](./TESTING.md) · [CI_RELEASES.md](./CI_RELEASES.md) · [WAVES.md](./WAVES.md) · [MANUAL_UI_CAPTURE.md](./MANUAL_UI_CAPTURE.md) · [ROADMAP.md](../ROADMAP.md)
