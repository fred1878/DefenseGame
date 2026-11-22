# Agent guide — DefenseGame

This repo is a **code-only**, **top-down real-time** action RPG: **town meta by day**, **defend the settlement by night**. There is **no game editor** (no Godot/Unity scenes). All work happens in TypeScript + JSON in Cursor.

**Stack:** Phaser 3 · Vite · TypeScript · Capacitor (mobile wrapper, added when night loop is stable).

---

## Product loop

```mermaid
flowchart LR
  Boot --> Town
  Town -->|"Start night"| Defense
  Defense -->|"NightResult"| Town
```

| Mode | Scene | Responsibility |
|------|--------|----------------|
| Boot | `BootScene` | Load `public/data/*.json`, assets, restore save |
| Meta | `TownScene` | Upgrades, resources, start night |
| Combat | `DefenseScene` | Real-time movement, attacks, waves, wall HP |

**Invariant:** `DefenseScene` never mutates town rules directly. It returns a `NightResult`; `GameState.applyNightResult()` applies changes once in `TownScene` or Boot handoff.

---

## Repository layout

```text
src/
  main.ts              # Phaser.Game config (portrait 540×1200, FIT + autoRound)
  config/              # Tunable constants only (+ types that describe those tunables)
  content/             # Code-defined content manifests (assets, spell catalog)
  core/                # GameState, saveTypes, DataStore, EventBus
  input/               # VirtualStick, ActionButtons
  combat/              # Hitbox, DamageSystem, Knockback, SpellCastController, SpellEffects
  debug/               # DebugState registry flags, HitboxDebugDraw
  entities/            # Player, Enemy, EnemyCombat, Projectile
  ai/                  # EnemyBrain (wall rush + player aggro)
  pathfinding/         # Nav grid, A*, line-of-sight
  scenes/              # Boot, Town, Defense, DebugMenu
  systems/             # WaveSpawner, TownBuildings
  ui/                  # SpellBar, CastBar, touch buttons, HUD
public/data/           # JSON content (fetched at runtime)
assets/ or public/     # Sprites/audio (placeholders OK early)
docs/                  # AGENTS, TESTING, CI_RELEASES, REFACTOR_PLAN; ROADMAP at repo root
```

**When adding features:** prefer new JSON rows + small behavior modules over growing scene files.

---

## Where constants live

| Layer | Path | Holds |
|-------|------|--------|
| **Tuning** | `src/config/` | Canvas/layout only (`GAME`, `SPELL_BAR` / `CAST_BAR` px, render depths). **No gameplay numbers** — combat, player, AI, spells mechanics, entity physics, defense field size, and enemy combat tables load from `public/data/` at Boot with strict validation (`ConfigLoadError` if a field is missing). |
| **Code content** | `src/content/` | `assets.ts` (texture keys, file paths, nine-slice), `spells.ts` (`SPELL_CATALOG`, spell ids). Candidate to move spells → `public/data/spells.json` later. |
| **Runtime JSON** | `public/data/` | `enemies.json`, `enemy-combat-defaults.json`, `enemy-ai.json`, `player.json`, `defense-maps.json`, `spells.json`, `entity-physics.json`, `waves.json`, `buildings.json` (fetched in Boot via `DataStore.loadAll`). |

Save persistence shapes: `src/core/saveTypes.ts` (`SaveGame`, `NightResult`, `SAVE_VERSION`). `src/config.ts` re-exports **tuning only** from `src/config/index.ts`.

---

## Data examples (`public/data/`)

**Config-only data:** TypeScript must not define fallback gameplay numbers. Every value in the table below must exist in the matching JSON file; Boot fails fast with a clear path when something is missing. Per-enemy `combat` blocks are partial overrides merged onto `enemy-combat-defaults.json` at runtime (not code constants).

