# `public/data/` field reference

Boot loads every file here in `DataStore.loadAll`. Missing boot-required fields throw `ConfigLoadError` with a JSON path.

## Documentation format (CI)

Each boot-required field must appear in that file's `## *.json` section as either:

- `autoAttackMeleeRange` — px; derived melee engage range at Boot (example bullet), or
- A table row `| \`fieldName\` | … |` where cells after the field name combine to ≥15 characters of **type, unit, and meaning** (no `TBD` / `TODO`).

**Bidirectional parity:** `src/core/data/dataFieldsDoc.test.ts` compares exported `*BOOT_KEYS` from `normalize*` (and `dataFieldsDocKeys.ts`) to parsed field names per section. CI fails on **missing** keys (new config not documented) and **extra** keys (renamed/removed config still in the doc). Update normalize key lists and this file in the **same PR**.

## Units

| Label | Meaning |
|-------|---------|
| **px** | Phaser world pixels at the 540×1200 design resolution (arcade physics, ranges, speeds). |
| **ms** | Milliseconds (windup, channel, cooldown, invulnerability). |
| **WU** | World units: authored distances that scale with debug **World scale** via `worldUnit()` (same numeric baseline as layout at default 2× sprite scale). |
| **deg** | Degrees (arc sweep). |
| **dimensionless** | Multipliers, ratios, counts, gold, levels (no physical unit). |

## Shipped files (`origin/main`)

| File | Loaded in Boot |
|------|----------------|
| `buildings.json` | yes |
| `defense-maps.json` | yes (`normalizeDefenseMaps`) |
| `enemies.json` | yes (`normalizeEnemyRow`, `resolveEnemyCombat`) |
| `enemy-ai.json` | yes (`normalizeEnemyAi`) |
| `entity-physics.json` | yes (`normalizeEntityPhysics`) |
| `hit-flash.json` | yes (`normalizeHitFlash`) |
| `items.json` | yes (`normalizeItems`) |
| `loot.json` | yes (`normalizeLoot`) |
| `consumables.json` | yes (`normalizeConsumables`) |
| `shops.json` | yes (`normalizeShops`) |
| `talents.json` | yes (`normalizeTalents`) |
| `player.json` | yes (`normalizePlayerConfig`) |
| `spell_input.json` | yes (`normalizeSpellInput`) |
| `spells.json` | yes (`normalizeSpellCatalog`) |
| `town_buildings.json` | yes (no schema validator) |
| `town_layout.json` | yes (`normalizeTownLayout`) |
| `waves.json` | yes (no schema validator) |
| `gameplay.json` | yes (`normalizeGameplay`) |

### TypeScript types

| File | Input (authorable) | Resolved / runtime | Module |
|------|---------------------|-------------------|--------|
| `buildings.json` | — | [BuildingDef](../src/core/data/DataStore.ts) | [DataStore.ts](../src/core/data/DataStore.ts) |
| `defense-maps.json` | [DefenseMapsFileInput](../src/core/data/normalizeDefenseMaps.ts), [DefenseMapInput](../src/core/data/normalizeDefenseMaps.ts) | [DefenseMapsRegistry](../src/core/data/normalizeDefenseMaps.ts), [DefenseMapDef](../src/core/data/normalizeDefenseMaps.ts) | [normalizeDefenseMaps.ts](../src/core/data/normalizeDefenseMaps.ts) |
| `enemies.json` | [EnemyDefInput](../src/core/data/normalizeEnemy.ts), [EnemyCombatPartial](../src/core/enemyTuning.ts) | [EnemyDef](../src/core/data/DataStore.ts), [ResolvedEnemyCombat](../src/core/enemyTuning.ts) | [normalizeEnemy.ts](../src/core/data/normalizeEnemy.ts), [enemyTuning.ts](../src/core/enemyTuning.ts) |
| `enemy-ai.json` | [EnemyAiInput](../src/core/data/normalizeEnemyAi.ts) | [EnemyAiTuning](../src/config/enemy.ts) | [normalizeEnemyAi.ts](../src/core/data/normalizeEnemyAi.ts), [enemy.ts](../src/config/enemy.ts) |
| `entity-physics.json` | [EntityPhysicsInput](../src/core/data/normalizeEntityPhysics.ts) | [EntityPhysicsTuning](../src/core/data/normalizeEntityPhysics.ts) | [normalizeEntityPhysics.ts](../src/core/data/normalizeEntityPhysics.ts) |
| `hit-flash.json` | [HitFlashInput](../src/core/data/normalizeHitFlash.ts) | [HitFlashConfig](../src/core/data/normalizeHitFlash.ts) | [normalizeHitFlash.ts](../src/core/data/normalizeHitFlash.ts), [hitFlash.ts](../src/config/hitFlash.ts) |
| `items.json` | — | [GearCatalog](../src/gear/gearTypes.ts) | [normalizeItems.ts](../src/core/data/normalizeItems.ts), [itemGen.ts](../src/gear/itemGen.ts), [itemStats.ts](../src/gear/itemStats.ts) |
| `consumables.json` | — | [ConsumablesConfig](../src/gear/consumables.ts) | [normalizeConsumables.ts](../src/core/data/normalizeConsumables.ts), [consumables.ts](../src/gear/consumables.ts) |
| `shops.json` | — | [ShopsConfig](../src/gear/shops.ts) | [normalizeShops.ts](../src/core/data/normalizeShops.ts), [shops.ts](../src/gear/shops.ts) |
| `loot.json` | — | [LootConfig](../src/gear/loot.ts) | [normalizeLoot.ts](../src/core/data/normalizeLoot.ts), [loot.ts](../src/gear/loot.ts) |
| `player.json` | [PlayerConfigInput](../src/core/data/normalizePlayer.ts) | [PlayerConfig](../src/core/data/normalizePlayer.ts), [PlayerTuning](../src/config/player.ts) | [normalizePlayer.ts](../src/core/data/normalizePlayer.ts), [player.ts](../src/config/player.ts) |
| `spell_input.json` | [SpellInputConfigInput](../src/core/data/normalizeSpellInput.ts) | [SpellInputTuning](../src/config/spellInput.ts) | [normalizeSpellInput.ts](../src/core/data/normalizeSpellInput.ts), [spellInput.ts](../src/config/spellInput.ts) |
| `spells.json` | [SpellsFileInput](../src/core/data/normalizeSpells.ts) | [SpellDefinition](../src/content/spells.ts) | [normalizeSpells.ts](../src/core/data/normalizeSpells.ts), [spells.ts](../src/content/spells.ts) |
| `town_buildings.json` | — | [TownBuildingDef](../src/core/data/townBuildingTypes.ts) | [townBuildingTypes.ts](../src/core/data/townBuildingTypes.ts) |
| `town_layout.json` | [TownLayoutInput](../src/core/data/normalizeTownLayout.ts) | [TownLayoutDef](../src/core/data/townBuildingTypes.ts) | [normalizeTownLayout.ts](../src/core/data/normalizeTownLayout.ts), [townBuildingTypes.ts](../src/core/data/townBuildingTypes.ts) |
| `waves.json` | — | [WaveDef](../src/core/data/DataStore.ts), [WaveGroup](../src/core/data/DataStore.ts) | [DataStore.ts](../src/core/data/DataStore.ts) |
| `gameplay.json` | — | [GameplayTuning](../src/core/data/normalizeGameplay.ts) | [normalizeGameplay.ts](../src/core/data/normalizeGameplay.ts), [gameplay.ts](../src/config/gameplay.ts) |

**Removed (do not re-add):** `enemy-combat-defaults.json`, `spell-mechanics.json` — combat is fully per row in `enemies.json`; Shadowform tuning lives on the `shadowform` spell row.

---

## enemies.json

**TypeScript:** [EnemyDefInput](../src/core/data/normalizeEnemy.ts), [EnemyDef](../src/core/data/DataStore.ts), [EnemyCombatPartial](../src/core/enemyTuning.ts), [ResolvedEnemyCombat](../src/core/enemyTuning.ts) — [normalizeEnemy.ts](../src/core/data/normalizeEnemy.ts), [enemyTuning.ts](../src/core/enemyTuning.ts).

