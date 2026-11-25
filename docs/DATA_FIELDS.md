# `public/data/` field reference

Boot loads every file here in `DataStore.loadAll`. Missing boot-required fields throw `ConfigLoadError` with a JSON path.

## Documentation format (CI)

Each boot-required field must appear in that file's `## *.json` section as either:

- `autoAttackMeleeRange` — px; derived melee engage range at Boot (example bullet), or
- A table row `| \`fieldName\` | … |` where cells after the field name combine to ≥15 characters of **type, unit, and meaning** (no `TBD` / `TODO`).

**Bidirectional parity:** `src/core/dataFieldsDoc.test.ts` compares exported `*BOOT_KEYS` from `normalize*` (and `dataFieldsDocKeys.ts`) to parsed field names per section. CI fails on **missing** keys (new config not documented) and **extra** keys (renamed/removed config still in the doc). Update normalize key lists and this file in the **same PR**.

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
| `player.json` | yes (`normalizePlayerConfig`) |
| `spell_input.json` | yes (`normalizeSpellInput`) |
| `spells.json` | yes (`normalizeSpellCatalog`) |
| `town_buildings.json` | yes (no schema validator) |
| `town_layout.json` | yes (`normalizeTownLayout`) |
| `waves.json` | yes (no schema validator) |

### TypeScript types

| File | Input (authorable) | Resolved / runtime | Module |
|------|---------------------|-------------------|--------|
| `buildings.json` | — | [BuildingDef](../src/core/DataStore.ts) | [DataStore.ts](../src/core/DataStore.ts) |
| `defense-maps.json` | [DefenseMapsFileInput](../src/core/normalizeDefenseMaps.ts), [DefenseMapInput](../src/core/normalizeDefenseMaps.ts) | [DefenseMapsRegistry](../src/core/normalizeDefenseMaps.ts), [DefenseMapDef](../src/core/normalizeDefenseMaps.ts) | [normalizeDefenseMaps.ts](../src/core/normalizeDefenseMaps.ts) |
| `enemies.json` | [EnemyDefInput](../src/core/normalizeEnemy.ts), [EnemyCombatPartial](../src/core/enemyTuning.ts) | [EnemyDef](../src/core/DataStore.ts), [ResolvedEnemyCombat](../src/core/enemyTuning.ts) | [normalizeEnemy.ts](../src/core/normalizeEnemy.ts), [enemyTuning.ts](../src/core/enemyTuning.ts) |
| `enemy-ai.json` | [EnemyAiInput](../src/core/normalizeEnemyAi.ts) | [EnemyAiTuning](../src/config/enemy.ts) | [normalizeEnemyAi.ts](../src/core/normalizeEnemyAi.ts), [enemy.ts](../src/config/enemy.ts) |
| `entity-physics.json` | [EntityPhysicsInput](../src/core/normalizeEntityPhysics.ts) | [EntityPhysicsTuning](../src/core/normalizeEntityPhysics.ts) | [normalizeEntityPhysics.ts](../src/core/normalizeEntityPhysics.ts) |
| `hit-flash.json` | [HitFlashInput](../src/core/normalizeHitFlash.ts) | [HitFlashConfig](../src/core/normalizeHitFlash.ts) | [normalizeHitFlash.ts](../src/core/normalizeHitFlash.ts), [hitFlash.ts](../src/config/hitFlash.ts) |
| `player.json` | [PlayerConfigInput](../src/core/normalizePlayer.ts) | [PlayerConfig](../src/core/normalizePlayer.ts), [PlayerTuning](../src/config/player.ts) | [normalizePlayer.ts](../src/core/normalizePlayer.ts), [player.ts](../src/config/player.ts) |
| `spell_input.json` | [SpellInputConfigInput](../src/core/normalizeSpellInput.ts) | [SpellInputTuning](../src/config/spellInput.ts) | [normalizeSpellInput.ts](../src/core/normalizeSpellInput.ts), [spellInput.ts](../src/config/spellInput.ts) |
| `spells.json` | [SpellsFileInput](../src/core/normalizeSpells.ts) | [SpellDefinition](../src/content/spells.ts) | [normalizeSpells.ts](../src/core/normalizeSpells.ts), [spells.ts](../src/content/spells.ts) |
| `town_buildings.json` | — | [TownBuildingDef](../src/core/townBuildingTypes.ts) | [townBuildingTypes.ts](../src/core/townBuildingTypes.ts) |
| `town_layout.json` | [TownLayoutInput](../src/core/normalizeTownLayout.ts) | [TownLayoutDef](../src/core/townBuildingTypes.ts) | [normalizeTownLayout.ts](../src/core/normalizeTownLayout.ts), [townBuildingTypes.ts](../src/core/townBuildingTypes.ts) |
| `waves.json` | — | [WaveDef](../src/core/DataStore.ts), [WaveGroup](../src/core/DataStore.ts) | [DataStore.ts](../src/core/DataStore.ts) |

