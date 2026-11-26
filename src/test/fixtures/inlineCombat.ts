import type {
  EnemyArrowRainCombat,
  EnemyAttackMovement,
  EnemyChargerCombat,
  EnemyJavelineerCombat,
  EnemyStationaryRangedCombat,
  EnemyWallCombat,
  EnemyWallSiegeCombat,
} from "../../core/enemyTuning";

/** Shipped default for most kits: hold still while the attack plays. */
export const stillAttackMovement: EnemyAttackMovement = {
  windupMul: 0,
  activeMul: 0,
  recoveryMul: 0,
};

/** Minimal inline combat blocks for behavior tests (not shipped tuning). */
export const testWallCombat: EnemyWallCombat = {
  damage: 6,
  triggerRangeWu: 42,
  hitRangeWu: 34,
};

export const testChargerCombat: EnemyChargerCombat = {
  chargeDamage: 30,
  dashMinRangeWu: 40,
  dashTriggerRangeWu: 120,
  dashWindupMs: 280,
  dashDurationMs: 400,
  dashSpeedMul: 2,
  dashCooldownMs: 2000,
  dashOvershootRangeWu: 64,
};

export const testWallSiegeCombat: EnemyWallSiegeCombat = {
  playerAggroRadiusWu: 80,
};

export const testStationaryRangedCombat: EnemyStationaryRangedCombat = {
  damage: 10,
  preferredRangeWu: 210,
  attackTriggerRangeWu: 290,
  kiteBandSlackWu: 22,
  windupMs: 400,
  activeMs: 80,
  recoveryMs: 400,
  cooldownMs: 1200,
  projectileSpeedWu: 300,
  projectileMaxTravelWu: 200,
  attackMovement: stillAttackMovement,
};

export const testArrowRainCombat: EnemyArrowRainCombat = {
  damage: 10,
  preferredRangeWu: 120,
  attackTriggerRangeWu: 150,
  kiteBandSlackWu: 24,
  windupMs: 800,
  activeMs: 1000,
  recoveryMs: 500,
  cooldownMs: 2000,
  zoneRadiusWu: 60,
  tickIntervalMs: 250,
  tickDamageScale: 0.5,
  maxTicks: 4,
  attackMovement: stillAttackMovement,
};

export const testJavelineerCombat: EnemyJavelineerCombat = {
  damage: 10,
  minRangeWu: 80,
  maxRangeWu: 289,
  kiteBandSlackWu: 28,
  strafeSpeedMul: 0.9,
  orbitFlipMs: 1200,
  windupMs: 300,
  activeMs: 100,
  recoveryMs: 400,
  cooldownMs: 1000,
  projectileSpeedWu: 320,
  projectileMaxTravelWu: 220,
  attackMovement: stillAttackMovement,
};
