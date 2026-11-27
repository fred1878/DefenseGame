# Testing — DefenseGame

## Layers

| Command | What it runs |
|---------|----------------|
| `npm run verify` | Local inner loop: `typecheck` (src + e2e + configs) → `lint` → `knip` → `check:arch` → Vitest |
| `npm run lint` | `biome check`: lint + formatting; warnings fail too (`--error-on-warnings`) |
| `npm run knip` | Unused files / exports / deps (config: `knip.json`) |
| `npm run check:arch` | Runtime import cycles + folder layer rules in `src/` (`scripts/check-architecture.mjs`). Fails on new debt and on fixed debt still listed in `scripts/data/architecture-baseline.json`; refresh with `node scripts/check-architecture.mjs --update-baseline` after removing debt. The baseline has been **empty** since refactor phase P1 and `--update-baseline` can only remove entries, so any new cycle or layer violation fails the gate. |
| `npm run format` | Biome formatter; run it when `lint` reports formatting |
| `npm run test` | Vitest unit + integration (`src/**/*.test.ts`) |
| `npm run test:coverage` | Vitest with `@vitest/coverage-v8` (HTML under `coverage/`) |
| `npm run build:e2e` | Production bundle with `VITE_E2E=true` (test hooks enabled) |
| `npm run test:e2e` | Playwright browser suites (`e2e/`) |

The **`e2e`** job **needs `verify`** (they run sequentially, not in parallel). Each job still has its own `npm ci`. When e2e is skipped, the e2e job is a single skip step (still green).

| Job | Steps |
|-----|--------|
| `verify` | Always: `typecheck`, `lint`, `knip`, `check:arch`, `test:coverage`, then `build:app` (Vite build without a second `tsc`; production, or E2E build when `run_e2e`) |
| `changes` | Path filter + (on `main` only) conflict-merge detection → `run_e2e` |
| `e2e` | Starts after `verify`. When `run_e2e`: downloads the e2e `dist` artifact, Playwright (Chromium). Otherwise one skip step (job still green). |

**When Playwright runs**

| Event | E2E |
|--------|-----|
| **PR → `main`** | Only if the diff touches gameplay paths (`src/`, `e2e/`, `public/`, `index.html`, Vite/TS/Playwright config, `package*.json`). Docs / other `.github/workflows` → skipped. |
| **Push to `main`** | Only if paths match **and** the commit is a **merge commit that resolved conflicts** (auto-merge tree ≠ landed tree, or `merge-tree` reports conflicts). Clean squash/merge → skipped on `main`. |

Wall-clock time is roughly **verify + e2e** when e2e runs (e2e waits for verify); doc-only PRs are usually **`verify` only**.

**Job failure:** a failure in `verify` skips a real e2e run (`e2e` needs `verify`). A failure leaves the workflow at conclusion **failure**, not self-cancelled. PR pushes use workflow **concurrency** (`cancel-in-progress`) to drop superseded runs on the same PR.

Local inner loop: `npm run verify` (typecheck + Vitest). Before a merge-ready PR, also `npm run build`, and when gameplay paths change `npm run build:e2e && npm run test:e2e`.

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

## Vitest data fixtures

**Do not assert gameplay tuning from shipped `public/data/*.json` in unit tests.** Balance numbers change often; Vitest should use **inline minimal fixtures** and assert **normalization, validation, defaults, and wiring** only. Reserve reading shipped JSON for dedicated integration tests (for example `DataStore.integration.test.ts`, `dataFieldsDoc.test.ts`) that intentionally verify catalog shape or doc parity — not spell/enemy/player balance values.

## Vitest suites (representative)