**Removed (do not re-add):** `enemy-combat-defaults.json`, `spell-mechanics.json` — combat is fully per row in `enemies.json`; Shadowform tuning lives on the `shadowform` spell row.

---

## enemies.json

**TypeScript:** [EnemyDefInput](../src/core/normalizeEnemy.ts), [EnemyDef](../src/core/DataStore.ts), [EnemyCombatPartial](../src/core/enemyTuning.ts), [ResolvedEnemyCombat](../src/core/enemyTuning.ts) — [normalizeEnemy.ts](../src/core/normalizeEnemy.ts), [enemyTuning.ts](../src/core/enemyTuning.ts).

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
| `behavior` | string | AI module in `src/ai/behaviors/` |
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

#### `combat.ward` (`ward`)

| Field | Unit | Meaning |
|-------|------|---------|
| `protectRadiusWu` | px | Px radius allies are protected by ward. |
| `screenOffsetWu` | WU | WU offset for ward screening position. |
| `playerAggroRadiusWu` | px | Px radius to prefer chasing player over objective. |

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

**TypeScript:** [EnemyAiInput](../src/core/normalizeEnemyAi.ts), [EnemyAiTuning](../src/config/enemy.ts) — [normalizeEnemyAi.ts](../src/core/normalizeEnemyAi.ts), [enemy.ts](../src/config/enemy.ts).

Global chase / wall path tuning (`applyEnemyAi` → `PLAYER_AGGRO_RADIUS`, etc.).

| Field | Unit | Meaning |
|-------|------|---------|
| `playerAggroRadiusWu` | px | Px radius to aggro on player instead of default goal. |
| `playerChaseMemoryMs` | ms | Ms to keep chasing last known player after LOS break. |
| `wallVelocityBlendMs` | ms | Ms blending velocity from chase back toward wall path. |
| `northWallMeleeStandoffWu` | px | Global px offset south of north wall for path goals. |

---

## entity-physics.json

**TypeScript:** [EntityPhysicsInput](../src/core/normalizeEntityPhysics.ts), [EntityPhysicsTuning](../src/core/normalizeEntityPhysics.ts) — [normalizeEntityPhysics.ts](../src/core/normalizeEntityPhysics.ts).

Nav inflation and knockback cap (`applyEntityPhysics`).

| Field | Unit | Meaning |
|-------|------|---------|
| `enemyPathClearanceMarginWu` | px | Extra px clearance around enemies on nav grid. |
| `staticObstacleNavClearanceWu` | px | Px inflation around obstacles for pathfinding. |
| `knockbackVelocityCapMult` | dimensionless | Caps knockback velocity to strength times this mult. |

---

## spell_input.json

**TypeScript:** [SpellInputConfigInput](../src/core/normalizeSpellInput.ts), [SpellInputTuning](../src/config/spellInput.ts) — [normalizeSpellInput.ts](../src/core/normalizeSpellInput.ts), [spellInput.ts](../src/config/spellInput.ts).

Virtual stick thresholds for spell cast interrupt vs movement detection (`applySpellInputTuning`).

