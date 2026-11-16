# Roadmap

Checkbox milestones for DefenseGame. Items marked **[x]** are implemented in `main` today (verified against source). Order is suggested, not mandatory.

**Playable web build:** https://fred1878.github.io/DefenseGame/  
**Package version:** `0.1.0` (`package.json`) — first git tag `v0.1.0` not cut yet.

---

## Milestone A — v0.1 web release (current focus)

Ship a coherent browser build on GitHub Pages with honest docs and green CI.

- [x] Boot → Town → Defense loop (`BootScene`, `TownScene`, `DefenseScene`)
- [x] Portrait layout 540×1200, touch virtual stick + action buttons (`main.ts`, `VirtualStick`)
- [x] `localStorage` save/load (`GameState`, `saveTypes.ts`)
- [x] CI: typecheck + Vitest + build + Playwright on PRs (`ci.yml`)
- [x] Pages deploy on `main` (`pages.yml`, `docs/CI_RELEASES.md`)
- [ ] **Tag `v0.1.0`** and optional GitHub Release zip (`release.yml`) — version already `0.1.0`
- [x] README + agent docs reflect shipped features (this pass)

---

## Milestone B — Core loop complete (nights 1–10)

- [x] Waves for nights **1–10** in `public/data/waves.json`
- [x] **12 enemy types** in `public/data/enemies.json` (grunt, bruiser, arrow_rain_archer, skirmisher, sentry_archer, javelineer, slow_siege, fast_sapper, charger, lobber, reaver, ward)
- [x] North wall objective + win/lose via `evaluateNightEnd` / `NightResult`
- [x] Town upgrades: wall HP + blacksmith damage (`buildings.json`, Moon Brazier / Witchlight Beacon hooks)
- [x] Gallows Square starts night; Witchlight Beacon (daylit) opens spell sort UI
- [ ] **Campaign past night 10** — `DataStore.getWaveForNight` repeats the highest defined night (10) for `night > 10`; no ending scene yet
- [ ] Wire **four town buildings** still showing “Not available yet” (`townBuildingMenu.ts`): Haunted Well, Plague Clinic, Market Stall (night), Market Stall (daylit) — no `upgradeId` in `town_buildings.json`

---

## Milestone C — Spells & combat polish

- [x] **22 spells** catalog in `public/data/spells.json` (loaded in Boot)
- [x] Defense **8-slot** spell bar (4×2) + channeling `CastBar` (`SPELL_BAR.slotCount`)
- [x] Town spell pool drag-sort overlay (`SpellBarSortPanel`)
- [x] Minimap + combat HUD chrome (`DefenseMinimap`, `combatHudChrome`)
- [ ] **Cone of Fire (and cone) VFX** — gameplay works via `applySpellCone` / `SpellConeFx.ts` but VFX is procedural `Graphics` (orange wedge placeholder, not art-backed like other MRPG FX)
- [ ] **Enemy / projectile pooling** — spawn/destroy each instance (`spawnEnemy`, projectile `filter` + `sprite.destroy`); AGENTS.md calls for pools before scaling further

---

## Milestone D — UX, audio, meta

- [ ] **Title screen** — game starts at Town after Boot (no title scene in `main.ts` scene list)
- [ ] **Settings menu** (volume, controls, reset) — only Debug menu + town reset today
- [ ] **Pause menu** in Defense — debug overlay pauses via `DebugMenuScene`, not a player-facing pause
- [ ] **Tutorial** — no guided first-night flow
- [ ] **Audio / music** — no Phaser sound usage in `src/` yet
- [ ] **Walk-cycle animations** — player/enemies use directional static sprites (`player_n/e/s/w`, enemy facings); no walk animation system
- [ ] **`weaponId` and `save.flags`** — persisted in `SaveGame` (`GameState.createNew`) but not read for combat or unlock logic

---

## Milestone E — Engineering / maintainability

- [ ] **`DefenseScene` refactor** per [docs/REFACTOR_PLAN.md](./docs/REFACTOR_PLAN.md) (~10–12 PRs; `WaveSpawner` still inline in scene)
- [ ] Split **`touchButton.ts`** / **`EnemyRangedCombat.ts`** when touching those areas (see refactor plan P1–P2)
- [x] Pure night-end guard extracted (`defenseNightLogic.ts` + tests)

---

## Milestone F — Mobile & stores

- [ ] **Capacitor device smoke test** (AGENTS.md step 6) — `capacitor.config.ts` stub only; `@capacitor/*` not in `package.json`
- [ ] Signed **store builds** (APK/IPA) per `docs/CI_RELEASES.md` “Future: mobile store builds”

**Suggested sequence after web v0.1:** finish Milestone B content gaps → Milestone C VFX/pooling → Milestone D polish → Milestone E refactor in parallel with content → Milestone F.

---

## Related docs

- [README.md](./README.md)
- [docs/AGENTS.md](./docs/AGENTS.md)
- [docs/REFACTOR_PLAN.md](./docs/REFACTOR_PLAN.md)
- [docs/CI_RELEASES.md](./docs/CI_RELEASES.md)
- [docs/TESTING.md](./docs/TESTING.md)
- [docs/WAVES.md](./docs/WAVES.md)