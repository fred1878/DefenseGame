# `public/data/` field reference

Boot loads every file here in `DataStore.loadAll`. Missing boot-required fields throw `ConfigLoadError` with a JSON path.

**When adding or removing a boot-required field, update this file and the exported `*BOOT_KEYS` lists in `src/core/normalize*.ts`; CI (`dataFieldsDoc.test.ts`) enforces parity.**

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
| `player.json` | yes (`normalizePlayerConfig`) |
| `spells.json` | yes (`normalizeSpellCatalog`) |
| `town_buildings.json` | yes (no schema validator) |
| `town_layout.json` | yes (no schema validator) |
| `waves.json` | yes (no schema validator) |

**Removed (do not re-add):** `enemy-combat-defaults.json`, `spell-mechanics.json` — combat is fully per row in `enemies.json`; Shadowform tuning lives on the `shadowform` spell row.

---

## enemies.json

Top-level object: **enemy id** → row. Ids are referenced from `waves.json` (`enemyId`) and endless mode.

### Row fields (all enemies)

| Field | Type | Required | Used by |
|-------|------|----------|---------|
| `hp` | number (px-scale HP) | **yes** | `Enemy` max HP, damageable |
| `speed` | number (px/s) | **yes** | Movement velocity magnitude |
| `damage` | number | **yes** | Melee swipe damage (behaviors using `combat.melee`); baseline damage stat |
| `bodyRadius` | number (px) | **yes** | Arcade circle radius, contact distance, nav clearance |
| `weight` | number (dimensionless) | **yes** | Knockback resistance (`100` = full authored knockback) |
| `challengeRating` | number (≥ 0) | **yes** | Endless / wave UI threat tier (not combat math) |
| `behavior` | string | **yes** | AI module in `src/ai/behaviors/` |
| `textureKey` | string | **yes** | Boot texture key (`enemy_<id>` unless art reuse) |
| `displayName` | string | optional | HUD nameplate; defaults from id if omitted |
| `combat` | object | **yes** | Passed to `resolveEnemyCombat` (see below) |

### `combat` by behavior

Every row needs `combat.wall`. Other sections depend on `behavior`:

| `behavior` | Required `combat` sections |
|------------|---------------------------|
| `meleeChaser`, `bruiser`, `wallSiege`, `charger`, `ward`, `rangedHybrid` | `wall`, `melee` (+ kit below) |
| `arrowRainArcher` | `wall`, `arrowRain` |
| `javelineer` | `wall`, `javelineer` |
| `stationaryRanged` | `wall`, `stationaryRanged` |
| `lobber` | `wall`, `lobber` |
| `wallSiege` | also `wallSiege` |
| `charger` | also `charger` |
| `ward` | also `ward` |
| `rangedHybrid` | also `stationaryRanged`, `hybrid` |

**Do not** add `combat.melee` on `arrowRainArcher`, `javelineer`, `stationaryRanged`, `lobber`.

#### `combat.wall` (all behaviors)

North wall objective attacks (`EnemyCombat` wall FSM).

| Field | Unit | Required |
|-------|------|----------|
| `damage` | number | **yes** |
| `triggerRange` | px | **yes** |
| `hitRange` | px | **yes** |

#### `combat.melee` (melee-activation behaviors)

Player-facing arc swipe (`meleeChaser`, `bruiser`, `wallSiege`, `charger`, `ward`, `rangedHybrid`).

| Field | Unit | Required |
|-------|------|----------|
| `triggerRange` | px | **yes** |
| `range` | px | **yes** |
| `arcDeg` | deg | **yes** |
| `windupMs` | ms | **yes** |
| `activeMs` | ms | **yes** |
| `recoveryMs` | ms | **yes** |
| `cooldownMs` | ms | **yes** |
| `meleeChaseStandoffWu` | WU | **yes** on chase behaviors listed above; extra gap when stopping before player contact |

#### `combat.arrowRain` (`arrowRainArcher`)

Telegraphed ground zone ticks.

| Field | Unit |
|-------|------|
| `damage` | number |
| `preferredRange` | px |
| `attackTriggerRange` | px |
| `kiteBandSlackWu` | WU |
| `windupMs` | ms |
| `activeMs` | ms |
| `recoveryMs` | ms |
| `cooldownMs` | ms |
| `zoneRadius` | px |
| `tickIntervalMs` | ms |
| `tickDamageScale` | dimensionless |
| `maxTicks` | count |

#### `combat.javelineer` (`javelineer`)

| Field | Unit |
|-------|------|
| `damage` | number |
| `minRange` | px |
| `maxRange` | px |
| `kiteBandSlackWu` | WU |
| `strafeSpeedMul` | dimensionless |
| `orbitFlipMs` | ms |
| `windupMs` | ms |
| `activeMs` | ms |
| `recoveryMs` | ms |
| `cooldownMs` | ms |
| `projectileSpeed` | px/s |
| `projectileMaxTravel` | px |

