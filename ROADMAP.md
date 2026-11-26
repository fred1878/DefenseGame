# Roadmap

Every item below still needs **some amount of work** (polish, content, tests, or engineering) unless marked done. Nothing except the noted engineering and install work is “finished” for a 1.0-quality release.

**Legend:** **Effort** — S (small), M (medium), L (large), XL (very large). **Baseline** — playable hook exists today; follow-up is polish or scope completion.

**Playable web build:** https://fred1878.github.io/DefenseGame/ (installable PWA — Add to Home Screen / Install app; works offline after the first load)  
**Package version:** `0.1.0` (`package.json`) — tag `v0.1.0` not cut yet.

---

## Recently landed

| Work | Notes |
|------|--------|
| **Phaser 4.2.1** | Custom trimmed vendor chunk; Vite 8 / Vitest 5 |
| **Strict TypeScript** | `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `allowImportingTsExtensions` |
| **Nights 13–20, buy requests** | 20-night campaign (`hpMul` / `damageMul` / elite groups), item tables to ilvl ~19, worse night drops, cheaper shop upgrades and rerolls, 8 wall levels, trader buy requests (Wants tab, 150% payout), win model re-weighted from real-combat runs (`e2e/win-model.spec.ts`) — see `docs/ECONOMY_SIM.md`, `docs/ITEMS.md`, `docs/WAVES.md` |
| **Test coverage** | Around 98% lines, 96% branches; thresholds 95 / 95 / 95, branches 90 |
| **Combat targeting fixes** | [#340](https://github.com/fred1878/DefenseGame/pull/340) — chain-lightning first hop, nearest-enemy fallback skips dead enemies, projectile knockback at the impact point |
| **Installable PWA** | Web app manifest + service worker on GitHub Pages; precaches JS chunks (including Phaser and lazy scenes), data, images and audio. A new deploy activates on the next load |
| **Damage numbers** | Pixelify Sans popups styled by damage type, pooled and combined per target |
| **Equipment (Milestone H)** | [#362](https://github.com/fred1878/DefenseGame/pull/362) — 11 slots (melee, ranged, helm, chest, hands, legs, boots, 2 rings, 2 trinkets); `public/data/items.json` with item levels, 5 rarities, random affixes and authored uniques; armour (diminishing), attack speed, spell power, damage, HP, move speed, lifesteal / burn / chain procs, element and named-spell boosts; weapons change attack style |
| **Inventory and drops (Milestone H)** | [#363](https://github.com/fred1878/DefenseGame/pull/363) — Gear panel (equip, unequip, compare, sort, sell for half price); end-of-night drops scaled by night from `public/data/loot.json`, with a `rollLoot` hook for adventure drops |
| **Shops and consumables (Milestone H)** | [#364](https://github.com/fred1878/DefenseGame/pull/364) — Trader in the night Market Stall (random stock, rerolls after each night) and Blacksmith at the Moon Brazier (catalogue unlocks by night; replaces the old damage upgrade); potions and bombs from `public/data/consumables.json`, usable in combat via buttons or Q / E |
| **Campaign night loot summary** | [#366](https://github.com/fred1878/DefenseGame/pull/366) — End-of-night overlay (result, gold, rarity-coloured drops, auto-sold items, wall HP) via `resolveCampaignNightEnd` / `NightLootSummaryPanel` |
| **Economy / progression sim** | [#367](https://github.com/fred1878/DefenseGame/pull/367) — `npm run sim:economy` Monte Carlo over real gear/loot/shop code; [docs/ECONOMY_SIM.md](./docs/ECONOMY_SIM.md) and [docs/ITEMS.md](./docs/ITEMS.md) |
| **Economy rebalance + shop upgrades** | [#371](https://github.com/fred1878/DefenseGame/pull/371) — Sell-back 30%, lost nights pay 15% and drop nothing, night 10 reward 170, cheaper late blacksmith items, stronger potions / bombs; Trader and Blacksmith upgrade 3 levels each in their shop panel (more / better stock, lower prices, masterwork items, paid trader reroll); 8 more sim profiles |

---

## Execution order (agent / team)

Do work in this sequence unless a PR blocks you. Steps **0**, **1**, and the PWA install are **done**. Tag `v0.1.0` (step 2) can slip if a content milestone is ready first.

Spell interactions come next after remaining campaign polish because they sit on the spells already in the game. Town upgrades deepen the existing day phase and create the economy later systems spend into. Equipment shops need those buildings. Talents are a second progression layer on a character who can already wear gear. The wall-defense maze is a large pathfinding and placement feature, and a gold sink, so it follows the town economy. Daytime adventuring is the largest new loop and is more rewarding once shops, gear, and upgrades exist to spend loot on.

| Step | Work | Effort |
|------|------|--------|
| **0** | Merge [docs PR #108](https://github.com/fred1878/DefenseGame/pull/108) (`REFACTOR_PLAN.md`, README, this roadmap) — **done** | S |
| **1** | **DefenseScene refactor** — **done** (PRs 1–12, P1, P2; pooling landed in `5bc75e1`). Historical plan: [docs/archive/REFACTOR_PLAN.md](./docs/archive/REFACTOR_PLAN.md) | L |
| **2** | Tag **`v0.1.0`** + optional GitHub Release | S |
| **3** | Milestone **B** remaining content (campaign ending after night 20, night polish) | M–L |
| **4** | Milestone **C** remaining (cone art VFX, **spell interactions**; damage numbers — tuning only) | M–L |
| **5** | Milestone **G** — Fully upgradeable town | L |
| **6** | Milestone **H** — Equipment, shops, and traders — core **done** (see Recently landed); follow-ups below | L |
| **7** | Milestone **I** — Talents | L |
| **8** | Milestone **J** — Wall defenses (tower-defense maze) | XL |
| **9** | Milestone **K** — Daytime adventuring and quests | XL |
| **10** | Milestone **D** — UX, audio, meta | L–XL |
| **11** | Milestone **F** — Capacitor + stores | XL |

### Refactor checklist (Milestone E detail)

Track [REFACTOR_PLAN.md](./docs/archive/REFACTOR_PLAN.md) merge table (all done):

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
- [x] PR12 — Pooling (enemy + projectile pools; `DefenseEnemySpawner`, `projectilePool.ts`)
- [x] P1 — `touchButtonPress.ts`, `touchButtonFactories.ts`, `touchButtonGeometry.ts` ([#133](https://github.com/fred1878/DefenseGame/pull/133))
- [x] P2 — `enemyRanged/*` per-behavior modules ([#134](https://github.com/fred1878/DefenseGame/pull/134))

---

## Milestone A — v0.1 web release

| Item | Effort | Baseline today | Remaining work |
|------|--------|----------------|----------------|
| Boot → Town → Defense loop | M | Yes | Endless training mode UX copy; scene transition polish |
| Portrait 540×1200 + touch input | M | Yes | Keyboard hints; accessibility |
| `localStorage` saves | S | Yes | Migration tests for future `SAVE_VERSION` bumps |
| CI + Pages deploy | S | Yes | Keep green under later feature PRs |
| **Installable PWA** | M | **Yes** | Manifest + service worker; offline after first load; updates on next load. Further polish only (install prompt UX) |
| Tag `v0.1.0` | S | No | Cut tag when ready for a named web release |
| README / agent docs | S | PR #108 | Keep synced as features land |

---

## Milestone B — Core loop (nights 1–20+)

| Item | Effort | Baseline today | Remaining work |
|------|--------|----------------|----------------|
| Waves nights 1–20 | M | Yes | Balance pass (use `npm run sim:economy` for economy); docs in `WAVES.md` |
| 12 enemy types | L | Yes | More behaviors tied to buildings; tuning |
| Wall win/lose + `NightResult` | M | Yes | Clearer lose UX; endless vs campaign rules |
| Wall upgrades | M | Yes | More upgrade types — expanded in Milestone **G**. The smith damage upgrade was replaced by gear (Milestone **H**) |
| Gallows / spell bar buildings | S | Yes | Art and copy |
| **Campaign after night 20** | M | No | Today: `night` keeps advancing on wins and `getWaveForNight` **repeats the night-20 wave**. Need ending or NG+ and explicit post-12 rules (endless unlock, credits, etc.) |
| **Town building wiring** | S | **Done** | Haunted Well (endless), Plague Clinic (wave planner), night Market Stall (Trader + Gear), daylit Market Stall (saves) |
| Endless concurrent spawn (if on `main`) | M | Partial | Polish, balance, docs |

---

## Milestone C — Spells & combat polish

| Item | Effort | Baseline today | Remaining work |
|------|--------|----------------|----------------|
| 23 spells in JSON | L | Yes | Balance, tooltips, VFX per spell |
| 8-slot spell bar + channeling | M | Yes | Cooldown UX, errors |
| Town spell sort panel | M | Yes | Mobile drag edge cases |
| Minimap + HUD chrome | M | Yes | Icons, scaling |
| **Cone / cone-of-fire VFX** | S | Gameplay only | Replace `SpellConeFx.ts` Graphics wedge with art |
| **Enemy + projectile pooling** | L | Yes | Landed (`projectilePool.ts`, `DefenseEnemySpawner`); profile on low-end phones |
| **Spell interactions / combos** | L | No | Spells affect each other: freeze + lightning shatters, fire spreads through groups, rain boosts lightning, and similar combos. Reward spell-bar order and timing |
| **Damage numbers** | M | Yes | Tuning only (`src/config/damageNumbers.ts`) |

---

## Milestone G — Fully upgradeable town

Deepen the existing day phase so the town itself is the long-term progression surface.

| Item | Effort | Baseline today | Remaining work |
|------|--------|----------------|----------------|
| Upgradeable walls | M | Partial | Wall HP upgrades exist; more tiers, visuals, and gates for later wall-defense slots |
| Economic buildings (income) | L | No | Buildings that generate gold (or materials) between nights; upgrade their yield |
| Market stalls | M | Wired | Night stall is the Trader (3 upgrade levels: stock, rarities, prices, reroll), daylit stall holds saves; more stall types |
| Blacksmith | M | Shop | Moon Brazier sells a catalogue unlocking by night, with 3 upgrade levels (discount, masterwork stock, earlier unlocks); add crafting, reforging affixes or upgrading item level |
| Traders | M | Partial | One Trader with daily random stock; add visiting traders or themed stock |
| Town centre | L | No | A central building that unlocks civic upgrades and later features |
| Upgrade the buildings themselves | L | Partial | Every building has tiers (look, bonuses, unlocks), not only a single purchase |

---

## Milestone H — Equipment, shops, and traders

| Item | Effort | Baseline today | Remaining work |
|------|--------|----------------|----------------|
| Gear slots and stats | L | **Done** ([#362](https://github.com/fred1878/DefenseGame/pull/362), [#363](https://github.com/fred1878/DefenseGame/pull/363)) | Balance pass once more nights exist; more uniques and affixes; gear visuals on the player sprite |
| Equipment shops / traders | L | **Done** ([#364](https://github.com/fred1878/DefenseGame/pull/364)) | Shop upgrade tiers done; buy-back of sold items |
| Consumables | M | Potions and bombs | More types (shields, wall repair kits, scrolls); a consumable belt / slot choice |
| Adventure drops | M | Hook only (`rollLoot`) | Wire into daytime adventures (Milestone **K**) with their own loot tables |
| Item sets and crafting | L | No | Set bonuses, salvage into materials, crafting at the blacksmith |
| Stash | S | No | Storage beyond the 40-slot bag |

---

## Milestone I — Talents

| Item | Effort | Baseline today | Remaining work |
|------|--------|----------------|----------------|
| Talent tree / points | L | No | Spend talent points (nights survived, quests, or level) on a tree of combat and town perks |

---

## Milestone J — Wall defenses (tower-defense maze)

The player builds and expands defences in the night area over time, shaping how enemies path — a maze they grow between nights, not a one-off placement.

| Item | Effort | Baseline today | Remaining work |
|------|--------|----------------|----------------|
| Buildable towers, traps, and barricades | L | No | Place and upgrade structures in the defense area (archers, spikes, ballistae, blockades) |
| Expandable maze that shapes pathing | XL | A* to the wall only | Barricades and new build plots change enemy paths; the defended ground grows over the campaign. Pathfinding, placement rules, and debug tools need first-class support |

---

## Milestone K — Daytime adventuring

Leave town during the day, then bring the proceeds back for the night's defense.

| Item | Effort | Baseline today | Remaining work |
|------|--------|----------------|----------------|
| Leave town and explore | XL | Town and defense only | A daytime map or route you can walk; encounters, risk, and a return to town |
| Daytime quests | L | No | Pick up and complete quests during the day |
| Money and loot for the night | M | Night gold only | Spend adventure gold and loot at shops, on town upgrades, gear, and wall defences |

---

## Milestone D — UX, audio, meta

| Item | Effort | Baseline today | Remaining work |
|------|--------|----------------|----------------|
| Title screen | M | No | Scene before Town |
| Settings menu | M | No | Volume, controls |
| Pause menu (player-facing) | M | No | Not only debug overlay |
| Tutorial | L | No | First night guidance |
| Audio / music | L | Partial | SFX for melee, fire and coins (`src/audio/`); no music, settings or volume yet |
| Walk-cycle animations | L | No | Static facing sprites only |

---

## Milestone E — Engineering

| Item | Effort | Baseline today | Remaining work |
|------|--------|----------------|----------------|
| `DefenseScene` decomposition | L | Done (see execution order steps 0–1) | Further splits are follow-up work; archived plan line counts are stale |
| `touchButton` / `EnemyRangedCombat` splits | — | Done ([#133](https://github.com/fred1878/DefenseGame/pull/133), [#134](https://github.com/fred1878/DefenseGame/pull/134)) | — |
| `defenseNightLogic` pure guard | S | Yes | Keep covered when moving `endNight` |
| Strict TypeScript + coverage floors | M | Yes | Vitest thresholds **95 / 95 / 95**, branches **90** (`vitest.config.ts`); `src/scenes/**` and `src/world/**` excluded from coverage — do not lower floors |
| `SAVE_VERSION` migration tests | S | Partial | v2 load guards exist; add fixture tests before the next schema bump |
| Deprecated API cleanup | S | Partial | `@deprecated` shims (`main.ts`, `DefenseWaveSpawner`, legacy save `autoCast`, spell spawn helpers) — remove once callers migrated |
| Vitest worker reuse | S | No | Enable `poolOptions.threads.isolate: false` when safe (~5s+ off local/CI unit runs per Vitest hint) |
| Balance tooling | S | **Yes** | `sim:economy` for tuning; keep wave/loot docs in sync with sim defaults |

---

## Milestone F — Mobile & stores

| Item | Effort | Baseline today | Remaining work |
|------|--------|----------------|----------------|
| **Installable PWA (web)** | M | **Yes** | Add to Home Screen / Install app from the Pages URL; offline after the first load |
| Capacitor device smoke | M | **Android APK** on Releases; in-town update check | iOS smoke; Play Store / App Store packaging (Milestone F XL) |
| Store APK/IPA | XL | No | Signing, CI per `CI_RELEASES.md` |

---

## Proposed additions (backlog)

Candidates not yet in a milestone table above. Pull into execution order when a step owner is free.

| Item | Effort | Rationale |
|------|--------|-----------|
| **Player melee crit** | S | `BruiserPlayerCritHitFx` exists; wire crit chance from gear and reuse FX |
| **Gear on player sprite** | M | Equipped items visible in Defense (at least weapon silhouette) |
| **Spell cooldown / error UX** | S | Clear feedback when cast fails (OOM, channel interrupted, no target) |
| **Lose-night UX** | S | Stronger copy and CTA when wall or player dies (campaign vs endless) |
| **PWA install prompt polish** | S | Gentle “install app” hint after first successful night on mobile browsers |
| **Expand Vitest into scenes** | L | Selective tests for `defenseNightLogic` adapters without full Phaser; avoid bloating excludes forever |
| **iOS Capacitor smoke** | M | Parity with Android stub; no store submit yet |
| **Dependabot + secret scanning** | S | Repo settings — keep `package-lock.json` patchable without manual audit |
| **Accessibility pass** | M | Touch targets audit, contrast on HUD text, reduced motion for screen shake |
| **Spell bar mobile drag** | S | Town spell sort panel edge cases at screen borders (called out in Milestone C) |
| **Night 20+ telemetry hooks** | S | Debug-only counters for how many saves sit past night 20 (informs ending design) |

---

## Related docs

- [README.md](./README.md)
- [docs/AGENTS.md](./docs/AGENTS.md)
- [docs/DATA_FIELDS.md](./docs/DATA_FIELDS.md)
- [docs/ECONOMY_SIM.md](./docs/ECONOMY_SIM.md)
- [docs/ITEMS.md](./docs/ITEMS.md)
- [docs/archive/REFACTOR_PLAN.md](./docs/archive/REFACTOR_PLAN.md)
- [docs/CI_RELEASES.md](./docs/CI_RELEASES.md)
- [docs/TESTING.md](./docs/TESTING.md)
- [docs/WAVES.md](./docs/WAVES.md)
