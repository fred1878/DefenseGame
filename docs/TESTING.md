# Testing — DefenseGame

## Layers

| Command | What it runs |
|---------|----------------|
| `npm run test` | Vitest unit + integration (`src/**/*.test.ts`) |
| `npm run test:coverage` | Vitest with `@vitest/coverage-v8` (HTML under `coverage/`) |
| `npm run build:e2e` | Production bundle with `VITE_E2E=true` (test hooks enabled) |
| `npm run test:e2e` | Playwright browser suites (`e2e/`) |

CI runs **`verify`** and **`e2e`** in parallel (each job runs its own `npm ci` and build when e2e is not skipped):

| Job | Steps |
|-----|--------|
| `verify` | Always: `typecheck`, `test`, production `build` |
| `changes` | Path filter + (on `main` only) conflict-merge detection → `run_e2e` |
| `e2e` | When `run_e2e`: E2E `build`, Playwright (Chromium). Otherwise one skip step (job still green). |

**When Playwright runs**

| Event | E2E |
|--------|-----|
| **PR → `main`** | Only if the diff touches gameplay paths (`src/`, `e2e/`, `public/`, `index.html`, Vite/TS/Playwright config, `package*.json`). Docs / other `.github/workflows` → skipped. |
| **Push to `main`** | Only if paths match **and** the commit is a **merge commit that resolved conflicts** (auto-merge tree ≠ landed tree, or `merge-tree` reports conflicts). Clean squash/merge → skipped on `main`. |

Wall-clock time is roughly **max(verify, e2e)** when e2e runs; doc-only PRs are usually **`verify` only**.

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

### CI gate (`CI=1` / GitHub `e2e` job)

`playwright.config.ts` sets `grepInvert: /@manual/` when `CI` is set, so suites and tests whose **describe or title** contains `@manual` are skipped in CI but still run locally via `npm run test:e2e` or `npm run e2e:manual`.

Locally mirror CI: `npm run test:e2e:ci` (Chromium only, same filter as Actions).

| Spec | Covers |
|------|--------|
| `smoke.spec.ts` | Boot, assets, enter Defense |
| `golden-path.spec.ts` | API cheats: movement, melee/ranged FX, spells, win/lose |
| `touch-input.spec.ts` | Core canvas taps / drag-off on combat controls (DOM-mirror + press-visual variants are `@manual`) |
| `combat-real.spec.ts` | Spawn + kill enemies, wall HP drop (no god mode) |
| `night-end.spec.ts` | Return button + manual town transition |
| `endless-mode.spec.ts`, `endless-mode-panel-layout.spec.ts`, `endless-respawn-targeting.spec.ts` | Endless training flow, panel behavior, respawn targeting |
| `town-touch.spec.ts` | Start night, Haunted Well / endless, drag-off (building debug overlay is `@manual`) |
| `town-spell-panel-tap-toggle.spec.ts` | Town spell pool tap add/remove |
| `defense-hud-layout.spec.ts` | Core HUD chrome + combat anchor layout (minimap / play-band projection probes are `@manual`) |
| `defense-camera-scroll.spec.ts` | Camera follows player on tall map |
| `obstacle-bump-capture.spec.ts` | Player–obstacle separation (stick push cardinals) |

**Expected CI e2e wall-clock (Chromium, 4 workers, `timeScale` 2):** about **4–7 minutes** on `ubuntu-24.04` after the `@manual` trim (~40 gate tests). Full local suite (~60 tests) is typically **8–12 minutes**. Verify job still downloads `dist-e2e` from `verify` (no duplicate E2E build in the e2e job).

### Local-only (`@manual` in title/describe)

| Spec / test | Why local |
|-------------|-----------|
| `obstacle-bump-metrics.spec.ts` | Writes metrics JSON for human review |
| `obstacle-*-capture.spec.ts`, `obstacle-v2-visual-proof.spec.ts` | Visual capture / proof overlays |
| `defense-hud-band-pixels.spec.ts`, `defense-hud-reentry.spec.ts` | Fragile luminance sampling |
| `defense-play-area-viewport.spec.ts` | Overlaps HUD layout probes |
| `spellbar-textures.spec.ts` | Asset audit; boot already checks combat FX in smoke |
| `town-spell-panel-layout.spec.ts`, `town-spell-panel-drag.spec.ts` | Redundant with tap-toggle behavior |
| `fps.spec.ts` | Weak threshold (`> 5` fps); hook smoke only |

CI runs **Chromium only** (`npm run test:e2e -- --project=chromium` with `CI=true` in `.github/workflows/ci.yml`). The `mobile-chrome` project is optional for local device checks. Traces: **on-first-retry** in CI; **retain-on-failure** locally.

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