#### `combat.stationaryRanged` (`stationaryRanged`, `rangedHybrid`)

| Field | Unit |
|-------|------|
| `damage` | number |
| `preferredRange` | px |
| `attackTriggerRange` | px |
| `kiteBandSlackWu` | WU |
| `windupMs` | ms |
| `activeMs` | ms |
| `recoveryMs` | ms |
| `cooldownMs` | ms |
| `projectileSpeed` | px/s |
| `projectileMaxTravel` | px |

#### `combat.wallSiege` (`wallSiege`)

| Field | Unit |
|-------|------|
| `playerAggroRadius` | px | Overrides global aggro while sieging |

#### `combat.charger` (`charger`)

| Field | Unit |
|-------|------|
| `chargeDamage` | number |
| `dashMinRange` | WU |
| `dashTriggerRange` | px |
| `dashWindupMs` | ms |
| `dashDurationMs` | ms |
| `dashSpeedMul` | dimensionless |
| `dashCooldownMs` | ms |
| `dashOvershootRange` | WU |

#### `combat.lobber` (`lobber`)

| Field | Unit |
|-------|------|
| `damage` | number |
| `preferredRange` | px |
| `attackTriggerRange` | px |
| `kiteBandSlackWu` | WU |
| `windupMs` | ms |
| `activeMs` | ms |
| `recoveryMs` | ms |
| `cooldownMs` | ms |
| `projectileSpeed` | px/s |
| `blastRadius` | px |
| `blastDamageScale` | dimensionless |

#### `combat.ward` (`ward`)

| Field | Unit |
|-------|------|
| `protectRadius` | px |
| `screenOffsetWu` | WU |
| `playerAggroRadius` | px |

#### `combat.hybrid` (`rangedHybrid`)

| Field | Unit |
|-------|------|
| `closeMeleeRadius` | px |
| `preferredRange` | px |
| `maxMeleeSwings` | count |
| `retreatRangeSlack` | px |

**Shipped enemy ids:** `grunt`, `bruiser`, `arrow_rain_archer`, `skirmisher`, `sentry_archer`, `javelineer`, `slow_siege`, `fast_sapper`, `charger`, `lobber`, `reaver`, `ward`.

---

## enemy-ai.json

Global chase / wall path tuning (`applyEnemyAi` → `PLAYER_AGGRO_RADIUS`, etc.).

| Field | Unit | Required |
|-------|------|----------|
| `playerAggroRadius` | px | **yes** |
| `playerChaseMemoryMs` | ms | **yes** |
| `wallVelocityBlendMs` | ms | **yes** |
| `northWallMeleeStandoffPx` | px | **yes** |

---

## entity-physics.json

Nav inflation and knockback cap (`applyEntityPhysics`).

| Field | Unit | Required |
|-------|------|----------|
| `enemyPathClearanceMarginPx` | px | **yes** |
| `staticObstacleNavClearancePx` | px | **yes** |
| `knockbackVelocityCapMult` | dimensionless | **yes** |

---

## player.json

Player combat tuning (`normalizePlayerConfig` → `applyPlayerTuning`).

| Field | Unit | Required |
|-------|------|----------|
| `moveSpeed` | px/s | **yes** |
| `maxHp` | number | **yes** |
| `bodyRadius` | px | **yes** |
| `meleeWindupMs` | ms | **yes** |
| `meleeActiveMs` | ms | **yes** |
| `meleeRecoveryMs` | ms | **yes** |
| `meleeStrikeRange` | px | **yes** |
| `meleeEngageTargetRadius` | px | **yes** |
| `meleeActivationSlackWu` | WU | **yes** |
| `meleeArcDeg` | deg | **yes** |
| `meleeDamage` | number | **yes** |
| `meleeKnockback` | knockback strength | **yes** |
| `rangedWindupMs` | ms | **yes** |
| `rangedActiveMs` | ms | **yes** |
| `rangedRecoveryMs` | ms | **yes** |
| `rangedDamage` | number | **yes** |
| `rangedMaxRange` | px | **yes** |
| `rangedKnockback` | knockback strength | **yes** |
| `projectileSpeed` | px/s | **yes** |
| `autoAttackRangedRange` | px | **yes** |
| `targetTapRadiusWorld` | px | **yes** |
| `playerHitInvulnMs` | ms | **yes** |
| `nightSpawnInvulnMs` | ms | **yes** |
| `endlessPanelDefaultConcurrent` | count | **yes** |

**Derived at boot (not in JSON):** `autoAttackMeleeRange` = `meleeStrikeRange` + `meleeEngageTargetRadius` − `meleeActivationSlackWu`.

---

## spells.json

Root object requires a `spells` array (non-empty): `{ "spells": [ ... ] }`.

### Every spell row