Top-level object: **enemy id** → row. Ids are referenced from `waves.json` (`enemyId`) and endless mode.

### Row fields (all enemies)

| Field | Type / unit | Meaning |
|-------|-------------|---------|
| `hp` | number (px-scale HP) | `Enemy` max HP, damageable |
| `speedWu` | number (px/s) | Movement velocity magnitude |
| `damage` | number | Melee swipe damage (behaviors using `combat.melee`); baseline damage stat |
| `bodyRadiusWu` | number (px) | Arcade circle radius, contact distance, nav clearance |
| `weight` | number (dimensionless) | Knockback resistance (`100` = full authored knockback) |
| `challengeRating` | number (≥ 0) | Endless / wave UI threat tier (not combat math) |
| `behavior` | string | AI module in `src/ai/behaviors/`; one of `meleeChaser`, `bruiser`, `arrowRainArcher`, `javelineer`, `stationaryRanged`, `wallSiege`, `charger`, `lobber`, `rangedHybrid`, `ward` (unknown values fail at load) |
| `textureKey` | string | Boot texture key (`enemy_<id>` unless art reuse) |
| `displayName` | string optional | HUD nameplate; defaults from id if omitted |
| `combat` | object | Passed to `resolveEnemyCombat` (see below) |

### `combat` by behavior

Every row needs `combat.wall`. Other sections depend on `behavior`:

| Behavior id | Required `combat` sections |
|-------------|---------------------------|
| meleeChaser, bruiser, wallSiege, charger, ward, rangedHybrid | `wall`, `melee` (+ kit below) |
| arrowRainArcher | `wall`, `arrowRain` |
| javelineer | `wall`, `javelineer` |
| stationaryRanged | `wall`, `stationaryRanged` |
| lobber | `wall`, `lobber` |
| wallSiege (also) | `wallSiege` kit |
| charger (also) | `charger` kit |
| ward (also) | `ward` kit |
| rangedHybrid (also) | `stationaryRanged`, `hybrid` kits |

**Do not** add `combat.melee` on `arrowRainArcher`, `javelineer`, `stationaryRanged`, `lobber`.

#### `attackMovement` (`combat.melee`, `combat.arrowRain`, `combat.javelineer`, `combat.stationaryRanged`, `combat.lobber`)

Per-attack-kit walk-speed multipliers during that kit's combat phases. The block on the attack currently executing is used — for example a reaver uses `combat.melee.attackMovement` during a melee swing and `combat.stationaryRanged.attackMovement` during a volley. `0` holds the enemy still (knockback still applies). `1` is full walk speed. Values are required and must be `>= 0`.

Shipped rows keep current on-screen movement: bruiser melee is `0.5` in every phase, and every other kit is `0` in every phase (stand still while attacking). The older shared chase helper had an unreachable `0.35` scale on the `active` phase; set `activeMul` to `0.35` on a kit to opt into that slow-close during hit frames. Javelineer movement previously special-cased a `1` scale in the chase helper, but the combat tick still zeroed velocity mid-throw; set all three multipliers to `1` on `combat.javelineer.attackMovement` if you want them to keep orbiting while throwing.

Wall melee standoff holds still independently when the enemy is inside the wall trigger during a swing.

| Field | Unit | Meaning |
|-------|------|---------|
| `windupMul` | dimensionless | Walk-speed multiplier during windup. `0` holds still. |
| `activeMul` | dimensionless | Walk-speed multiplier during the active/hit frames. The previously unused shared-chase value was `0.35`. |
| `recoveryMul` | dimensionless | Walk-speed multiplier during recovery. `0` holds still. |

#### `combat.wall` (all behaviors)

North wall objective attacks (`EnemyCombat` wall FSM).

| Field | Unit | Meaning |
|-------|------|---------|
| `damage` | number | Damage for melee swipe or kit baseline; wall kit uses combat.wall.damage. |
| `triggerRangeWu` | px | Distance in px to begin attack windup toward target or wall. |
| `hitRangeWu` | px | Distance in px within which wall strikes connect. |

#### `combat.melee` (melee-activation behaviors)

Player-facing arc swipe (`meleeChaser`, `bruiser`, `wallSiege`, `charger`, `ward`, `rangedHybrid`).

| Field | Unit | Meaning |
|-------|------|---------|
| `triggerRangeWu` | px | Distance in px to begin attack windup toward target or wall. |
| `rangeWu` | px | Maximum melee swipe reach in px from attacker center. |
| `arcDeg` | deg | Melee swipe arc width in degrees. |
| `windupMs` | ms | Milliseconds in windup before active damage frames. |
| `activeMs` | ms | Milliseconds the attack hitbox can deal damage. |
| `recoveryMs` | ms | Milliseconds after active before the FSM returns to idle. |
| `cooldownMs` | ms | Milliseconds before the same attack can be queued again. |
| `fxStartMs` | ms | Required. Delay from **windup start** (idle→windup) until melee swipe VFX spawns. `0` = first windup frame. |
| `fxDurationMs` | ms | Optional. Target on-screen swipe length. **Omit** → sheet plays at natural speed (no timeScale). **Shorter** → `timeScale = natural / fxDurationMs` (speed up). **Longer** → timeScale &lt; 1 (slow/stretch). Ends on anim complete, not clipped early. |
| `vfxDisplayW` | px | Art px melee swipe PVFX width before world display scaling; should read against `rangeWu`. |
| `vfxDisplayH` | px | Art px melee swipe PVFX height before world display scaling. |
| `vfxOffsetWu` | WU | Spawn offset along attack facing from attacker center (positions swipe along thrust). |
| `meleeChaseStandoffWu` | WU | Extra WU gap when chase stops short of player body contact. |

#### `combat.arrowRain` (`arrowRainArcher`)

Telegraphed ground zone ticks.

| Field | Unit | Meaning |
|-------|------|---------|
| `damage` | number | Damage dealt by this attack mode. |
| `preferredRangeWu` | px | Ideal standoff distance in px from target. |
| `attackTriggerRangeWu` | px | Px range to begin attack windup. |
| `kiteBandSlackWu` | WU | WU slack around preferred range for kite band. |
| `windupMs` | ms | Ms before attack active frames begin. |
| `activeMs` | ms | Ms the attack hitbox can deal damage. |
| `recoveryMs` | ms | Ms after active before returning to idle. |
| `cooldownMs` | ms | Ms before this attack can be used again. |
| `zoneRadiusWu` | px | Px radius of telegraphed ground AoE. |
| `tickIntervalMs` | ms | Ms between AoE damage ticks. |
| `tickDamageScale` | dimensionless | Per-tick damage multiplier (dimensionless). |
| `maxTicks` | count | Maximum tick applications per zone. |

#### `combat.javelineer` (`javelineer`)

| Field | Unit | Meaning |
|-------|------|---------|
| `damage` | number | Damage dealt by this attack mode. |
| `minRangeWu` | px | Minimum px range to use ranged attack. |
| `maxRangeWu` | px | Maximum px range for ranged attack. |
| `kiteBandSlackWu` | WU | WU slack around preferred range for kite band. |
| `strafeSpeedMul` | dimensionless | Multiplier on strafe speed while kiting. |
| `orbitFlipMs` | ms | Ms between orbit direction changes. |
| `windupMs` | ms | Ms before attack active frames begin. |
| `activeMs` | ms | Ms the attack hitbox can deal damage. |
| `recoveryMs` | ms | Ms after active before returning to idle. |
| `cooldownMs` | ms | Ms before this attack can be used again. |
| `projectileSpeedWu` | px/s | Projectile speed in px/s. |
| `projectileMaxTravelWu` | px | Maximum projectile travel in px. |

#### `combat.stationaryRanged` (`stationaryRanged`, `rangedHybrid`)

