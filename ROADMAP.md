# Roadmap

Every item below still needs **some amount of work** (polish, content, tests, or engineering). Nothing is “finished” for a 1.0-quality release.

**Legend:** **Effort** — S (small), M (medium), L (large), XL (very large). **Baseline** — playable hook exists today; follow-up is polish or scope completion.

**Playable web build:** https://fred1878.github.io/DefenseGame/  
**Package version:** `0.1.0` (`package.json`) — tag `v0.1.0` not cut yet.

---

## Execution order (agent / team)

Do work in this sequence unless a PR blocks you. Steps **0** and **1** are **done**.

| Step | Work | Effort |
|------|------|--------|
| **0** | Merge [docs PR #108](https://github.com/fred1878/DefenseGame/pull/108) (`REFACTOR_PLAN.md`, README, this roadmap) — **done** | S |
| **1** | **DefenseScene refactor** — **done** (PRs 1–11, P1, P2; PR12 pooling skipped). Historical plan: [docs/REFACTOR_PLAN.md](./docs/REFACTOR_PLAN.md) | L |
| **2** | Tag **`v0.1.0`** + optional GitHub Release | S |
| **3** | Milestone **B** content (post–night 10, four town buildings) | M–L |
| **4** | Milestone **C** (cone art VFX, pooling) | M–L |
| **5** | Milestone **D** UX/audio/meta | L–XL |
| **6** | Milestone **F** Capacitor + stores | XL |

Continue from **step 2** (tag `v0.1.0`) or Milestone B. The historical refactor plan is archived; its line counts are stale.

### Refactor checklist (Milestone E detail)

Track [REFACTOR_PLAN.md](./docs/REFACTOR_PLAN.md) merge table:

- [x] PR1 — `DefenseSceneE2E.ts` ([#116](https://github.com/fred1878/DefenseGame/pull/116))
- [x] PR2 — `DefenseWaveSpawner.ts` ([#128](https://github.com/fred1878/DefenseGame/pull/128))
- [x] PR3 — `DefenseEnemySpawner.ts` ([#129](https://github.com/fred1878/DefenseGame/pull/129))
- [x] PR4 — `DefenseNightEnd.ts` ([#130](https://github.com/fred1878/DefenseGame/pull/130))
- [x] PR5 — `DefenseTargeting.ts` (direct `main`, `0688dbc`)
- [x] PR6 — `DefenseHudController.ts` (direct `main`, `53801f7`)
- [x] PR7 — `DefenseWorldBootstrap.ts` (`main`)
- [x] PR8 — `DefenseProjectileTick.ts`
- [x] PR9 — `DefenseEnemyTick.ts`
- [x] PR10 — `DefenseSpellDirector.ts` ([#131](https://github.com/fred1878/DefenseGame/pull/131))
- [x] PR11 — `systems/WaveSpawner.ts` promotion
- [ ] PR12 — Pooling (**skipped** — separate track per plan)
- [x] P1 — `touchButtonPress.ts`, `touchButtonFactories.ts`, `touchButtonGeometry.ts` ([#133](https://github.com/fred1878/DefenseGame/pull/133))
- [x] P2 — `enemyRanged/*` per-behavior modules ([#134](https://github.com/fred1878/DefenseGame/pull/134))

---

## Milestone A — v0.1 web release

| Item | Effort | Baseline today | Remaining work |
|------|--------|----------------|----------------|
| Boot → Town → Defense loop | M | Yes | Endless training mode UX copy; scene transition polish |
| Portrait 540×1200 + touch input | M | Yes | Keyboard hints; accessibility |
| `localStorage` saves | S | Yes | Migration tests for future `SAVE_VERSION` bumps |
| CI + Pages deploy | S | Yes | Keep green under refactor PRs |
| Tag `v0.1.0` | S | No | Cut tag after refactor PR1+ or after full step 1 |
| README / agent docs | S | PR #108 | Keep synced as features land |

---

## Milestone B — Core loop (nights 1–10+)

| Item | Effort | Baseline today | Remaining work |
|------|--------|----------------|----------------|
| Waves nights 1–10 | M | Yes | Balance pass; docs in `WAVES.md` |
| 12 enemy types | L | Yes | More behaviors tied to buildings; tuning |
| Wall win/lose + `NightResult` | M | Yes | Clearer lose UX; endless vs campaign rules |
| Wall + smith upgrades | M | Yes | More upgrade types |
| Gallows / spell bar buildings | S | Yes | Art and copy |
| **Campaign after night 10** | M | No | Ending or NG+; stop repeating night 10 wave |
| **Four unwired town buildings** | M | No | Haunted Well, Plague Clinic, both Market Stalls — effects + `upgradeId` |
| Endless concurrent spawn (if on `main`) | M | Partial | Polish, balance, docs |

---

## Milestone C — Spells & combat polish

| Item | Effort | Baseline today | Remaining work |
|------|--------|----------------|----------------|
| 22 spells in JSON | L | Yes | Balance, tooltips, VFX per spell |
| 8-slot spell bar + channeling | M | Yes | Cooldown UX, errors |
| Town spell sort panel | M | Yes | Mobile drag edge cases |
| Minimap + HUD chrome | M | Yes | Icons, scaling |
| **Cone / cone-of-fire VFX** | S | Gameplay only | Replace `SpellConeFx.ts` Graphics wedge with art |
| **Enemy + projectile pooling** | L | No | Pools per AGENTS.md; ties refactor PR12 |

---

## Milestone D — UX, audio, meta

| Item | Effort | Baseline today | Remaining work |
|------|--------|----------------|----------------|
| Title screen | M | No | Scene before Town |
| Settings menu | M | No | Volume, controls |
| Pause menu (player-facing) | M | No | Not only debug overlay |
| Tutorial | L | No | First night guidance |
| Audio / music | L | No | No `sound` usage in `src/` yet |
| Walk-cycle animations | L | No | Static facing sprites only |
| `weaponId` + `save.flags` | M | Persisted only | Gameplay unlocks / combat hooks |

---

## Milestone E — Engineering

| Item | Effort | Baseline today | Remaining work |
|------|--------|----------------|----------------|
| `DefenseScene` decomposition | L | Done (see execution order steps 0–1) | Further splits are follow-up work; archived plan line counts are stale |
| `touchButton` / `EnemyRangedCombat` splits | — | Done ([#133](https://github.com/fred1878/DefenseGame/pull/133), [#134](https://github.com/fred1878/DefenseGame/pull/134)) | — |
| `defenseNightLogic` pure guard | S | Yes | Keep covered when moving `endNight` |

---

## Milestone F — Mobile & stores

| Item | Effort | Baseline today | Remaining work |
|------|--------|----------------|----------------|
| Capacitor device smoke (AGENTS step 6) | M | `capacitor.config.ts` stub | Add packages, iOS/Android smoke |
| Store APK/IPA | XL | No | Signing, CI per `CI_RELEASES.md` |

---

## Related docs

- [README.md](./README.md)
- [docs/AGENTS.md](./docs/AGENTS.md)
- [docs/REFACTOR_PLAN.md](./docs/REFACTOR_PLAN.md)
- [docs/CI_RELEASES.md](./docs/CI_RELEASES.md)
- [docs/TESTING.md](./docs/TESTING.md)
- [docs/WAVES.md](./docs/WAVES.md)