# DefenseGame

Top-down **real-time action RPG**: upgrade your town **by day**, defend the **north wall by night**. Built with **Phaser 3**, **Vite**, and **TypeScript** — no game editor, all logic in code + JSON.

**Portrait touch UI:** design resolution **540×1200** (9:20), scaled with Phaser `FIT` for phones and desktop browsers.

## Play

| Build | URL |
|-------|-----|
| **Latest (GitHub Pages)** | https://fred1878.github.io/DefenseGame/ |
| **Local dev** | `npm run dev` → http://127.0.0.1:5173 |

After merging to `main`, Pages updates automatically (see [docs/CI_RELEASES.md](./docs/CI_RELEASES.md)).

---

## What you do in the game

1. **Town (day)** — Spend gold on wall and blacksmith upgrades, arrange spells on the 8-slot bar, then start the night from **Gallows Square**.
2. **Defense (night)** — Move with the virtual stick, melee/ranged/auto combat, cast spells, keep wall HP above zero, clear waves.
3. **Results** — Win or lose returns a `NightResult`; gold and wall damage apply in town. Progress saves to **`localStorage`**.

**Campaign content today:** nights **1–12** in `public/data/waves.json`. After night 12, wave data **repeats night 12** (`DataStore.getWaveForNight`).

---

## Features implemented

Verified against the current codebase (not a wish list):

| Area | Detail |
|------|--------|
| **Scenes** | `BootScene` (load JSON + assets), `TownScene`, `DefenseScene`, `DebugMenuScene` |
| **Save** | `GameState` persist/restore; town reset (tap twice on Town) |
| **Enemies** | **12 types**, JSON-driven stats/behaviors (`public/data/enemies.json`) |
| **Waves** | **12 nights** of scheduled groups + gold rewards |
| **Town** | Layout from `town_layout.json`; upgrades for **wall** and **blacksmith** via Moon Brazier / Witchlight Beacon; spell sort panel from daylit beacon |
| **Endless / wave planner** | Haunted Well opens endless training (pick enemies + caps); Plague Clinic opens the wave planner (build a custom night) |
| **Unwired buildings** | Both Market Stalls — visible, labeled “Not available yet” |
| **Audio** | SFX for melee slashes, fire whoosh and coin gain/spend (`src/audio/`, `public/assets/audio/sfx/`) |
| **Performance** | Enemy and projectile pooling in Defense |
| **Combat** | Melee arcs, ranged shots, enemy melee/ranged/lob/arrow-rain behaviors, A* pathing, knockback, focus target |
| **Spells** | **23 spells** in `spells.json`; **8 equipped slots** (4×2); channeling, ground targeting, auto-cast (long-press); cooldown UI |
| **HUD** | Combat chrome, spell bar, cast bar under player, minimap, mode/auto toggles, wall/night status text |
| **Debug** | Hitboxes, touch overlay, enemy paths, world pixel scale (session-only) |
| **Deploy** | Versioned bundles + `version.json` cache bust on Pages |

**Not implemented yet:** title/settings/pause menus, tutorial, music (SFX are partial), walk-cycle animation, campaign ending after night 12, Capacitor store builds.

See [ROADMAP.md](./ROADMAP.md) for checklist milestones.

---

## Controls (touch)

### Town

| Input | Action |
|-------|--------|
| Building buttons | Upgrade (where wired), open spell bar, or status text |
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
npm run typecheck    # src, e2e, configs
npm run lint         # Biome; any warning fails
npm run knip         # dead files/exports/deps
npm run test         # Vitest (src/**/*.test.ts)
npm run test:coverage
npm run build:e2e    # build with VITE_E2E hooks
npm run test:e2e     # Playwright (run build:e2e first)
```

**CI parity (agents):** `npm run verify && npm run build`

---

## Project structure

```text
src/
  main.ts              # Phaser config, scene list, viewport binding
  config/              # Tunable constants (map, player, spell bar layout, …)
  content/             # Asset manifests, spell catalog wiring
  core/                # GameState, DataStore, save types, display scale
  combat/              # Damage, spells, hitboxes, FX
  entities/            # Player, Enemy, Projectiles
  ai/                  # EnemyBrain + behaviors
  pathfinding/         # Nav grid, A*
  scenes/              # Boot, Town, Defense, DebugMenu (+ defenseNightLogic)
  systems/             # Town buildings, wave spawner, endless roster/scheduler
  audio/               # SFX helpers
  ui/                  # Spell bar, touch controls, HUD chrome, minimap
  world/               # Ground layers, camera, spawn points
  e2e/                 # Test hooks (VITE_E2E / ?e2e=1)
public/data/           # Runtime JSON (see below)
e2e/                   # Playwright specs
docs/                  # AGENTS, DATA_FIELDS, testing, CI, waves
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
| `buildings.json` | Upgrade defs: `wall`, `blacksmith` (`costByLevel`, effects) |
| `town_buildings.json` | Town menu labels, textures, `upgradeId` / `startsNight` / `opensSpellBar` / `opensEndlessMode` / `opensWavePlanner` |
| `town_layout.json` | Building slot positions on the town screen |
| `spells.json` | Full spell catalog (damage, channeling, targeting, per-spell geometry/timing, knockback, icons) |

Spells and waves are the primary content levers; prefer new JSON rows over growing `DefenseScene.ts` (the 2026 split plan is complete; history in [docs/archive/REFACTOR_PLAN.md](./docs/archive/REFACTOR_PLAN.md)). Field reference: [docs/DATA_FIELDS.md](./docs/DATA_FIELDS.md).

---

## Testing and CI

| Workflow | Trigger | What runs |
|----------|---------|-----------|
| `ci.yml` | Push/PR to `main` | **verify** (typecheck, Biome lint, knip, Vitest coverage, build), then conditional **e2e** (Playwright) |
| `pages.yml` | Push to `main` | Publish `dist/` to GitHub Pages |
| `release.yml` | Tag `v*.*.*` | Pages deploy + GitHub Release notes |

Details: [docs/TESTING.md](./docs/TESTING.md), [docs/CI_RELEASES.md](./docs/CI_RELEASES.md).

---

## Documentation

| Doc | Description |
|-----|-------------|
| [docs/AGENTS.md](./docs/AGENTS.md) | Architecture, data formats, commands, agent workflow |
| [docs/DATA_FIELDS.md](./docs/DATA_FIELDS.md) | Every boot-required JSON field (checked by `dataFieldsDoc.test.ts`) |
| [docs/TESTING.md](./docs/TESTING.md) | Unit/e2e test map and CI gates |
| [docs/archive/REFACTOR_PLAN.md](./docs/archive/REFACTOR_PLAN.md) | Completed Nov 2026 file-split plan (historical; line counts are stale) |
| [ROADMAP.md](./ROADMAP.md) | Milestones and known gaps |
| [docs/WAVES.md](./docs/WAVES.md) | Night-by-night wave reference |
| [docs/CI_RELEASES.md](./docs/CI_RELEASES.md) | Deploy, tags, future mobile builds |

---

## License / assets

Game code in this repository is developed for the DefenseGame project. Art and spell assets under `public/assets/` include placeholders and synced MRPG-derived assets (see `scripts/` for sync tooling).