| Field | Unit | Meaning |
|-------|------|---------|
| `damage` | number | Damage dealt by this attack mode. |
| `preferredRangeWu` | px | Ideal standoff distance in px from target. |
| `attackTriggerRangeWu` | px | Px range to begin attack windup. |
| `kiteBandSlackWu` | WU | WU slack around preferred range for kite band. |
| `windupMs` | ms | Ms before attack active frames begin. |
| `activeMs` | ms | Ms the attack hitbox can deal damage. |
| `recoveryMs` | ms | Ms after active before returning to idle. |
| `cooldownMs` | ms | Ms before this attack can be used again. |
| `projectileSpeedWu` | px/s | Projectile speed in px/s. |
| `projectileMaxTravelWu` | px | Maximum projectile travel in px. |

#### `combat.wallSiege` (`wallSiege`)

| Field | Unit | Meaning |
|-------|------|---------|
| `playerAggroRadiusWu` | px | Overrides global aggro while sieging |

#### `combat.charger` (`charger`)

| Field | Unit | Meaning |
|-------|------|---------|
| `chargeDamage` | number | Damage dealt when charger dash connects. |
| `dashMinRangeWu` | WU | Minimum WU spacing required to start dash. |
| `dashTriggerRangeWu` | px | Px distance to enter dash windup. |
| `dashWindupMs` | ms | Dash windup duration in ms. |
| `dashDurationMs` | ms | Dash movement duration in ms. |
| `dashSpeedMul` | dimensionless | Speed multiplier during dash burst. |
| `dashCooldownMs` | ms | Ms cooldown before next dash. |
| `dashOvershootRangeWu` | WU | WU overshoot past dash aim point. |

#### `combat.lobber` (`lobber`)

| Field | Unit | Meaning |
|-------|------|---------|
| `damage` | number | Damage dealt by this attack mode. |
| `preferredRangeWu` | px | Ideal standoff distance in px from target. |
| `attackTriggerRangeWu` | px | Px range to begin attack windup. |
| `kiteBandSlackWu` | WU | WU slack around preferred range for kite band. |
| `windupMs` | ms | Ms before attack active frames begin. |
| `activeMs` | ms | Ms the attack hitbox can deal damage. |
| `recoveryMs` | ms | Ms after active before returning to idle. |
| `cooldownMs` | ms | Ms before this attack can be used again. |
| `projectileSpeedWu` | px/s | Projectile speed in px/s. |
| `blastRadiusWu` | px | Px blast radius on lob impact. |
| `blastDamageScale` | dimensionless | Dimensionless lob blast damage scale. |
| `impactVfxBlastMul` | dimensionless | Smoke B impact sprite size as `blastRadiusWu × mul` in world pixels (matches blast read). |
| `attackCreepSpeedMul` | dimensionless | Mid-attack in-range creep toward the target. `0` stays still (shipped default). `0.35` is the previously unreachable creep speed. Not stacked with `attackMovement`. Lobbers do not retreat or chase mid-throw; if knocked out of attack range they hold still until the attack ends. |

#### `combat.ward` (`ward`)

| Field | Unit | Meaning |
|-------|------|---------|
| `protectRadiusWu` | px | Px radius allies are protected by ward. |
| `screenOffsetWu` | WU | WU offset for ward screening position. |
| `playerAggroRadiusWu` | px | Px radius to prefer chasing player over objective. |
| `postHoldRadiusWu` | WU | Within this distance of the screen goal the ward counts as "at post" and holds. |
| `postHoldExitRadiusWu` | WU | Hysteresis: keep holding until this far from the anchored goal. |
| `postBreakMoveWu` | WU | Player or protectee movement beyond this ends the hold grace window. |
| `postGraceMs` | ms | How long to stand still at post before allowing a full reposition. |
| `postFacingSlackDeg` | deg | Ignore aim changes smaller than this while holding (stops jitter). |

#### `combat.hybrid` (`rangedHybrid`)

| Field | Unit | Meaning |
|-------|------|---------|
| `closeMeleeRadiusWu` | px | Px threshold to enter hybrid melee phase. |
| `preferredRangeWu` | px | Ideal standoff distance in px from target. |
| `maxMeleeSwings` | count | Melee swings allowed before hybrid retreat. |
| `retreatRangeSlackWu` | px | Px slack when picking hybrid retreat point. |

**Shipped enemy ids:** `grunt`, `bruiser`, `arrow_rain_archer`, `skirmisher`, `sentry_archer`, `javelineer`, `slow_siege`, `fast_sapper`, `charger`, `lobber`, `reaver`, `ward`.

---

## enemy-ai.json

**TypeScript:** [EnemyAiInput](../src/core/data/normalizeEnemyAi.ts), [EnemyAiTuning](../src/config/enemy.ts) — [normalizeEnemyAi.ts](../src/core/data/normalizeEnemyAi.ts), [enemy.ts](../src/config/enemy.ts).

Global chase / wall path tuning plus per-behaviour movement (`applyEnemyAi` → `tuning("enemyAi")` in `src/tuning/gameTuning.ts`).

| Field | Unit | Meaning |
|-------|------|---------|
| `playerAggroRadiusWu` | px | Px radius to aggro on player instead of default goal. |
| `playerChaseMemoryMs` | ms | Ms to keep chasing last known player after LOS break. |
| `wallVelocityBlendMs` | ms | Ms blending velocity from chase back toward wall path. |
| `northWallMeleeStandoffWu` | px | Global px offset south of north wall for path goals. |

Nested sections below apply to every enemy of that behaviour (per-enemy attack numbers stay in `enemies.json` `combat`). Speed multipliers scale the enemy's `speedWu`; `*Wu` distances scale with `worldUnit()`.

### `pathing` (all enemies)

| Field | Unit | Meaning |
|-------|------|---------|
| `waypointRadiusWu` | WU | How close an enemy must get to a path node before advancing to the next. |
| `replanMs` | ms | Minimum ms between A* replans per enemy. |
| `stallMs` | ms | No progress toward the waypoint for this long forces an emergency replan. |
| `stallProgressWu` | WU | Movement below this distance counts as no progress for stall detection. |

### `retreat` (shared retreat steering)

| Field | Unit | Meaning |
|-------|------|---------|
| `probeDistPx` | px | Look-ahead distance used to test whether a flee or sidestep direction is blocked. |
| `defaultGoalWu` | WU | Flee goal distance when a behaviour does not pass its own. |
| `sidestepSpeedMul` | dimensionless | Speed multiplier applied when sidestepping a blocked retreat. |
| `blendReachWu` | WU | Reach of the strafe vector blended into a retreat path step. |
| `blendMinWeight` | dimensionless | Radial blend above which a javelineer backs off via retreat pathing instead of a direct strafe. |

### `javelineer`

| Field | Unit | Meaning |
|-------|------|---------|
| `strafeProbeDistPx` | px | Look-ahead used to test whether the orbit strafe direction is blocked. |
| `rangeApproachBlend` | dimensionless | Radial weight for closing in when outside the kite band. |
| `rangeRetreatBlend` | dimensionless | Radial weight for backing off when inside the band but too close. |
| `closeRetreatBlend` | dimensionless | Radial weight for retreating when inside `minRangeWu` (melee danger). |
| `idealRangeNudge` | dimensionless | Light radial weight used to settle on the ideal orbit distance. |
| `idealBandFrac` | dimensionless | Fraction of `kiteBandSlackWu` beyond which the ideal-range nudge applies. |
| `closeRetreatSpeedMul` | dimensionless | Speed multiplier when retreating from inside min range. |
| `closeRetreatExtraWu` | WU | Extra flee distance beyond min range when the player is too close. |
| `closeRetreatMinWu` | WU | Minimum flee goal distance when the player is too close. |
| `approachSpeedMul` | dimensionless | Path-follow speed multiplier when beyond max range. |
| `bandRetreatMinSpeedMul` | dimensionless | Floor on the strafe speed multiplier while backing off inside the band. |
| `bandRetreatMinWu` | WU | Minimum flee goal distance while backing off inside the band. |
| `wallRetreatSpeedMul` | dimensionless | Speed multiplier when backing off from the north wall. |
| `wallRetreatExtraWu` | WU | Extra distance beyond min range when backing off from the wall. |
| `wallRetreatMinWu` | WU | Minimum flee goal distance when backing off from the wall. |