| Field | Required at boot | Notes |
|-------|------------------|-------|
| `id` | **yes** (string) | Content id |
| `mechanicType` | **yes** (string) | Drives validation and casting |
| `name`, `shortLabel`, `iconFile` | runtime | UI / assets |
| `castableInDefense`, `implementationPhase`, `cooldownMs`, `channelMs` | runtime | HUD and scheduling |
| `castMs`, `channelTickMs`, `targetMode`, `requireEnemyTarget`, `centerOnCaster` | optional | Cast bar / targeting |
| `baseDamage`, `projectileSpeed`, `healAmount`, `burstDamage` | optional | Per mechanic |
| `groundTargetMaxRangeWu`, `blastRadius`, `lingerMs`, `lingerTickMs` | optional | AoE / ground aim |
| `onHit` | optional | `slowPct`, `slowMs`, `dotDps`, `dotMs`, `rootMs`, `stunMs` |
| `damageFlavor` | optional | Damage typing |
| Asset keys | optional | `projectileTextureKey`, `projectileFile`, `blastTextureKey`, `blastFile` |

### Mechanic-specific boot validation

| `mechanicType` | Extra required numeric fields |
|----------------|------------------------------|
| `swing`, `tracking_swing` | `swingRangeWu`, `swingArcDeg`, `knockback` |
| `cone`, `channeled_cone` | `coneRangeWu`, `coneArcDeg`, `knockback` |
| `blink` | `blinkDistanceWu`, `blinkResolveBinarySearchIterations`, `blinkPartialMoveEpsilonWu` |
| `ice_wall` | `iceWallDistanceWu`, `iceWallDurationMs` |
| `buff` | `shadowformDurationMs`; if `id` is `shadowform` also `shadowformMoveSpeedMult`, `shadowformDamageTakenMult`, `shadowformAggroRadiusMult` |
| `projectile` | `knockback` |
| `projectile_aoe` | `knockback`, `blastKnockback` |
| `tracking_projectile` | `knockback`; if `id` is `chain_lightning` also `chainKnockback`, `chainHopKnockback`, `chainLightningHops`, `chainLightningHopRangeWu` |
| `blast` | `blastKnockback` |
| `instant_targeted` | `knockback`; `blastKnockback` when `blastRadius` or positive `burstDamage` |
| `heal`, `ice_wall`, `buff`, `blink`, `channeled`, `channeled_area` | no knockback fields |

Shadowform multipliers are also applied globally via `shadowformMechanicsFromCatalog` (formerly `spell-mechanics.json`).

---

## defense-maps.json

| Field | Required |
|-------|----------|
| `defaultMapId` | **yes** (string, must match a map `id`) |
| `maps` | **yes** (non-empty array) |

Each map:

| Field | Required |
|-------|----------|
| `id` | **yes** (string) |
| `field` | **yes** (object) |
| `cols` | **yes** on `field` (tiles, ≥ 1) |
| `rows` | **yes** on `field` (tiles, ≥ 1) |
| `obstacles` | **yes** (non-empty array) |

Each obstacle:

| Field | Required |
|-------|----------|
| `tileX` | **yes** |
| `tileY` | **yes** |
| `textureKey` | **yes** (must be a key from `OBSTACLE_TEXTURE` in `src/content/assets.ts`) |

---

## waves.json

Top-level keys: **night number** (string) → wave def.

| Field | Required |
|-------|----------|
| `rewardGold` | **yes** (gold on clear) |
| `groups` | **yes** (array) |

Each group:

| Field | Required |
|-------|----------|
| `atMs` | **yes** (ms from night start) |
| `enemyId` | **yes** (`enemies.json` key) |
| `count` | **yes** |
| `intervalMs` | **yes** (spacing between spawns in group) |

`DataStore.getWaveForNight` uses the exact night key, else the highest defined night ≤ requested, else night `1`.

---

## buildings.json

Town upgrade defs keyed by building id (`wall`, `blacksmith`, …).

| Field | Required |
|-------|----------|
| `maxLevel` | **yes** |
| `costByLevel` | **yes** (array length = purchasable steps) |
| `effect` | **yes** | `wallHpMax` or `playerDamage` (see `GameState` / town menu) |

---

## town_buildings.json

Town clickable building art + actions (`TownBuildingDef`).

| Field | Required |
|-------|----------|
| `label` | **yes** |
| `textureKey` | **yes** |
| `width` | **yes** (px) |
| `height` | **yes** (px) |
| `upgradeId` | optional | Links to `buildings.json` id |
| `startsNight` | optional | Tap → Defense night |
| `opensSpellBar` | optional | Spell sort panel |
| `opensEndlessMode` | optional | Endless training panel |
| `opensWavePlanner` | optional | Custom wave planner |

---

## town_layout.json

| Field | Required |
|-------|----------|
| `slots` | **yes** (array) |

Each slot:

| Field | Required |
|-------|----------|
| `buildingId` | **yes** (`town_buildings.json` key) |
| `x` | **yes** (town scene px) |
| `y` | **yes** (town scene px) |