| Field | Unit | Meaning |
|-------|------|---------|
| `castInterruptStickAngleDeg` | deg | Bearing change from cast-start stick aim that cancels windup/channel; release/neutral stick does not interrupt. |
| `stickMovingMagnitudeEps` | dimensionless | Raw stick magnitude above which the player counts as moving (`isStickMoving`, auto-cast stationary skip). |
| `groundTapAutoCastSpellIds` | string[] | Documented list of targeted ground AoE spell ids (`spellUsesManualGroundAim`; Boot replaces with catalog-derived ids). Short tap auto-targets; press-drag stays manual. |

---

## hit-flash.json

**TypeScript:** [HitFlashInput](../src/core/normalizeHitFlash.ts), [HitFlashConfig](../src/core/normalizeHitFlash.ts), [HitFlashFlavorEntry](../src/core/normalizeHitFlash.ts) — [normalizeHitFlash.ts](../src/core/normalizeHitFlash.ts), [hitFlash.ts](../src/config/hitFlash.ts).

Damage-flavor hit flash duration and per-flavor tint application (`normalizeHitFlash` → `applyHitFlashConfig` → `HitFlash.ts`).

| Field | Unit | Meaning |
|-------|------|---------|
| `durationMs` | ms | Linear tween length for hit-flash strength 1→0 on damaged sprites. |
| `flavors` | object | Required map keyed by `damageFlavor` (`fire`, `frost`, `physical`, `water`); one entry per flavor. |
| `tint` | dimensionless | ARGB tint integer (0–16777215) applied at flash peak via fill or multiply mode. |
| `mode` | string | `fill` uses `setTintFill` at full tint; `multiply` uses `setTint` (optionally lerped toward white). |
| `peakAlpha` | dimensionless | Sprite alpha ceiling at strength 1 when `alphaFade` is true (`peakAlpha * strength` each frame). |
| `colorFade` | boolean | When true on `multiply`, tween tint from flavor color toward white as strength drops; `fill` always uses full tint. |
| `alphaFade` | boolean | When true, scales sprite alpha with strength; when false alpha stays 1 for the whole flash. |

---

## player.json

**TypeScript:** [PlayerConfigInput](../src/core/normalizePlayer.ts), [PlayerConfig](../src/core/normalizePlayer.ts), [PlayerTuning](../src/config/player.ts) — [normalizePlayer.ts](../src/core/normalizePlayer.ts), [player.ts](../src/config/player.ts).

Player combat tuning (`normalizePlayerConfig` → `applyPlayerTuning`).

| Field | Unit | Meaning |
|-------|------|---------|
| `moveSpeedWu` | px/s | Player locomotion speed in px/s during Defense. |
| `maxHp` | number | Player maximum hit points at night start. |
| `bodyRadiusWu` | px | Arcade physics circle radius in world px. |
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

**TypeScript:** [SpellsFileInput](../src/core/normalizeSpells.ts), [SpellDefinition](../src/content/spells.ts) — [normalizeSpells.ts](../src/core/normalizeSpells.ts), [spells.ts](../src/content/spells.ts).

Root object requires a `spells` array (non-empty): `{ "spells": [ ... ] }`.


### Boot-validated spell fields (`normalizeSpellCatalog`)

| Field | Meaning |
|-------|---------|
| `spells` | Root array of spell rows; must be non-empty at Boot. |
| `id` | Unique string spell id used in save spell bar and casting. |
| `mechanicType` | Selects cast pipeline and which numeric fields are required. |
| `swingRangeWu` | WU melee swing reach for swing and tracking_swing types. |
| `swingArcDeg` | Swing arc width in degrees. |
| `coneRangeWu` | WU cone length for cone and channeled_cone types. |
| `coneArcDeg` | Cone arc width in degrees. |
| `blinkDistanceWu` | Attempted blink travel distance in WU. |
| `blinkResolveBinarySearchIterations` | Binary search steps for partial blink path resolution. |
| `blinkPartialMoveEpsilonWu` | Minimum WU travel to treat blink as having moved. |
| `iceWallDistanceWu` | WU offset where ice wall is placed ahead of caster. |
| `iceWallDurationMs` | Duration in ms before ice wall despawns. |
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