### `stationaryRanged`, `arrowRainArcher`, `rangedHybrid`, `lobber`, `ward`

| Field | Unit | Meaning |
|-------|------|---------|
| `followSpeedMul` | dimensionless | Path-follow speed multiplier while approaching the kite band (stationaryRanged, arrowRainArcher, lobber). |
| `wallRetreatSpeedMul` | dimensionless | Speed multiplier when too close to the wall (stationaryRanged, arrowRainArcher; javelineer has its own). |
| `wallRetreatMinWu` | WU | Minimum flee goal distance from the wall (stationaryRanged, arrowRainArcher; javelineer has its own). |
| `playerRetreatSpeedMul` | dimensionless | Speed multiplier when the player is too close (stationaryRanged, arrowRainArcher). |
| `playerRetreatMinWu` | WU | Minimum flee goal distance from the player (stationaryRanged, arrowRainArcher). |
| `retreatSpeedMul` | dimensionless | Speed multiplier in retreat mode (rangedHybrid after melee swings; lobber when too close). |
| `retreatMinWu` | WU | Minimum flee goal distance in retreat mode (rangedHybrid, lobber). |
| `meleeChaseSpeedMul` | dimensionless | rangedHybrid chase speed multiplier in melee mode. |
| `closeChaseSpeedMul` | dimensionless | rangedHybrid chase speed multiplier when the player is inside melee trigger range in ranged mode. |
| `kiteRetreatSpeedMul` | dimensionless | rangedHybrid retreat speed multiplier while kiting in ranged mode. |
| `kiteRetreatMinWu` | WU | rangedHybrid minimum flee goal distance while kiting. |
| `kiteFollowSpeedMul` | dimensionless | rangedHybrid path-follow speed multiplier while kiting. |
| `chaseSpeedMul` | dimensionless | ward chase speed multiplier toward its post or the player. |

---

## entity-physics.json

**TypeScript:** [EntityPhysicsInput](../src/core/data/normalizeEntityPhysics.ts), [EntityPhysicsTuning](../src/core/data/normalizeEntityPhysics.ts) — [normalizeEntityPhysics.ts](../src/core/data/normalizeEntityPhysics.ts).

Nav inflation and knockback cap (`applyEntityPhysics`).

| Field | Unit | Meaning |
|-------|------|---------|
| `enemyPathClearanceMarginWu` | px | Extra px clearance around enemies on nav grid. |
| `staticObstacleNavClearanceWu` | px | Px inflation around obstacles for pathfinding. |
| `knockbackVelocityCapMult` | dimensionless | Caps knockback velocity to strength times this mult. |

---

## spell_input.json

**TypeScript:** [SpellInputConfigInput](../src/core/data/normalizeSpellInput.ts), [SpellInputTuning](../src/config/spellInput.ts) — [normalizeSpellInput.ts](../src/core/data/normalizeSpellInput.ts), [spellInput.ts](../src/config/spellInput.ts).

Virtual stick thresholds for spell cast interrupt vs movement detection, plus aiming defaults (`applySpellInputTuning` → `tuning("spellInput")`).

| Field | Unit | Meaning |
|-------|------|---------|
| `castInterruptStickAngleDeg` | deg | Bearing change from cast-start stick aim that cancels windup/channel; release/neutral stick does not interrupt. |
| `stickMovingMagnitudeEps` | dimensionless | Raw stick magnitude above which the player counts as moving (`isStickMoving`, auto-cast stationary skip). |
| `defaultGroundTargetMaxRangeWu` | WU | Ground-target max range for ground spells whose row has no `groundTargetMaxRangeWu`. |
| `groundAimFacingRangeFrac` | dimensionless | With no enemy to aim at, ground spells land this fraction of max range along facing. |
| `groundAimEnemyRadiusFrac` | dimensionless | Enemy pick radius for ground aim, as a fraction of the enemy sprite display width. |
| `instantTargetFallbackPx` | px | Instant-target spell VFX travel along facing when nothing is hit. |
| `enemyTapRadiusWu` | WU | Tap radius on enemy sprites for focus selection. |
| `groundTapAutoCastSpellIds` | string[] | Documented list of targeted ground AoE spell ids (`spellUsesManualGroundAim`; Boot replaces with catalog-derived ids). Short tap auto-targets; press-drag stays manual. |

---

## hit-flash.json

**TypeScript:** [HitFlashInput](../src/core/data/normalizeHitFlash.ts), [HitFlashConfig](../src/core/data/normalizeHitFlash.ts), [HitFlashFlavorEntry](../src/core/data/normalizeHitFlash.ts) — [normalizeHitFlash.ts](../src/core/data/normalizeHitFlash.ts), [hitFlash.ts](../src/config/hitFlash.ts).

Damage-flavor hit flash duration and per-flavor tint application (`normalizeHitFlash` → `applyHitFlashConfig` → `HitFlash.ts`).

| Field | Unit | Meaning |
|-------|------|---------|
| `durationMs` | ms | Linear tween length for hit-flash strength 1→0 on damaged sprites. |
| `flavors` | object | Required map keyed by `damageFlavor` (`fire`, `frost`, `physical`, `water`, `lightning`); one entry per flavor. |
| `tint` | dimensionless | ARGB tint integer (0–16777215) applied at flash peak via fill or multiply mode. |
| `mode` | string | `fill` uses `setTintFill` at full tint; `multiply` uses `setTint` (optionally lerped toward white). |
| `peakAlpha` | dimensionless | Sprite alpha ceiling at strength 1 when `alphaFade` is true (`peakAlpha * strength` each frame). |
| `colorFade` | boolean | When true on `multiply`, tween tint from flavor color toward white as strength drops; `fill` always uses full tint. |
| `alphaFade` | boolean | When true, scales sprite alpha with strength; when false alpha stays 1 for the whole flash. |

---

## items.json

**TypeScript:** [GearCatalog](../src/gear/gearTypes.ts) — [normalizeItems.ts](../src/core/data/normalizeItems.ts), [itemGen.ts](../src/gear/itemGen.ts), [itemStats.ts](../src/gear/itemStats.ts), [gearRuntime.ts](../src/gear/gearRuntime.ts).

Equipment: item bases, random affixes, rarities and authored uniques. Saves store only `baseId`, `rarity`, `itemLevel`, `uniqueId` and rolled affix values, so editing a base or unique here changes items players already own. Items whose base or unique is removed are dropped from saves on load.

Top level:

| Field | Meaning |
|-------|---------|
| `armour` | Object with the armour damage-reduction curve (`halfReductionAt`, `maxReductionPct`). |
| `halfReductionAt` | Armour value that gives 50% reduction; reduction = armour / (armour + halfReductionAt). |
| `maxReductionPct` | Hard cap on armour damage reduction, in percent (0–100). |
| `itemLevelPriceStepPct` | Price grows by this percent per item level above the base's `minItemLevel`. |
| `statCaps` | Object of per-stat caps applied after summing gear (any flat stat id or `spellCooldownPct`). |
| `generation` | Object of random item roll rules (below). |
| `rarities` | Object keyed by `common`, `magic`, `rare`, `epic`, `legendary` (all five required). |
| `bases` | Object keyed by base id: the item types players can own (weapons, armour, rings, trinkets). |
| `affixes` | Object keyed by affix id: random prefix / suffix pool rolled onto magic, rare and epic items. |
| `uniques` | Object keyed by unique id: authored legendary items with fixed stats and procs. |

`generation`:

| Field | Meaning |
|-------|---------|
| `maxAffixesPerPosition` | Most affixes of one position (prefix or suffix) a rolled item can get (integer). |
| `outdatedBaseLevels` | A base this many item levels below the roll level counts as outdated. |
| `outdatedBaseWeight` | Pick weight for outdated bases (others weigh 1), so old bases still drop but rarely. |

Each rarity:

