# Testing — DefenseGame

## Layers

| Command | What it runs |
|---------|----------------|
| `npm run test` | Vitest unit + integration (`src/**/*.test.ts`) |
| `npm run test:coverage` | Vitest with `@vitest/coverage-v8` (HTML under `coverage/`) |
| `npm run build:e2e` | Production bundle with `VITE_E2E=true` (test hooks enabled) |
| `npm run test:e2e` | Playwright browser suites (`e2e/`) |

CI runs **`verify`** and **`e2e`** in parallel (each job runs its own `npm ci` and build):

| Job | Steps |
|-----|--------|
| `verify` | `typecheck`, `test`, production `build` |
| `e2e` | E2E `build`, Playwright (Chromium) |

Wall-clock time is roughly **max(verify, e2e)** instead of the sum.

**Parallel jobs:** `verify` and `e2e` run independently; a failure in one job leaves that job (and the workflow) at conclusion **failure**, not self-cancelled. PR pushes use workflow **concurrency** (`cancel-in-progress`) to drop superseded runs on the same PR.

Locally, run the same checks in sequence (or in two terminals): `npm run typecheck && npm run test && npm run build` and `npm run build:e2e && npm run test:e2e`.

## E2E gate

Hooks activate when **either**:

- Build-time `VITE_E2E=true`, or
- Runtime query `?e2e=1`

`ensureFreshBuild()` **skips** cache-bust reload in e2e mode so Playwright does not lose `?e2e=1`.

### `window.__DEFENSEGAME_E2E__`

| Field | Meaning |
|-------|---------|
| `ready` | Town or Defense scene is interactive |
| `scene` | Active Phaser scene key |
| `assetsLoaded` | Combat FX textures present after Boot |
| `player` | World position in Defense |
| `flags` | Scenario markers (e.g. `meleeFxSpawned`) |
| `api` | Input / save helpers (see below) |

Save in e2e mode uses `localStorage` key **`defensegame-e2e-save`** (cleared in specs).

### API (`__DEFENSEGAME_E2E__.api`)

- `startNight()`, `setStick(dx, dy, ms?)`, `clearStick()`
- `tapMelee()`, `tapRanged()`, `castSpell(slot)`
- `getSave()` / `setSave(partial)`
- `spawnTestEnemy()`, `setGodMode()`, `damagePlayer()`, `killAllEnemies()`, `forceWinNight()`
- `textureLoaded(key)`, `getAttackPhase()`, `getProjectileCount()`, `sampleFps(seconds?)`
- `getUiTapTargets()` / `isUiButtonPressed(testId)` — canvas tap centers and press-scale state

DOM mirror for Playwright: hidden `[data-testid="start-night"]` button (e2e only).

E2e runs use `game.loop.timeScale = 2` to shorten combat timings.

### Manual return path (`?manualReturn=1`)

Golden-path specs auto-skip to Town after night end. UX specs add `manualReturn=1` (or `api.setManualReturnToTown(true)`) so **Return to town** stays visible until tapped.

### DOM mirrors + canvas taps

Hidden `[data-testid]` buttons track combat UI centers from `api.getUiTapTargets()` / `api.syncDomMirrors()`. Prefer **canvas** `tap()` at those coordinates for real Phaser pointer input; DOM mirrors are a stable fallback.

## Vitest suites (representative)

| Area | File |
|------|------|
| Pathfinding / LOS | `src/pathfinding/pathfinding.test.ts` |
| Enemy AI target pick | `src/ai/EnemyBrain.test.ts` |
| Enemy combat FSM / wall hits | `src/entities/EnemyCombat.test.ts` |
| Hitbox / damage / knockback | `src/combat/*.test.ts` |
| GameState / DataStore | `src/core/*.test.ts` |
| Layout math | `src/ui/screenLayout.test.ts` |
| Stick mask + gesture FSM | `src/input/VirtualStick.test.ts` |
| Night-end guards | `src/scenes/defenseNightLogic.test.ts` |
| Touch slop | `src/ui/touchButtonGesture.test.ts`, `touchButton.test.ts` |

## Playwright suites

| Spec | Covers |
|------|--------|
| `smoke.spec.ts` | Boot, assets, enter Defense |
| `golden-path.spec.ts` | API cheats: movement, melee/ranged FX, spells, win/lose |
| `touch-input.spec.ts` | Real `canvas.tap()` / `dragCanvas()` on ATK, mode, spells; drag-off press clear |
| `combat-real.spec.ts` | Spawn + kill enemies, wall HP drop (no god mode) |
| `night-end.spec.ts` | Return button + manual town transition |
| `town-touch.spec.ts` | Start night tap; drag-off cancel on Start night |
| `defense-hud-layout.spec.ts` | HUD geometry, spell row in viewport, no bottom chrome |
| `spellbar-textures.spec.ts` | Spell icon textures loaded at 64×64 |
| `town-spell-panel-*.spec.ts` | Town spell editor layout, tap, drag |
| `fps.spec.ts` | FPS sampling hook |

CI runs **Chromium only** (`npm run test:e2e -- --project=chromium` in `.github/workflows/ci.yml`). The `mobile-chrome` project is optional for local device checks.

## Manual review captures vs e2e

- **CI:** No `toHaveScreenshot` and **no committed snapshot PNGs** under `e2e/`. UI correctness is covered by tap targets, layout probes, texture audits, and related specs.
- **Human review:** After intentional UI changes, run `scripts/capture-ui-visual.mjs` (or `capture-defense-hud.mjs`). See **[MANUAL_UI_CAPTURE.md](./MANUAL_UI_CAPTURE.md)** for paths, md5 checks, and stale-hash policy.

## Adding a Playwright spec

1. `gotoE2E(page)` — waits for Town + `ready`.
2. Prefer `api` over raw canvas coordinates.
3. Wait on `__DEFENSEGAME_E2E__` fields, not fixed `sleep`.
4. Assert behavior, layout, or asset hooks — not full-page pixels.

## Local workflow

```bash
npm run build:e2e
npm run test:e2e
# or chromium only:
npx playwright test --project=chromium
```

Playwright `webServer` serves `dist/` via `vite preview` on port **4173** (see `playwright.config.ts`).

## Coverage notes

Vitest thresholds apply to included `src/**` modules (scenes and Phaser boot stay excluded). `npm run test:coverage` enforces modest line/branch floors in CI.