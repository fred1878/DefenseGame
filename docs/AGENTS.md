# Agent guide — DefenseGame

Code-only top-down real-time action RPG: **town by day**, **defend the settlement by night**. No game editor. Work is TypeScript + JSON.

**Stack:** Phaser 3 · Vite · TypeScript · Vitest · Playwright. Capacitor is planned (config only today). Playable build: https://fred1878.github.io/DefenseGame/

## Product loop

BootScene (load `public/data/*.json` + assets, restore save) → TownScene (upgrades, start night) → DefenseScene (real-time waves, wall HP) → TownScene.

**Invariant:** `DefenseScene` never mutates town rules directly. It returns a `NightResult`; `GameState.applyNightResult()` applies it once on the Town/Boot side.

## Commands

```bash
npm install
npm run dev              # Vite, http://127.0.0.1:5173
npm run verify           # typecheck + vitest (default agent check)
npm run typecheck
npm run test             # Vitest only
npm run build            # production bundle → dist/
npm run build:e2e        # production build with E2E hooks
npm run test:e2e         # Playwright (run build:e2e first; not part of verify)
npm run preview
```

Use `verify` after ordinary edits. Run Playwright or `test:coverage` only for e2e or coverage work, or a merge-ready PR. CI: [TESTING.md](./TESTING.md), [CI_RELEASES.md](./CI_RELEASES.md). Node 24 (`.nvmrc`).

## Repository layout

```text
src/
  main.ts         # Phaser.Game (portrait 540×1200, FIT + autoRound)
  config/         # Layout/engine constants only — no gameplay numbers
  content/        # Asset keys, spell catalog ids
  core/           # GameState, saveTypes, DataStore, EventBus
  input/          # VirtualStick, input modality, modal backdrop
  combat/         # Hitboxes, damage, knockback, SpellCastController, SpellEffects
  debug/          # DebugState flags + debug drawers
  entities/       # Player, Enemy, projectiles
  ai/             # EnemyBrain + behaviors/
  pathfinding/    # Nav grid, A*, LOS
  scenes/         # Boot, Town, Defense, DebugMenu
  scenes/defense/ # DefenseScene helpers (HUD, ticks, spells, e2e, night end)
  systems/        # WaveSpawner, town buildings, endless roster/scheduler
  ui/             # SpellBar, panels, touch buttons, screenLayout
  e2e/            # installE2E hooks (VITE_E2E=true or ?e2e=1)
public/data/      # Runtime JSON (Boot via DataStore.loadAll)
public/assets/    # Sprites/audio (do not edit binaries in Cursor)
docs/             # This guide, TESTING, CI_RELEASES, WAVES
```

Prefer a new JSON row + a small behavior module over growing scene files.

## Where constants live

| Layer | Path | Holds |
|-------|------|--------|
| Tuning | `src/config/` | Canvas/layout, HUD px, render depths. **No gameplay numbers.** |
| Code content | `src/content/` | Texture keys/paths (`assets.ts`), spell ids (`spells.ts`) |
| Runtime JSON | `public/data/` | enemies, enemy-ai, player, defense-maps, spell_input, spells, entity-physics, waves, buildings… Missing fields throw `ConfigLoadError`. Schema: [DATA_FIELDS.md](../public/data/DATA_FIELDS.md). |

Save shapes: `src/core/saveTypes.ts` (`SaveGame`, `NightResult`, `SAVE_VERSION`).

## Conventions

- **Content vs code:** new enemy = row in `enemies.json` + `src/ai/behaviors/*` if needed. Changing boot-required JSON keys means updating `DATA_FIELDS.md` in the same PR (`dataFieldsDoc.test.ts` checks both ways).
- **Vitest:** don't assert against shipped `public/data/*.json` values; use inline fixtures.
- **Combat:** Arcade bodies for movement; custom hitboxes for attacks. Player FSM `idle → windup → active → recovery` (damage only in `active`). Objective is `townWallHp`.
- **Input:** one owner at a time via `src/input/inputModality.ts`. Modals use `acquireModalInput` + `bindModalDimBackdrop`; host scenes react to `INPUT_MODALITY_CHANGED`.
- **Save safety:** extend `SaveGame` only with backward-compatible defaults in `GameState.createNew()`.
- **Debug world scale:** `DebugMenuScene` cycles session-only `registry.worldPixelScale` (1×/2×/3× vs default 2× art). Scales the full defense footprint (`defenseFieldPx`, ground tiles, camera/physics bounds, nav grid extent, obstacles, wall band, spawns); HUD stays unscaled (`worldUnit` / `worldDisplayPx`).
- **CI:** typecheck, unit tests and build must stay green. Merges to main publish Pages.
- **Defense pooling (PR12):** projectile sprites via `src/entities/projectilePool.ts` (`releaseProjectileSprite` on despawn); enemy shells via `DefenseEnemySpawner` + `reconfigureEnemyInstance`. Scene shutdown calls `destroyProjectilePool` / `destroyDefenseEnemyPool`.

## Related docs

[DATA_FIELDS.md](../public/data/DATA_FIELDS.md) · [TESTING.md](./TESTING.md) · [CI_RELEASES.md](./CI_RELEASES.md) · [WAVES.md](./WAVES.md) · [ROADMAP.md](../ROADMAP.md)