| Field | Meaning |
|-------|---------|
| `label` | Display name of the rarity in item tooltips and lists. |
| `color` | `#rrggbb` text colour used for item names of this rarity. |
| `minAffixes` | Fewest random affixes an item of this rarity rolls (integer). |
| `maxAffixes` | Most random affixes an item of this rarity rolls (integer, ≥ minAffixes; max 2 prefixes + 2 suffixes). |
| `priceMul` | Price multiplier over the base price for generated items of this rarity. |
| `minItemLevel` | Lowest item level at which this rarity can roll (drops, trader). |
| `weight` | Default relative roll weight; shops and drops can override per source. |
| `uniquesOnly` | Optional boolean; when true the rarity rolls an authored unique instead of a base + affixes. |

Each base (`minItemLevel` and `price` are also used here):

| Field | Meaning |
|-------|---------|
| `name` | Display name of the base item (affix labels wrap around it). |
| `type` | Item type: meleeWeapon, rangedWeapon, helm, chest, hands, legs, boots, ring or trinket. |
| `price` | Gold price of a common copy at its `minItemLevel` (rarity and level scale it). |
| `modifiers` | Optional array of implicit stat modifiers (see Modifiers below). |
| `melee` | Required for meleeWeapon: attack profile that replaces player.json melee values. |
| `ranged` | Required for rangedWeapon: attack profile that replaces player.json ranged values. |

Weapon profiles (`melee` and `ranged`; attack speed divides the three timings):

| Field | Meaning |
|-------|---------|
| `style` | Free-text weapon family shown in tooltips (sword, axe, spear, hammer, bow…). |
| `damage` | Base hit damage before flat damage and damagePct bonuses. |
| `windupMs` | ms before the hit lands (melee swing or shot release). |
| `activeMs` | ms of the active hit window. |
| `recoveryMs` | ms after the hit before the next attack can start. |
| `rangeWu` | WU; melee strike reach, or ranged max travel distance. |
| `arcDeg` | deg; melee only — width of the swing arc. |
| `knockbackWu` | WU; knockback applied to enemies hit. |
| `projectileSpeedWu` | Ranged only — shot speed in px/s. |
| `projectile` | Ranged only — COMBAT_FX_TEXTURE key for the shot sprite (e.g. stoneThrow, fireBolt). |
| `projectileTint` | Ranged only, optional — `#rrggbb` tint for the shot sprite. |

Each affix (`label`, `weight` and `minItemLevel` are also used here):

