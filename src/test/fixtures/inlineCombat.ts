import type {
  EnemyArrowRainCombat,
  EnemyChargerCombat,
  EnemyJavelineerCombat,
  EnemyStationaryRangedCombat,
  EnemyWallCombat,
  EnemyWallSiegeCombat,
} from "../../core/enemyTuning";

/** Minimal inline combat blocks for behavior tests (not shipped tuning). */
export const testWallCombat: EnemyWallCombat = {
  damage: 6,
  triggerRange: 42,
  hitRange: 34,
};

export const testChargerCombat: EnemyChargerCombat = {
  dashTriggerRange: 120,
  dashWindupMs: 280,
  dashDurationMs: 400,
  dashSpeedMul: 2,
  dashCooldownMs: 2000,
  dashOvershootRange: 64,
};

export const testWallSiegeCombat: EnemyWallSiegeCombat = {
  playerAggroRadius: 80,
};

export const testStationaryRangedCombat: EnemyStationaryRangedCombat = {
  preferredRange: 105,
  attackTriggerRange: 140,
  windupMs: 400,
  activeMs: 80,
  recoveryMs: 400,
  cooldownMs: 1200,
  projectileSpeed: 300,
  projectileMaxTravel: 200,
};

export const testArrowRainCombat: EnemyArrowRainCombat = {
  preferredRange: 120,
  attackTriggerRange: 150,
  windupMs: 800,
  activeMs: 1000,
  recoveryMs: 500,
  cooldownMs: 2000,
  zoneRadius: 60,
  tickIntervalMs: 250,
  tickDamageScale: 0.5,
  maxTicks: 4,
};

export const testJavelineerCombat: EnemyJavelineerCombat = {
  minRange: 50,
  maxRange: 180,
  strafeSpeedMul: 0.9,
  orbitFlipMs: 1200,
  windupMs: 300,
  activeMs: 100,
  recoveryMs: 400,
  cooldownMs: 1000,
  projectileSpeed: 320,
  projectileMaxTravel: 220,
};