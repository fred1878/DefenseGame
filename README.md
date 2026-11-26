# DefenseGame

Top-down **real-time action RPG**: upgrade your town **by day**, defend the **north wall by night**. Built with **Phaser 4**, **Vite**, and **TypeScript** — no game editor, all logic in code + JSON.

**Portrait touch UI:** design resolution **540×1200** (9:20), scaled with Phaser `FIT` for phones and desktop browsers.

## Play

| Build | URL |
|-------|-----|
| **Latest (GitHub Pages)** | https://fred1878.github.io/DefenseGame/ |
| **Android APK** | [GitHub Releases](https://github.com/fred1878/DefenseGame/releases/latest) — see [installing the Android app](./docs/CI_RELEASES.md#android-app) |
| **Local dev** | `npm run dev` → http://127.0.0.1:5173 |

After merging to `main`, Pages updates automatically (see [docs/CI_RELEASES.md](./docs/CI_RELEASES.md)).

**Install the web app:** open the Pages URL in Chrome, Edge, or Safari (phone or desktop), then **Add to Home Screen** / **Install app**. The game opens in its own window and works **offline** after that first load. A new deploy applies the next time you open it.

**Install on Android:** download the APK from the latest GitHub Release. After it's installed, a **Check for update** button in town (top-left) looks for a newer release and can install it. You must allow the app to install unknown apps. Details: [docs/CI_RELEASES.md](./docs/CI_RELEASES.md#android-app).

---

## What you do in the game

1. **Town (day)** — Spend gold on wall upgrades; shop at the **Moon Brazier** (blacksmith gear) and **Market Stall** (trader, night); arrange spells on the 8-slot bar; manage gear in the bag; then start the night from **Gallows Square**.
2. **Defense (night)** — Move with the virtual stick, melee/ranged/auto combat, cast spells, use potions/bombs, keep wall HP above zero, clear waves.
3. **Results** — Win or lose returns a `NightResult`; gold, loot, and wall damage apply in town (campaign shows a loot summary). Progress saves to **`localStorage`**.

**Campaign content today:** nights **1–20** in `public/data/waves.json` (13–20 add tougher, harder-hitting and elite groups). After night 20, wave data **repeats night 20** (`DataStore.getWaveForNight`).

---

## Features implemented

Verified against the current codebase (not a wish list):

| Area | Detail |
|------|--------|
| **Scenes** | `BootScene` (load JSON + assets), `TownScene`, `DefenseScene`, `DebugMenuScene` |
| **Save** | `GameState` persist/restore (autosave); five manual slots from the daylit Market Stall; town reset (tap twice on Town) |
| **Enemies** | **12 types**, JSON-driven stats/behaviors (`public/data/enemies.json`) |
| **Waves** | **20 nights** of scheduled groups + gold rewards; per-group `hpMul` / `damageMul`, elites |
| **Town** | Layout from `town_layout.json`; wall upgrades via Witchlight Beacon; **Moon Brazier** opens blacksmith + gear; **night Market Stall** opens trader + gear; daylit beacon opens spell sort panel |
| **Gear & inventory** | 11 equipment slots, 40-slot bag, compare/sell/equip; night drops from `loot.json`; stats and procs from `items.json` ([#362](https://github.com/fred1878/DefenseGame/pull/362)–[#363](https://github.com/fred1878/DefenseGame/pull/363)) |
| **Shops & consumables** | Trader (random stock, rerolls each night) and blacksmith catalogue (unlock by night); potions/bombs in combat ([#364](https://github.com/fred1878/DefenseGame/pull/364)) |
| **Endless / wave planner** | Haunted Well opens endless training (pick enemies + caps); Plague Clinic opens the wave planner (build a custom night) |
| **Save menu** | Daylit Market Stall opens five manual slots (save / load / delete). A slot whose schema version differs from `SAVE_VERSION` is deleted, not migrated. |
| **Night loot summary** | Campaign end-of-night overlay: result, gold, rarity-coloured drops, wall HP ([#366](https://github.com/fred1878/DefenseGame/pull/366)) |
| **Audio** | SFX for melee slashes, fire whoosh and coin gain/spend (`src/audio/`, `public/assets/audio/sfx/`) |
| **Performance** | Enemy and projectile pooling in Defense |
| **Combat** | Melee arcs, ranged shots, enemy melee/ranged/lob/arrow-rain behaviors, A* pathing, knockback, focus target |
| **Spells** | **23 spells** in `spells.json`; **8 equipped slots** (4×2); channeling, ground targeting, auto-cast (long-press); cooldown UI |
| **HUD** | Combat chrome, spell bar, cast bar under player, minimap, mode/auto toggles, wall/night status text |
| **Debug** | Hitboxes, touch overlay, enemy paths, world pixel scale (session-only) |
| **Deploy** | Versioned bundles + `version.json` cache bust on Pages |
| **PWA** | Installable standalone app; service worker precaches JS (including the Phaser chunk and lazy-loaded scenes), JSON data, images and audio. Updates activate on the next load |
| **Android app** | Capacitor APK on GitHub Releases; in-town **Check for update** installs a newer APK (native only) |

**Not implemented yet:** title/settings/pause menus, tutorial, music (SFX are partial), walk-cycle animation, **campaign ending after night 20** (wave 20 repeats indefinitely today), iOS / Play Store builds, spell combos, full upgradeable-town economy, talents, wall-defense maze, daytime adventuring. Equipment core **is** in — see [roadmap](./ROADMAP.md) for follow-ups (stash, buy-back, gear visuals, crafting).

See [ROADMAP.md](./ROADMAP.md) for checklist milestones.

---

## Controls (touch)

### Town

| Input | Action |
|-------|--------|
| Building buttons | Upgrade (where wired), open spell bar, or status text |
| **Market Stall (Daylit)** | Open the save menu (multiple slots) |
| **Gallows Square** | Start night |
| **Reset save** | Tap twice — clears save and reloads |
| **Fullscreen** | Toggle when supported (iOS shows N/A) |
| **Debug** | Debug menu overlay |

### Defense

| Input | Action |
|-------|--------|
| **Virtual stick** (lower area) | Move; interrupts spell channeling |
| **ATK** | Manual attack (melee arc or ranged shot per mode) |
| **MEL** toggle | Cycle **Melee / Ranged / Auto combat** |
| **AUTO** toggle | Auto attack when off-stick |
| **Spell slots** | Tap to cast; long-press toggles per-slot auto-cast |
| **Tap enemy** | Focus target (for facing and some spells) |
| **Ground spells** | Tap/drag aim when casting ground-target spells |
| **Debug** | Debug menu (pauses combat scene) |

Keyboard is not a first-class control path; the game targets touch.

---

## Getting started

**Requirements:** Node **≥ 24** (see `.nvmrc` / `package.json` `engines`).

```bash
npm install
npm run dev          # Vite dev server
npm run build        # tsc + production bundle → dist/
npm run preview      # serve dist locally
npm run verify       # typecheck + Biome lint + knip + Vitest (default check)
npm run sim:economy  # headless balance sim → sim-output/ (see docs/ECONOMY_SIM.md)
npm run typecheck    # src, e2e, configs
npm run lint         # Biome lint + format check; any warning fails
npm run format       # apply Biome formatting
npm run knip         # dead files/exports/deps
npm run test         # Vitest (src/**/*.test.ts)
npm run test:coverage
npm run build:e2e    # build with VITE_E2E hooks
npm run test:e2e     # Playwright (run build:e2e first)
npm run build:android  # Vite bundle with relative base for Capacitor
npm run android:sync   # build:android + cap sync android
```

**CI parity (agents):** `npm run verify && npm run build`

---

## Project structure

```text
src/
  bootstrap.ts         # Dynamic import of gameMain (production entry)
  gameMain.ts          # Phaser.Game, scene list, viewport binding
  config/              # Layout/engine constants (not gameplay numbers)
  content/             # Asset manifests, spell catalog wiring
  core/                # GameState, DataStore, save types, display scale
  gear/                # Items, inventory, shops, loot, night summary
  sim/                 # Economy simulator (npm run sim:economy)
  combat/              # Damage, spells, hitboxes, FX
  entities/            # Player, Enemy, Projectiles
  ai/                  # EnemyBrain + behaviors
  pathfinding/         # Nav grid, A*
  scenes/              # Boot, Town, Defense, DebugMenu (+ scenes/defense/*)
  systems/             # Town buildings, wave spawner, endless roster/scheduler
  audio/               # SFX helpers
  ui/                  # Spell bar, touch controls, HUD chrome, minimap
  world/               # Ground layers, camera, spawn points
  e2e/                 # Test hooks (VITE_E2E / ?e2e=1)
public/data/           # Runtime JSON (see below)
e2e/                   # Playwright specs
docs/                  # AGENTS, DATA_FIELDS, ITEMS, ECONOMY_SIM, testing, CI, waves
```

---

## Data files (`public/data`)

Loaded at runtime in `BootScene` via `DataStore`:

| File | Purpose |
|------|---------|
| `player.json` | Player combat/movement tuning, melee engage slack (`meleeEngageTargetRadius`, `meleeActivationSlackWu`), `endlessPanelDefaultConcurrent` |
| `defense-maps.json` | `defaultMapId`, per-map `field` (cols/rows) + obstacle placements (`tileX`/`tileY`/`textureKey`); `selectDefenseMapId` for future map pick |
| `entity-physics.json` | Nav clearance margins + `knockbackVelocityCapMult` |
| `player.json` / `enemies.json` | Required `bodyRadius` per player / enemy (arcade collision) |
| `enemy-ai.json` | Global chase/aggro (`playerAggroRadius`, `playerChaseMemoryMs`, `wallVelocityBlendMs`, `northWallMeleeStandoffPx`) |
| `enemies.json` | HP, speed, damage, `behavior`, required explicit `combat` tuning, textures |
| `waves.json` | Per-night spawn groups (`atMs`, `enemyId`, `count`, `intervalMs`) and `rewardGold` |
| `items.json` | Gear templates: slots, rarities, affixes, uniques |
| `loot.json` | Night-end drop tables scaled by campaign night |
| `consumables.json` | Potions, bombs (charges, combat use) |
| `shops.json` | Trader stock tiers and blacksmith catalogue unlock nights |
| `buildings.json` | Upgrade defs: `wall`, `blacksmith` (`costByLevel`, effects) |
| `town_buildings.json` | Town menu labels, textures, `upgradeId` / `startsNight` / `opensSpellBar` / `opensShop` / `opensEndlessMode` / `opensWavePlanner` |
| `town_layout.json` | Building slot positions on the town screen |
| `spells.json` | Full spell catalog (damage, channeling, targeting, per-spell geometry/timing, knockback, icons) |

Spells and waves are the primary content levers; prefer new JSON rows over growing `DefenseScene.ts` (the 2026 split plan is complete; history in [docs/archive/REFACTOR_PLAN.md](./docs/archive/REFACTOR_PLAN.md)). Field reference: [docs/DATA_FIELDS.md](./docs/DATA_FIELDS.md).

---

## Testing and CI

| Workflow | Trigger | What runs |
|----------|---------|-----------|
| `ci.yml` | Push/PR to `main` | **verify** (typecheck, Biome lint, knip, Vitest coverage, build), then conditional **e2e** (Playwright) |
| `pages.yml` | Push to `main` | Publish `dist/` to GitHub Pages |
| `release.yml` | Tag `v*.*.*` | Pages deploy + GitHub Release notes + optional zip |
| `android-release.yml` | Tag `v*` or manual dispatch | Signed Android APK attached to the GitHub Release |

Details: [docs/TESTING.md](./docs/TESTING.md), [docs/CI_RELEASES.md](./docs/CI_RELEASES.md).

---

## Documentation

| Doc | Description |
|-----|-------------|
| [docs/AGENTS.md](./docs/AGENTS.md) | Architecture, data formats, commands, agent workflow |
| [docs/ITEMS.md](./docs/ITEMS.md) | Rarity, item level, affix rules (gear) |
| [docs/ECONOMY_SIM.md](./docs/ECONOMY_SIM.md) | Headless progression / balance simulator |
| [docs/DATA_FIELDS.md](./docs/DATA_FIELDS.md) | Every boot-required JSON field (checked by `dataFieldsDoc.test.ts`) |
| [docs/TESTING.md](./docs/TESTING.md) | Unit/e2e test map and CI gates |
| [docs/archive/REFACTOR_PLAN.md](./docs/archive/REFACTOR_PLAN.md) | Completed Nov 2026 file-split plan (historical; line counts are stale) |
| [ROADMAP.md](./ROADMAP.md) | Milestones and known gaps |
| [docs/WAVES.md](./docs/WAVES.md) | Night-by-night wave reference |
| [docs/CI_RELEASES.md](./docs/CI_RELEASES.md) | Deploy, tags, Android APK installs and updates |

---

## License / assets

Game code in this repository is developed for the DefenseGame project. Art and spell assets under `public/assets/` include placeholders and synced MRPG-derived assets (see `scripts/` for sync tooling).