| Field | Meaning |
|-------|---------|
| `position` | prefix or suffix; an item gets at most two of each, and its name uses the first of each. |
| `types` | Array of item types this affix can roll on. |
| `effect` | What the affix adds: `{ stat }`, `{ stat: elementDamagePct, element }`, `{ stat, spells }` or `{ proc, … }`. |
| `tiers` | Array of `{ minItemLevel, min, max }`; the highest unlocked tier rolls an integer in [min, max]. |
| `min` | Lowest rolled value of a tier (stat value, or the proc's power: dot dps, slowPct, stun ms). |
| `max` | Highest rolled value of a tier (inclusive). |
| `proc` | Effect kind for on-hit affixes: dot, slow or stun (the rolled value fills dps, slowPct or ms). |
| `spells` | For spellDamagePct / spellCooldownPct effects: spell ids, one picked at roll time. |

Each unique (`name`, `price`, `modifiers` are also used here):

| Field | Meaning |
|-------|---------|
| `baseId` | Base item this unique is built on (sets its type and weapon profile). |
| `itemLevel` | Item level of the unique; it can drop from this level up. |
| `procs` | Array of on-hit procs (see Modifiers below); empty array for none. |
| `note` | Short flavour line shown in the item detail. |

Modifiers and procs:

| Field | Meaning |
|-------|---------|
| `stat` | meleeDamage, rangedDamage, damagePct, attackSpeedPct, maxHp, armour, moveSpeedPct, spellPowerPct, lifestealPct, meleeArcPct (wider swing arc), rangedRangePct (longer ranged range), cooldownPct (every spell), elementDamagePct, spellDamagePct or spellCooldownPct. |
| `value` | Amount added; flat for damage, HP and armour, percent for every *Pct stat. |
| `element` | Damage flavor for elementDamagePct (fire, frost, lightning, water, physical); boosts spells of that flavor. |
| `spell` | Spell id for spellDamagePct (more damage) or spellCooldownPct (shorter cooldown). |
| `kind` | Proc kind on weapon hits: dot (damage over time), slow or stun. |
| `flavor` | Damage flavor of a dot proc (sets its damage-number colour). |
| `chancePct` | Percent chance per weapon hit that the proc triggers. |
| `dps` | Damage per second of a dot proc. |
| `ms` | Duration of the proc effect in ms. |
| `slowPct` | Percent movement slow of a slow proc. |

---

## loot.json

**TypeScript:** [LootConfig](../src/gear/loot.ts) — [normalizeLoot.ts](../src/core/data/normalizeLoot.ts), [loot.ts](../src/gear/loot.ts).

Bag size, sell-back rate and gear drop tables. `nightWon` / `nightLost` roll at the end of a campaign night with the night number as the level; add more tables (e.g. per adventure area) and roll them with `rollLoot`.

| Field | Meaning |
|-------|---------|
| `inventoryCapacity` | Max unequipped items in the bag; drops beyond it are sold automatically. |
| `sellBackPct` | Percent of an item's price paid when selling it (30 = 30% of the price; shipped 30). Shown on the shop and inventory Sell buttons. |
| `lostNightGoldPct` | Percent of a night's `rewardGold` paid when a campaign night is lost (default 25). |
| `tables` | Object keyed by table id (`nightWon`, `nightLost`; more can be added for adventures). |

Each table:

| Field | Meaning |
|-------|---------|
| `minRolls` | Fewest items rolled per drop (integer, can be 0). |
| `maxRolls` | Most items rolled per drop (integer, ≥ minRolls). |
| `rollWeights` | Optional array with one weight per item count from minRolls to maxRolls (e.g. `[80, 20]` with 1–2 rolls = one item 80%, two 20%); missing = every count equally likely. |
| `minItemLevelOffset` | Lowest offset added to the level (night) for each item's item level. |
| `maxItemLevelOffset` | Highest offset added to the level for each item's item level. |
| `rarityByLevel` | Array of `{ fromLevel, weights }` bands; the highest band at or below the item level applies. |
| `fromLevel` | Item level at which a band starts. |
| `weights` | Object of rarity id → relative weight; rarities left out never roll (rarity `minItemLevel` still applies). |

---

## consumables.json

**TypeScript:** [ConsumablesConfig](../src/gear/consumables.ts) — [normalizeConsumables.ts](../src/core/data/normalizeConsumables.ts), [consumables.ts](../src/gear/consumables.ts).

Potions and bombs usable in combat from the Potion / Bomb HUD buttons (keys Q / E). Each button uses the first owned item of its kind in file order. Saves store charges by id.

| Field | Meaning |
|-------|---------|
| `items` | Object keyed by consumable id. |
| `name` | Display name in shops, the bag summary and HUD toasts. |
| `kind` | heal (drink: restores HP) or bomb (thrown at the nearest target in range). |
| `price` | Base gold price before the shop's priceMulPct. |
| `maxStack` | Most charges of this id the player can carry. |
| `cooldownMs` | Shared cooldown of the HUD button after use, in ms. |
| `healHp` | Required for heal: HP restored per use. |
| `bomb` | Required for bomb: blast settings below. |

Each bomb:

| Field | Meaning |
|-------|---------|
| `damage` | Damage dealt to every enemy in the blast radius. |
| `radiusWu` | WU; blast radius. |
| `rangeWu` | WU; max throw distance to the target enemy. |
| `flavor` | Damage flavor (fire, frost, lightning, water, physical) for damage numbers. |
| `knockbackWu` | WU; knockback away from the blast centre. |
| `throwMs` | ms; flight time of the thrown bomb before it lands and blasts. |
| `projectile` | COMBAT_FX_TEXTURE name for the thrown sprite (e.g. spellArcBomb). |
| `blast` | COMBAT_FX_TEXTURE name for the blast flash (e.g. spellFireNova). |
| `dotDps` | Optional burn / DoT damage per second applied to enemies hit. |
| `dotMs` | Optional DoT duration in ms. |
| `slowPct` | Optional movement slow percent applied to enemies hit. |
| `slowMs` | Optional slow duration in ms. |
| `stunMs` | Optional stun duration in ms. |

---

## shops.json

**TypeScript:** [ShopsConfig](../src/gear/shops.ts) — [normalizeShops.ts](../src/core/data/normalizeShops.ts), [shops.ts](../src/gear/shops.ts).

Town shops. The trader (night Market Stall) rolls new random stock and new buy requests after every campaign night; the blacksmith (Moon Brazier) sells a fixed catalogue of plain bases that unlocks with nights. Items sell back for `loot.json` sellBackPct of their item price.

Both shops can be upgraded in their shop panel. Level costs and the max level live in `buildings.json` (`trader`, `blacksmith`, effect `shopLevel`); what each level does lives here in `levels`. Level N applies the rows `levels[0..N-1]` in order on top of the base fields, so a row only lists what changes. The bought level is saved in the save's `buildings` map.

| Field | Meaning |
|-------|---------|
| `trader` | Random daily stock settings (below). |
| `blacksmith` | Fixed catalogue settings (below). |
| `title` | Shop name shown in the shop panel title. |
| `priceMulPct` | Percent of the item / consumable price charged by this shop (125 = 25% markup). |

Trader:

| Field | Meaning |
|-------|---------|
| `itemCount` | Random items rolled per day. |
| `minItemLevelOffset` | Lowest offset added to the current night for each item's item level. |
| `maxItemLevelOffset` | Highest offset added to the current night for each item's item level. |
| `rarityWeights` | Rarity id → relative weight for trader items (rarity `minItemLevel` still applies; missing rarities never roll). |
| `rerollCost` | Gold to reroll the day's trader stock from the shop panel; 0 hides the Reroll button. A paid reroll does not change the buy requests. |
| `requestCount` | Buy requests the trader posts each night (Wants tab); 0 = none. |
| `requests` | Buy-request settings: `payoutPct`, `kindWeights`, `minRarityWeights` (below). Requests are rolled from every item in items.json, so the player may never own a match. |
| `payoutPct` | Gold paid for a matching bag item as a percent of its value (its item price before shop markup); 150 = 1.5× value. Default 150. |
| `kindWeights` | Relative odds of each request kind: `base` (one specific base item, any rarity), `type` (any item of a slot type at or above a minimum rarity, e.g. "Rare+ Ring") and `unique` (one specific unique). Kinds left out never roll. |
| `minRarityWeights` | Rarity id → relative weight for the minimum rarity of `type` requests (missing rarities never roll). |
| `levels` | Upgrade rows (level 1, 2, …). Each row may override `itemCount`, `minItemLevelOffset`, `maxItemLevelOffset`, `priceMulPct`, `rarityWeights`, `rerollCost` and `requestCount` (trader) or `priceMulPct`, `stockCount`, `stockItemLevelOffset`, `stockRarityWeights` and `unlockNightsEarly` (blacksmith). |
| `consumables` | Array of `{ id, qty, chancePct }` consumable offers rolled per day. |
| `id` | consumables.json id offered. |
| `qty` | Charges in stock that day. |
| `chancePct` | Percent chance the offer appears that day. |

Blacksmith (`consumables` rows here are `{ id, unlockNight }` and always in stock):

| Field | Meaning |
|-------|---------|
| `items` | Array of `{ baseId, unlockNight }`: plain common copies of items.json bases, unlimited stock. |
| `baseId` | items.json base sold. |
| `unlockNight` | Campaign night from which the row is for sale. |
| `stockCount` | Masterwork items rolled per day (qty 1 each, listed first); 0 at the base level. |
| `stockItemLevelOffset` | Offset added to the current night for masterwork item levels. |
| `stockRarityWeights` | Rarity id → relative weight for masterwork items (rarity `minItemLevel` still applies; missing rarities never roll). |
| `unlockNightsEarly` | Catalogue rows (`items`, `consumables`) unlock this many nights before their `unlockNight`. |

---

## talents.json

**TypeScript:** [TalentCatalog](../src/talents/talentTypes.ts) — [normalizeTalents.ts](../src/core/data/normalizeTalents.ts), [talentLogic.ts](../src/talents/talentLogic.ts), [talentRuntime.ts](../src/talents/talentRuntime.ts). Design notes: [TALENTS.md](./TALENTS.md).

Talent tree: branches of tiers of nodes. Each learned rank adds the node's `perRank` stat modifiers and procs (same format as items.json Modifiers) into the gear stat sum, so combat, the Gear panel totals and the economy sim all see them. Saves store only `{ ranks: { id: rank }, earned }`; ranks that no longer fit the tree after an edit are refunded on load.

**Placeholders awaiting confirmation:** `pointsPerNightWon`, `pointsPerNightLost`, `startingPoints`, `resetCostGold` and `tierThresholds` were picked for balance, not signed off (see TALENTS.md).

Top level:

| Field | Meaning |
|-------|---------|
| `config` | Object with talent point income, reset cost and tier thresholds (below). |
| `branches` | Array of branch objects shown as columns, left to right. |

`config`:

| Field | Meaning |
|-------|---------|
| `pointsPerNightWon` | Talent points earned for each campaign night won (integer ≥ 0). |
| `pointsPerNightLost` | Talent points earned for each campaign night lost (integer ≥ 0). |
| `startingPoints` | Talent points a new save starts with (old saves get this plus nights won × pointsPerNightWon). |
| `resetCostGold` | Gold charged to refund every spent point (Reset button). |
| `tierThresholds` | Array, one per tier: points spent in the same branch needed to open that tier (tier I first). |

Each branch (`id`, `name`, `icon` are also used by nodes):

| Field | Meaning |
|-------|---------|
| `id` | Unique string id (branch id or talent id stored in saves). |
| `name` | Display name of the branch column or talent node. |
| `icon` | Line icon name: sword, hammer, wind, droplet, shield, star, bow, target, snowflake, arrowUp, sparkles, flame, zap, refresh. |
| `tiers` | Array of tier objects, tier I first (at most one per tierThresholds entry). |

Each tier:

| Field | Meaning |
|-------|---------|
| `exclusive` | Optional boolean; true makes the tier pick-one (learning a node locks the others). |
| `nodes` | Array of talent nodes drawn side by side in the tier row. |

Each node:

| Field | Meaning |
|-------|---------|
| `maxRank` | Highest rank (integer ≥ 1); each rank costs one point. |
| `requires` | Optional array of talent ids; any one at rank ≥ 1 unlocks this node (draws the connectors). |
| `description` | Short sentence shown in the detail panel. |
| `perRank` | Object with what one rank adds; values multiply by the rank (proc chance multiplies too). |
| `modifiers` | Optional array of stat modifiers inside perRank (items.json Modifiers format). |
| `procs` | Optional array of on-hit procs inside perRank (items.json Modifiers format). |

---

## player.json

**TypeScript:** [PlayerConfigInput](../src/core/data/normalizePlayer.ts), [PlayerConfig](../src/core/data/normalizePlayer.ts), [PlayerTuning](../src/config/player.ts) — [normalizePlayer.ts](../src/core/data/normalizePlayer.ts), [player.ts](../src/config/player.ts).

Player combat tuning (`normalizePlayerConfig` → `applyPlayerTuning`).

| Field | Unit | Meaning |
|-------|------|---------|
| `moveSpeedWu` | px/s | Player locomotion speed in px/s during Defense. |
| `maxHp` | number | Player maximum hit points at night start. |
| `bodyRadiusWu` | px | Arcade physics circle radius in world px. |
| `gearMinAttackSpeedMul` | dimensionless | Floor on the attack-speed multiplier from gear (`1 + attackSpeedPct/100`). |
| `gearMinMoveSpeedMul` | dimensionless | Floor on the move-speed multiplier from gear (`1 + moveSpeedPct/100`). |
| `meleeWindupMs` | ms | Boot-required `meleeWindupMs`; see normalize* and combat code for usage. |
| `meleeActiveMs` | ms | Boot-required `meleeActiveMs`; see normalize* and combat code for usage. |
| `meleeFxStartMs` | ms | Required. Delay from player melee **windup start** until swipe VFX. `0` = first windup frame. |
| `meleeFxDurationMs` | ms | Optional. Target player slash fade length. **Omit** → default fade at `meleeActiveMs`. When set, fade timeline matches target (faster/slower vs default). |
| `meleeRecoveryMs` | ms | Boot-required `meleeRecoveryMs`; see normalize* and combat code for usage. |
| `meleeStrikeRangeWu` | px | Px reach of player melee swipe centerline. |
| `meleeEngageTargetRadiusWu` | px | Px enemy proximity required to allow melee engage. |
| `meleeActivationSlackWu` | WU | WU subtracted when deriving autoAttackMeleeRange. |
| `meleeArcDeg` | deg | Player melee arc width in degrees. |
| `meleeDamage` | number | Player melee hit damage per connect. |
| `meleeKnockbackWu` | knockback strength | Knockback impulse strength for player melee. |
| `rangedWindupMs` | ms | Boot-required `rangedWindupMs`; see normalize* and combat code for usage. |
| `rangedActiveMs` | ms | Boot-required `rangedActiveMs`; see normalize* and combat code for usage. |
| `rangedRecoveryMs` | ms | Boot-required `rangedRecoveryMs`; see normalize* and combat code for usage. |
| `rangedDamage` | number | Player bow shot damage. |
| `rangedMaxRangeWu` | px | Maximum player ranged shot distance in px. |
| `rangedKnockbackWu` | knockback strength | Knockback impulse for player ranged hits. |
| `projectileSpeedWu` | px/s | Projectile travel speed in px/s. |
| `autoAttackRangedRange` | px | Px range for automatic ranged target acquisition. |
| `targetTapRadiusWu` | px | Px pick radius for manual enemy tap targeting. |
| `playerHitInvulnMs` | ms | Ms of invulnerability after player takes damage. |
| `nightSpawnInvulnMs` | ms | Ms invulnerability immediately after Defense spawn. |
| `endlessPanelDefaultConcurrent` | count | Initial concurrent enemy cap in endless UI. |

- `autoAttackMeleeRange` — px; derived at boot from meleeStrikeRange, meleeEngageTargetRadius, and meleeActivationSlackWu (not stored in JSON).

**Derived at boot (not in JSON):** `autoAttackMeleeRange` = `meleeStrikeRangeWu` + `meleeEngageTargetRadiusWu` − `meleeActivationSlackWu`.

---

## spells.json

**TypeScript:** [SpellsFileInput](../src/core/data/normalizeSpells.ts), [SpellDefinition](../src/content/spells.ts) — [normalizeSpells.ts](../src/core/data/normalizeSpells.ts), [spells.ts](../src/content/spells.ts).

Root object requires a `spells` array (non-empty): `{ "spells": [ ... ] }`.


### Boot-validated spell fields (`normalizeSpellCatalog`)

| Field | Meaning |
|-------|---------|
| `spells` | Root array of spell rows; must be non-empty at Boot. |
| `id` | Unique string spell id used in save spell bar and casting. |
| `mechanicType` | Selects cast pipeline and which numeric fields are required. |
| `swingRangeWu` | WU melee swing reach for swing and tracking_swing types. |
| `swingArcDeg` | Swing arc width in degrees. |
| `swingFxSizePx` | Display size in px (width and height) of the swing slash sprite for swing and tracking_swing types. |
| `baseDamage` | Damage per hit (or total channel budget for channeled) before spell damage mult; required for every damaging mechanic (projectile, projectile_aoe, tracking_projectile, swing, tracking_swing, cone, channeled_cone, blast, channeled, instant_targeted). |
| `healAmount` | HP restored by heal mechanic rows (channeled heals spread it over the channel). |
| `burstBlastDamageScale` | Splash damage multiplier on instant_targeted rows that have blastRadiusWu: splash = burstDamage (or baseDamage when no burst) × this. |
| `coneRangeWu` | WU cone length for cone and channeled_cone types. |
| `coneArcDeg` | Cone arc width in degrees. |
| `blinkDistanceWu` | Attempted blink travel distance in WU. |
| `blinkResolveBinarySearchIterations` | Binary search steps for partial blink path resolution. |
| `blinkPartialMoveEpsilonWu` | Minimum WU travel to treat blink as having moved. |
| `blinkEdgeInsetWu` | WU the blink landing point is kept inside the field edges. |
| `iceWallDistanceWu` | WU offset where ice wall is placed ahead of caster. |
| `iceWallDurationMs` | Duration in ms before ice wall despawns. |
| `iceWallBlockGapWu` | WU spacing between the three ice wall blocks. |
| `iceWallBlockSizeWu` | WU display and collider size of each ice wall block. |
| `shadowformDurationMs` | Buff duration in ms for shadowform mechanic type. |
| `shadowformMoveSpeedMult` | Player speed multiplier while shadowform buff is active. |
| `shadowformDamageTakenMult` | Incoming damage multiplier in [0,1] while buffed. |
| `shadowformAggroRadiusMult` | Enemy aggro radius multiplier in [0,1] while buffed. |
| `knockback` | Direct hit knockback impulse where required by mechanic. |
| `blastKnockback` | Radial knockback on blast or AoE detonation. |
| `chainKnockback` | First target knockback on chain_lightning. |
| `chainHopKnockback` | Knockback applied on each chain lightning hop. |
| `chainLightningHops` | Maximum extra targets after the first chain hit. |
| `chainLightningHopRangeWu` | WU maximum distance between chain hops. |

### Runtime spell row fields (not in boot parity CI)

Runtime/UI fields (name, castMs, icons, assets, onHit effects, etc.) are authored per row but not listed in the boot parity set—see `SpellDefinition` in `src/content/spells.ts`.

For **channeled** and **channeled_area** ground zones, `baseDamage` is the **total damage budget over the channel** (before spell damage mult); tick damage splits that budget evenly across channel ticks (`channelMs` / `channelTickMs`, minimum one tick), with any remainder on the final tick. `burstDamage` remains a separate one-shot. Post-channel **linger** DoT uses `onHit.dotDps`, not `baseDamage`. **channeled_cone** strikes `channelMs / channelTickMs` times (minimum one).

#### `damageFlavor` (optional string)

Hit-flash tint and DoT damage flavor when the spell deals damage. Allowed values: `fire`, `frost`, `physical`, `water`, `lightning`. There is no `default` flavor in gameplay — every damage path must pass an explicit flavor. Omit on pure heals; non-damaging buffs/movement (`shadowform`, `blink`) may set `physical` for metadata only.

Allowed enum tokens (spell hit flash): fire (bolts, novas, bombs, combustion), frost (ice, cold cone, blizzard, roots), physical (melee, enemy projectiles, rend), lightning (lightning bolt, chain lightning), water (water bolt).

Hit-flash timing and per-flavor `colorFade` / `alphaFade` live in [hit-flash.json](hit-flash.json) (`applyHitFlashConfig`); `damageFlavor` selects the matching `flavors` entry.

### Mechanic-specific boot validation (reference only)

| mechanicType | Extra required numeric fields |
|----------------|------------------------------|
| swing, tracking_swing | baseDamage, swingRangeWu, swingArcDeg, swingFxSizePx, knockback |
| cone, channeled_cone | baseDamage, coneRangeWu, coneArcDeg, knockback |
| blink | blinkDistanceWu, blinkResolveBinarySearchIterations, blinkPartialMoveEpsilonWu, blinkEdgeInsetWu |
| ice_wall | iceWallDistanceWu, iceWallDurationMs, iceWallBlockGapWu, iceWallBlockSizeWu |
| buff | shadowformDurationMs; shadowform row also needs shadowform*Mult fields |
| projectile | baseDamage, knockback |
| projectile_aoe | baseDamage, knockback, blastKnockback |
| tracking_projectile | baseDamage, knockback; chain_lightning row also needs chain* fields |
| blast | baseDamage, blastKnockback |
| instant_targeted | baseDamage, knockback; blastKnockback when blastRadius or burstDamage; burstBlastDamageScale when blastRadiusWu |
| heal | healAmount (no knockback fields) |
| channeled | baseDamage (no knockback fields) |
| channeled_area | no knockback fields |

Shadowform multipliers are also applied globally via `shadowformMechanicsFromCatalog` (formerly `spell-mechanics.json`).

---

## defense-maps.json

**TypeScript:** [DefenseMapsFileInput](../src/core/data/normalizeDefenseMaps.ts), [DefenseMapInput](../src/core/data/normalizeDefenseMaps.ts), [DefenseMapsRegistry](../src/core/data/normalizeDefenseMaps.ts), [DefenseMapDef](../src/core/data/normalizeDefenseMaps.ts) — [normalizeDefenseMaps.ts](../src/core/data/normalizeDefenseMaps.ts).

| Field | Meaning |
|-------|---------|
| `defaultMapId` | Map id used when none is selected for Defense. |
| `maps` | Array of defense map definitions for night field layout. |

Each map:

| Field | Meaning |
|-------|---------|
| `id` | String identifier for a map or spell content row. |
| `field` | Nested object describing playable tile grid size. |
| `cols` | Tile column count for defense field (>= 1). |
| `rows` | Tile row count for defense field (>= 1). |
| `obstacles` | Array of static obstacle placements on the field. |

Each obstacle:

| Field | Meaning |
|-------|---------|
| `tileX` | Obstacle tile column index on defense grid. |
| `tileY` | Obstacle tile row index on defense grid. |
| `textureKey` | Obstacle texture key validated against OBSTACLE_TEXTURE in assets. |

---

## waves.json

**TypeScript:** [WaveDef](../src/core/data/DataStore.ts), [WaveGroup](../src/core/data/DataStore.ts) — [DataStore.ts](../src/core/data/DataStore.ts).

Top-level keys: **night number** (string) → wave def.

| Field | Meaning |
|-------|---------|
| `rewardGold` | Gold granted to save when the wave night is cleared. |
| `groups` | Spawn groups scheduled relative to night start time. |

Each group:

| Field | Meaning |
|-------|---------|
| `atMs` | Ms from defense night start when this spawn group begins. |
| `enemyId` | Key referencing a row in enemies.json. |
| `count` | Number of enemies to spawn in this group. |
| `intervalMs` | Ms between consecutive spawns within the group. |
| `hpMul` | Optional HP multiplier for every enemy in the group (default 1). At 2× or more the enemies spawn as "Elite" (nameplate prefix). Used for late-night elites. |
| `damageMul` | Optional damage multiplier for every enemy in the group (default 1): scales the enemy's hit (`damage`), wall hit and ranged / charge damage (`combat` keys named `damage` or ending in `Damage`). Used for late-night tough groups and elites. |

`DataStore.getWaveForNight` uses the exact night key, else the highest defined night ≤ requested, else night `1`. The campaign has nights 1–20; after night 20 the night-20 wave repeats (there is no end screen yet).

---

## gameplay.json

**TypeScript:** [GameplayTuning](../src/core/data/normalizeGameplay.ts) — [normalizeGameplay.ts](../src/core/data/normalizeGameplay.ts), [gameplay.ts](../src/config/gameplay.ts).

Global rules with no per-row home, loaded with the town data at Boot (`applyGameplay` → `tuning("gameplay")`) and by the economy sim from the bundled copy. Every field is a required number; sections are objects.

### `wall`

| Field | Unit | Meaning |
|-------|------|---------|
| `baseHp` | dimensionless | Town wall max HP on a new save and at wall level 0. |
| `hpPerLevel` | dimensionless | Extra wall max HP per `wall` building level. |
| `campaignWinWear` | dimensionless | Wall HP lost at the end of a won campaign night. |

### `nightEnd`

| Field | Unit | Meaning |
|-------|------|---------|
| `winHealHp` | dimensionless | Player HP restored (up to max) after a won night. |

### `waves`

| Field | Unit | Meaning |
|-------|------|---------|
| `eliteHpMul` | dimensionless | Wave group `hpMul` at or above which enemies get the "Elite" name prefix. |

### `spawn`

| Field | Unit | Meaning |
|-------|------|---------|
| `marginXWu` | WU | Horizontal inset from the field edges for random wave spawn points. |
| `southInsetWu` | WU | Distance north of the south field edge where waves spawn. |
| `jitterYWu` | WU | Random vertical spread (±) around the spawn line. |

### `combat`

| Field | Unit | Meaning |
|-------|------|---------|
| `dotTickMs` | ms | Interval between damage-over-time ticks on enemies (`onHit.dotDps` is per second). |
| `minSlowSpeedMul` | dimensionless | Floor on an enemy's speed multiplier while slowed, however large `slowPct` is. |
| `enemyKnockbackDecayMs` | ms | Exponential decay constant for an enemy's knockback slide. |
| `knockbackWeightBaseline` | dimensionless | Enemy `weight` at which knockback is unscaled; impulse is `strength × baseline / weight`. |
| `enemyProjectileKnockbackMul` | dimensionless | Enemy projectile knockback on the player as a fraction of `player.json` `rangedKnockbackWu`. |
| `enemyProjectileHitSlackPx` | px | Extra radius added to the player hurtbox for enemy projectile hits. |
| `playerProjectileHitSlackPx` | px | Extra radius added to enemy hurtboxes for player projectile hits. |
| `lobOvershootPx` | px | Extra travel past the aim point for lobbed enemy projectiles. |
| `lobMinTravelPx` | px | Minimum travel distance for lobbed enemy projectiles. |

---

## buildings.json

**TypeScript:** [BuildingDef](../src/core/data/DataStore.ts) — [DataStore.ts](../src/core/data/DataStore.ts).

Town upgrade defs keyed by building id: `wall` (wall HP) and the shop levels `trader` / `blacksmith` (bought in the shop panel; per-level effects are `levels` in `shops.json`).

| Field | Meaning |
|-------|---------|
| `maxLevel` | Maximum purchasable upgrade level for this town building. |
| `costByLevel` | Gold cost per upgrade level index in town. |
| `effect` | Effect id applied on upgrade: wallHpMax via GameState (see `GameState` / town menu), or shopLevel for trader / blacksmith upgrades (`upgradeShop` in townBuildingMenu.ts). |

---

## town_buildings.json

**TypeScript:** [TownBuildingDef](../src/core/data/townBuildingTypes.ts) — [townBuildingTypes.ts](../src/core/data/townBuildingTypes.ts).

Town clickable building art + actions (`TownBuildingDef`).

| Field | Meaning |
|-------|---------|
| `label` | Display name shown in town building menus. |
| `textureKey` | Texture key for this town building sprite loaded at Boot. |
| `width` | Building hitbox / sprite width in town scene px. |
| `height` | Building hitbox / sprite height in town scene px. |
| `upgradeId` | Optional buildings.json id used when this building opens upgrades. |
| `startsNight` | When true, tapping this building starts a Defense night. |
| `opensSpellBar` | When true, opens the town spell bar sort panel. |
| `opensEndlessMode` | When true, opens the endless enemy training panel. |
| `opensWavePlanner` | When true, opens the custom wave planner panel. |
| `opensSaveMenu` | When true, opens the manual save-slot menu. |
| `opensShop` | Opens a shop from `shops.json`: trader (random daily stock) or blacksmith (fixed catalogue). |

---

## town_layout.json

**TypeScript:** [TownLayoutInput](../src/core/data/normalizeTownLayout.ts) → [TownLayoutDef](../src/core/data/townBuildingTypes.ts) — [normalizeTownLayout.ts](../src/core/data/normalizeTownLayout.ts), [townBuildingTypes.ts](../src/core/data/townBuildingTypes.ts).

| Field | Meaning |
|-------|---------|
| `buildingDisplayScale` | On-screen size multiplier for town building sprites (>= 1); PNG width/height in town_buildings.json stay logical footprint size. |
| `slots` | Array of town building placements on the town map. |

Each slot:

| Field | Meaning |
|-------|---------|
| `buildingId` | Key referencing town_buildings.json for this slot. |
| `x` | Horizontal position in town scene px. |
| `y` | Vertical position in town scene px. |