**enemies.json** — per-enemy **required** `hp`, `speed`, `damage`, plus `behavior` id (maps to `src/ai/behaviors/`). Optional `combat` objects hold partial overrides merged at Boot onto `enemy-combat-defaults.json` (combat baselines live in that file, not in any single enemy row). Global chase tuning loads from `enemy-ai.json` into `PLAYER_AGGRO_RADIUS` / `PLAYER_CHASE_MEMORY_MS` / `WALL_VELOCITY_BLEND_MS` (`applyEnemyAi`).

| `combat` block | Used when `behavior` is |
|----------------|-------------------------|
| `wall` | All (north wall objective) |
| `melee` | `meleeChaser` (arc swipe vs player) |
| `arrowRain` | `arrowRainArcher` (telegraphed floor AoE) |
| `javelineer` | `javelineer` (kite band + toss) |
| `stationaryRanged` | `stationaryRanged` (hold + straight bolt) |

```json
{
  "grunt": {
    "hp": 30,
    "speed": 85,
    "damage": 8,
    "bodyRadius": 28,
    "behavior": "meleeChaser",
    "textureKey": "enemy_grunt",
    "combat": {
      "melee": {
        "triggerRange": 78,
        "range": 72,
        "meleeChaseStandoffWu": 2,
        "arcDeg": 70,
        "windupMs": 380,
        "activeMs": 110,
        "recoveryMs": 480,
        "cooldownMs": 350
      }
    }
  },
  "arrow_rain_archer": {
    "hp": 28,
    "speed": 52,
    "damage": 9,
    "behavior": "arrowRainArcher",
    "textureKey": "enemy_arrow_rain_archer",
    "combat": {
      "wall": { "damage": 6, "triggerRange": 42, "hitRange": 34 },
      "melee": {
        "triggerRange": 36,
        "range": 26,
        "arcDeg": 70,
        "windupMs": 380,
        "activeMs": 110,
        "recoveryMs": 480,
        "cooldownMs": 350
      },
      "arrowRain": {
        "preferredRange": 150,
        "attackTriggerRange": 168,
        "windupMs": 900,
        "activeMs": 1200,
        "recoveryMs": 520,
        "cooldownMs": 2200,
        "zoneRadius": 72,
        "tickIntervalMs": 300,
        "tickDamageScale": 0.55,
        "maxTicks": 4
      }
    }
  }
}
```

Every enemy row must set `hp` / `speed` / `damage` / `bodyRadius`. Omit `combat` to use loaded `enemy-combat-defaults.json` tables only; override only what you need (e.g. `"combat": { "melee": { "windupMs": 500 } }`).

**waves.json** — keyed by night number:

```json
{
  "1": {
    "rewardGold": 40,
    "groups": [
      { "atMs": 0, "enemyId": "grunt", "count": 5, "intervalMs": 800 }
    ]
  }
}
```

**enemy-combat-defaults.json** — per-behavior combat baselines (`wall`, `melee`, `arrowRain`, …). `resolveEnemyCombat` merges each enemy’s optional `combat` block from `enemies.json` on top of these loaded defaults.

**player.json** — combat/movement tuning (`moveSpeed`, melee/ranged timings, HP, invuln), melee auto-attack gate (`meleeEngageTargetRadius`, `meleeActivationSlackWu` → derived `autoAttackMeleeRange`), plus `endlessPanelDefaultConcurrent` (initial cap in the endless roster UI only).

**defense-maps.json** — `{ defaultMapId, maps: [{ id, field: { cols, rows }, obstacles: [{ tileX, tileY, textureKey }] }] }`. Boot applies the default map (`applyDefenseMaps`); use `selectDefenseMapId` from `src/config/defenseMaps.ts` when adding map pick UI.

**spells.json** — per-spell damage, channeling, geometry/timing (`coneRangeWu`, `coneArcDeg`, `swingRangeWu`, `chainLightningHops`, `blinkDistanceWu`, `iceWallDurationMs`, `shadowformDamageMult`, etc.), and knockback (`knockback`, `blastKnockback`, `chainKnockback`, `chainHopKnockback` by `mechanicType`). Boot validates required fields via `normalizeSpellCatalog` (e.g. **Fire Nova** uses `blastKnockback: 0`).