For **channeled** and **channeled_area** ground zones, `baseDamage` is the **total damage budget over the channel** (before spell damage mult); tick damage splits that budget evenly across channel ticks (`channelMs` / `channelTickMs`, minimum one tick), with any remainder on the final tick. `burstDamage` remains a separate one-shot. Post-channel **linger** DoT uses `onHit.dotDps`, not `baseDamage`.

#### `damageFlavor` (optional string)

Hit-flash tint and DoT damage flavor when the spell deals damage. Allowed values: `fire`, `frost`, `physical`, `water`. There is no `default` flavor in gameplay — every damage path must pass an explicit flavor. Omit on pure heals; non-damaging buffs/movement (`shadowform`, `blink`) may set `physical` for metadata only.

Allowed enum tokens (spell hit flash): fire (bolts, novas, bombs, combustion), frost (ice, cold cone, blizzard, roots), physical (melee, lightning, enemy projectiles, rend), water (water bolt).

Hit-flash timing and per-flavor `colorFade` / `alphaFade` live in [hit-flash.json](hit-flash.json) (`applyHitFlashConfig`); `damageFlavor` selects the matching `flavors` entry.

### Mechanic-specific boot validation (reference only)

| mechanicType | Extra required numeric fields |
|----------------|------------------------------|
| swing, tracking_swing | swingRangeWu, swingArcDeg, knockback |
| cone, channeled_cone | coneRangeWu, coneArcDeg, knockback |
| blink | blinkDistanceWu, blinkResolveBinarySearchIterations, blinkPartialMoveEpsilonWu |
| ice_wall | iceWallDistanceWu, iceWallDurationMs |
| buff | shadowformDurationMs; shadowform row also needs shadowform*Mult fields |
| projectile | knockback |
| projectile_aoe | knockback, blastKnockback |
| tracking_projectile | knockback; chain_lightning row also needs chain* fields |
| blast | blastKnockback |
| instant_targeted | knockback; blastKnockback when blastRadius or burstDamage |
| heal, channeled, channeled_area | no knockback fields |

Shadowform multipliers are also applied globally via `shadowformMechanicsFromCatalog` (formerly `spell-mechanics.json`).

---

## defense-maps.json

**TypeScript:** [DefenseMapsFileInput](../src/core/normalizeDefenseMaps.ts), [DefenseMapInput](../src/core/normalizeDefenseMaps.ts), [DefenseMapsRegistry](../src/core/normalizeDefenseMaps.ts), [DefenseMapDef](../src/core/normalizeDefenseMaps.ts) — [normalizeDefenseMaps.ts](../src/core/normalizeDefenseMaps.ts).

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

**TypeScript:** [WaveDef](../src/core/DataStore.ts), [WaveGroup](../src/core/DataStore.ts) — [DataStore.ts](../src/core/DataStore.ts).

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

`DataStore.getWaveForNight` uses the exact night key, else the highest defined night ≤ requested, else night `1`.

---

## buildings.json

**TypeScript:** [BuildingDef](../src/core/DataStore.ts) — [DataStore.ts](../src/core/DataStore.ts).

Town upgrade defs keyed by building id (`wall`, `blacksmith`, …).

| Field | Meaning |
|-------|---------|
| `maxLevel` | Maximum purchasable upgrade level for this town building. |
| `costByLevel` | Gold cost per upgrade level index in town. |
| `effect` | Effect id applied on upgrade: wallHpMax or playerDamage via GameState (see `GameState` / town menu) |

---

## town_buildings.json

**TypeScript:** [TownBuildingDef](../src/core/townBuildingTypes.ts) — [townBuildingTypes.ts](../src/core/townBuildingTypes.ts).

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

---

## town_layout.json

**TypeScript:** [TownLayoutInput](../src/core/normalizeTownLayout.ts) → [TownLayoutDef](../src/core/townBuildingTypes.ts) — [normalizeTownLayout.ts](../src/core/normalizeTownLayout.ts), [townBuildingTypes.ts](../src/core/townBuildingTypes.ts).

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