| Area | File |
|------|------|
| Pathfinding / LOS | `src/pathfinding/pathfinding.test.ts` |
| Enemy AI target pick | `src/ai/brainShared.test.ts` |
| Enemy combat FSM / wall hits | `src/entities/EnemyCombat.test.ts` |
| Hitbox / damage / knockback | `src/combat/rules/*.test.ts` (VFX: `src/combat/fx/*.test.ts`) |
| GameState / DataStore | `src/core/*.test.ts` |
| Layout math | `src/ui/screenLayout.test.ts` |
| Stick mask + gesture FSM | `src/input/VirtualStick.test.ts` |
| Night-end guards and save rules | `src/systems/nightEndRules.test.ts` |
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
| `save-menu.spec.ts` | Daylit Market Stall opens the save menu; close and reopen |
| `gear.spec.ts` | Inventory screen (town Gear): equip, sell, consumables tab; loot drops |
| `shops.spec.ts` | Trader and blacksmith shop panels: buy, Buy & Equip, sell tab, upgrade + reroll |
| `town-spell-panel-tap-toggle.spec.ts` | Town spell pool tap add/remove |
| `defense-hud-layout.spec.ts` | Core HUD chrome + combat anchor layout (minimap / play-band projection probes are `@manual`) |
| `defense-camera-scroll.spec.ts` | Camera follows player on tall map |
| `obstacle-bump-capture.spec.ts` | Player–obstacle separation (stick push cardinals) |

**Workers:** `playwright.config.ts` uses `E2E_WORKERS` when set; otherwise **6** in CI (`CI` set) and **1** locally. GitHub Actions sets `E2E_WORKERS=8` on the Playwright step.

**Expected CI e2e wall-clock (Chromium, 8 workers, `timeScale` 2):** about **3–6 minutes** on `ubuntu-24.04` after the `@manual` trim (~47 gate tests). Full local suite (~60 tests) is typically **8–12 minutes** (still 1 worker unless you set `E2E_WORKERS`). Verify job still downloads `dist-e2e` from `verify` (no duplicate E2E build in the e2e job).

**VM benchmark (gated Chromium, same `ubuntu-24.04` class runner, post-`npm run build:e2e`):** Nov 2026 cloud-agent VM, **47** gated tests (`grepInvert @manual`):

| Workers | Wall-clock (s) | Playwright reported | Flakes/retries |
|--------:|---------------:|---------------------|----------------|
| 6 | 67 | 1.1m | none (47/47) |
| **8** (CI default) | **62** | 1.0m | none (47/47) |

GitHub `ubuntu-24.04` free runners are typically slower — use the **ratio** (~8% faster at 8 vs 6 workers here), not these absolute seconds, for CI planning.

Parallel PR e2e jobs are unchanged (no repo-wide queue); only per-spec file parallelism inside a job increases with worker count.

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

CI runs **Chromium only** (`npm run test:e2e -- --project=chromium` with `CI=true` and `E2E_WORKERS=8` in `.github/workflows/ci.yml`). The `mobile-chrome` project is optional for local device checks. Traces: **on-first-retry** in CI; **retain-on-failure** locally.

## Manual review captures vs e2e

- **CI:** No `toHaveScreenshot` and **no committed snapshot PNGs** under `e2e/`. UI correctness is covered by tap targets, layout probes, texture audits, and related specs.
- **Human review:** After intentional UI changes, run `scripts/capture-ui-visual.mjs` (or `capture-defense-hud.mjs`). See **[MANUAL_UI_CAPTURE.md](./MANUAL_UI_CAPTURE.md)** for paths, md5 checks, and stale-hash policy.

## Adding a Playwright spec

1. `gotoE2E(page)` — waits for Town + `ready`.
2. Prefer `api` over raw canvas coordinates.
3. Wait on `__DEFENSEGAME_E2E__` fields, not fixed `sleep`.
4. Assert behavior, layout, or asset hooks — not full-page pixels (the only exception is `visual-screens.spec.ts`, below).

## Local workflow

```bash
npm run build:e2e
npm run test:e2e
# or chromium only:
npx playwright test --project=chromium
```

Playwright `webServer` serves `dist/` via `vite preview` on port **4173** (see `playwright.config.ts`).

## Coverage notes

`npm run test:coverage` (CI `verify` job) enforces thresholds in `vitest.config.ts`:

| Metric | Floor | Typical actual |
|--------|------:|---------------:|
| lines / statements | 94% | ~95% (scenes/world modules in scope) |
| functions | 95% | ~96% |
| branches | 90% | ~92% |