**entity-physics.json** — `enemyPathClearanceMarginPx` + `staticObstacleNavClearancePx` (nav grid inflation around obstacles). Entity **body** radii: `player.json` → `bodyRadius`; each `enemies.json` row → required `bodyRadius`.

**enemy-ai.json** — global `playerAggroRadius`, `playerChaseMemoryMs`, `wallVelocityBlendMs`.

**buildings.json**:

```json
{
  "wall": {
    "maxLevel": 5,
    "costByLevel": [50, 80, 120, 180, 250],
    "effect": "wallHpMax"
  },
  "blacksmith": {
    "maxLevel": 3,
    "costByLevel": [100, 200, 350],
    "effect": "playerDamage"
  }
}
```

---

## Implementation order (do not reorder without reason)

| Step | Done when |
|------|-----------|
| 1 | `DefenseScene`: virtual stick moves player on blank map |
| 2 | Melee hitbox + one pooled enemy dies |
| 3 | `WaveSpawner` night 1 + win/lose → `NightResult` |
| 4 | `TownScene` upgrade changes next night (wall or damage) |
| 5 | `GameState` persist (`localStorage`) |
| 6 | Capacitor + device smoke test |

Until step 2 feels good on a phone-sized viewport, avoid town art and skill trees.

---

## Combat conventions

- **Movement:** Arcade physics body on player/enemies; attack uses **custom hitboxes**, not physics overlap alone.
- **Player attack:** state machine `idle → windup → active → recovery`; damage only in `active` frames.
- **Pooling:** enemies and projectiles use pools before scaling waves.
- **Defense objective:** `townWallHp` — north wall bar at top of the field (`northWallAttackY()` in `src/config/defense.ts`); wall-rush behaviors path with A* unless the player has LOS within `PLAYER_AGGRO_RADIUS` (`src/config/enemy.ts`). After LOS breaks, `resolveEnemyTarget` in `EnemyBrain` chases `lastKnownPlayer*` for `PLAYER_CHASE_MEMORY_MS`, then eases velocity toward the wall over `WALL_VELOCITY_BLEND_MS` (`applyChaseVelocity` in `behaviors/movement.ts`).

---

## Commands

```bash
npm install
npm run dev          # Vite dev server (browser play-test)
npm run build        # production bundle → dist/
npm run typecheck
npm run test         # Vitest unit tests
npm run build:e2e    # production build with E2E hooks
npm run test:e2e     # Playwright (run build:e2e first)
npm run preview      # serve dist locally
```

---

## Agent workflow tips