**Excluded from coverage:** Phaser scene orchestrators (`BootScene`, `TownScene`, `DefenseScene`, setup scenes), production entries (`bootstrap.ts`, `gameMain.ts`), E2E-only scene adapters (`DefenseSceneE2E*`, `TownSceneE2E`), and Capacitor update stubs. Everything under `src/scenes/defense/*` (except E2E adapters) and `src/world/**` **is** included — test with `fakeScene` / pure helpers. Playwright still covers full scene integration. Do not lower thresholds without team agreement (old baselines were 75 / 69).
## Visual checks (screenshot baselines)

`e2e/visual-screens.spec.ts` compares screens against PNG baselines in `e2e/visual-screens.spec.ts-snapshots/` (Chromium project only):

| Screenshot | State |
|---|---|
| `town` | Town after boot, fresh save |
| `endless-panel-scrolled` | Endless panel with the roster scrolled 130 px (rows cut off at both list edges, so a missing clip mask shows) |
| `wave-planner` | Wave planner opened from the Plague Clinic |
| `defense-night-won` | Defense after the night is won (no enemies, HUD + return button) |
| `defense-night-lost` | Defense after the player dies (summary panel) |
| `blacksmith` | Blacksmith shop (Moon Brazier), night 2, 140g, first card selected with compare |
| `inventory` | Inventory (town Gear), night 4, two equipped items, bag item selected |

Determinism (`e2e/helpers/visual.ts`): `Math.random` is a fixed-seed PRNG, Phaser's `requestAnimationFrame` loop is frozen before capture (e2e builds use `preserveDrawingBuffer`), and CSS animations are disabled. Fonts are pinned for this spec only: its browser gets `FONTCONFIG_FILE=e2e/fonts/fonts.conf`, which maps every family (the UI stack starts with `system-ui`) to the bundled DejaVu Sans, so text renders identically on any Linux machine. The e2e build id must be `e2e-local` (used by `npm run build:e2e` and CI) because the Town header prints it. Tolerance: per-pixel `threshold` 0.2 and at most 0.2% differing pixels; a roster-mask regression changes ~14%.

Baselines were generated on CI's runner (ubuntu-24.04, software WebGL). If a change is intentional, regenerate and review the diff:

```bash
npm run build:e2e
npx playwright test e2e/visual-screens.spec.ts --project=chromium --update-snapshots
```

If your local renderer differs from CI, take the `actual` PNGs from the failed CI run's `playwright-report` artifact instead.

## Defense enemy-loop safety net (refactor plan P0.3 / P0.4)

`src/test/defenseTickHarness.ts` runs the real `tickDefenseEnemies` headless: N enemies cycling every shipped behaviour, a fixed player, the wall, and sprite positions integrated from the AI's velocities (fake scene, all FX textures "exist").

| Check | Command | Notes |
|---|---|---|
| Golden behaviour snapshot | part of `npm run test` (`src/scenes/defense/defenseGolden.test.ts`) | Digests of positions, HP, combat phase, wall/player HP and projectile count after 10×600, 30×300 and 60×120 frames. Keyed by a hash of the shipped `public/data` tuning files: after a balance edit the comparison is **skipped** until refreshed with `UPDATE_GOLDEN=1 npx vitest run defenseGolden`. A refactor that changes a digest while the data hash is unchanged is a behaviour change. |
| Enemy-loop perf | `npm run perf` | Opt-in (PERF=1). Prints median ms per frame for 20 / 60 / 120 enemies. Compare on the same machine only. |

Baseline on the agent box (2026-11-27, Node 24; noisy, medians of 5 × 120 frames):

| Code | 20 enemies | 60 enemies | 120 enemies |
|---|---:|---:|---:|
| Before QW3 (per-pair peer rows) | 0.50 ms | 14.4 ms | 17.2 ms |
| After QW3 (per-frame peer rows) | 0.30 ms | 14.6 ms | 12.0 ms |

At 60+ enemies the cost is dominated by A* replans with peer agents (`pathfinding/astar.ts`), not allocation.

## Complexity gate

Biome's `noExcessiveCognitiveComplexity` runs as an error with a cap of
**25** per function. Nineteen legacy files (listed in the `overrides` block of
`biome.json`) are held at the current worst score (84, `tickDefenseEnemies`)
until they are split up by the refactor plan; remove a file from that list
once its functions are under 25. Never add new files to it.