1. **Scope files:** e.g. “only edit `DefenseScene.ts` and `WaveSpawner.ts`”.
2. **Content vs code:** new enemy = row in `enemies.json` + behavior if needed, not a new scene.
3. **Save safety:** extend `SaveGame` only with backward-compatible defaults in `GameState.createNew()`.
4. **Mobile:** touch buttons scale on press; **Town → Reset save** (tap twice) calls `resetSaveAndReload()` — clears `localStorage` and reloads with `?fresh=` (no hard refresh needed).
5. **Config vs content:** gameplay numbers live in `public/data/` only; `src/config/` is layout/engine constants. Spell definitions: `content/spells.ts` + `spells.json`; waves/enemies in `public/data/`. Spell bar layout: `config/spellBar.ts`; slot persistence: `save.spellBar` on `SaveGame` (`core/saveTypes.ts`).
6. **Debug:** **Town** or **Defense → Debug** opens `DebugMenuScene`. Toggles live in registry `debugFlags`: **Hitboxes: ON** (`showHitboxes`) — `DefenseScene` redraws combat arcs via `HitboxDebugDraw` (light yellow circles = player `autoAttackMeleeRange` and enemy `melee.triggerRange` for melee-capable behaviors; red = bodies and active swipe arcs). **Touch input: ON** (`showTouchInput`) — on-canvas overlay via `TouchInputDebugDraw`: finger crosshairs (Phaser pointer coords / FIT scale), virtual-stick base/knob/dead zone, HUD exclusion rects, and tap-to-focus pick radius flash in Defense. **Enemy paths: ON** (`showEnemyPaths`) — planned A* polylines and chase/wall targets via `PathDebugDraw`. **World scale: 1× / 2× / 3×** cycles session-only `registry.worldPixelScale` (world sprites/ground/colliders; HUD fixed).
7. **Waves:** nights `1`–`10` in `public/data/waves.json`; table in [WAVES.md](./WAVES.md).
8. **Combat:** each enemy has its own `EnemyCombat` FSM (windup/active/recovery + per-enemy cooldown). Player melee/ranged applies `Knockback` (`PLAYER_TUNING.meleeKnockback` > `rangedKnockback`). No shared enemy touch-damage loop.
9. **Spells:** Defense HUD spell grid (`SpellBar`, 4×2 — eight slots); **Nova** instant AoE, **Fireball** / **Heal** channeled. Long-press slot toggles per-spell auto-cast (gold border). Auto-cast priority follows grid order; channeled spells skip while moving; **auto** windup/channel still cancels on stick. **Manual** windup/channel stops movement for the cast (stick held does not interrupt); when the cast ends, an active stick resumes movement. Combat mode cycles **Melee / Ranged / Auto combat** (`A.COM`). `CastBar` under the player shows cast progress: amber windup, sky-blue effect channel (HUD: Casting… vs Channeling…).
10. **CI must stay green:** `typecheck`, `test`, `build` on every PR; merges to `main` publish the playable Pages URL (see `docs/CI_RELEASES.md`).
11. **Input modality (one owner at a time):** Phaser scenes use `topOnly: false`, so stacked hits reach multiple interactives unless gated. Use `src/input/inputModality.ts`: push a token when an overlay/submode opens, `popInputModality` when it closes, register a stable id in `INPUT_MODALITY`. **Modal** overlays (town spell sort, endless, wave planner, debug menu) must call `acquireModalInput` and `bindModalDimBackdrop` on the full-screen dim (`src/input/modalBackdrop.ts` — visual only; base layer disable blocks town/defense under the modal). The host scene listens for `INPUT_MODALITY_CHANGED` and disables its **base layer** (`syncTownBaseInput` / `syncDefenseBaseInput`). **Transient** modes (e.g. `defense:ground-aim` while placing a ground spell) sit above gameplay but below modals; spell bar stays live, other combat chrome may dim. Guard direct handlers with `blocksBaseLayerInput(scene)` where needed. Tests: `src/input/inputModality.test.ts`.

### Display / mobile sharpness (`main.ts`, `src/ui/screenLayout.ts`)

- **Design canvas:** `GAME.width` × `GAME.height` is **540×1200** (9:20). On **1080×2400** panels, Phaser `Scale.FIT` lands on an **integer 2×** upscale (less fractional blur than the old 390×844 base).
- **`scale.autoRound`** and **`render.roundPixels`** snap canvas CSS size and texture draws. UI Text uses `registry.renderResolution` (capped DPR via `clampRenderResolution`) for extra sharpness on 3× browsers.
- **`bindViewportToScale(game)`** (in `main.ts`) sizes the parent from `visualViewport` and calls `updateBounds()` so pointers and `cameraWorldPoint()` stay aligned under FIT + mobile browser chrome.
- **Pixel art:** `configurePixelArtTextures` in Boot sets **nearest-neighbor** on sprite/ground keys; `SPRITE_DISPLAY` is **64px** on-screen (2×). UI buttons/text remain vector.
- **Fullscreen:** Town (top-left) and Debug menu toggle via `pointerup`. **iOS Safari** often lacks Fullscreen API — button shows **“Fullscreen: N/A (iOS)”** and no-ops.

---

## Related docs

- [Testing](./TESTING.md)
- [CI and releases](./CI_RELEASES.md)
- [Refactor plan](./REFACTOR_PLAN.md) — splitting `DefenseScene` and other large files
- [Roadmap](../ROADMAP.md) — milestones and known gaps