/** Chase player when line-of-sight is clear and distance ≤ this (world px). */
export const PLAYER_AGGRO_RADIUS = 320;

/** After LOS breaks, keep chasing last known player position for this long (ms). */
export const PLAYER_CHASE_MEMORY_MS = 2000;

/** Blend from chase velocity toward wall path when abandoning player pursuit (ms). */
export const WALL_VELOCITY_BLEND_MS = 420;

export const ENEMY_TUNING = {
  gruntHp: 30,
  gruntSpeed: 85,
  wallAttackDamage: 6,
  wallAttackTriggerRange: 42,
  wallAttackRange: 34,
  attackDamage: 8,
  attackTriggerRange: 36,
  attackRange: 26,
  attackArcDeg: 70,
  attackWindupMs: 380,
  attackActiveMs: 110,
  attackRecoveryMs: 480,
  attackCooldownMs: 350,
} as const;

/** Slow archer — telegraphed floor AoE then damage ticks. */
export const ARROW_RAIN_TUNING = {
  preferredRange: 150,
  attackTriggerRange: 168,
  windupMs: 900,
  activeMs: 1200,
  recoveryMs: 520,
  cooldownMs: 2200,
  zoneRadius: 72,
  tickIntervalMs: 300,
  tickDamageScale: 0.55,
  maxTicks: 4,
} as const;

/** Fast skirmisher — kite band + javelin toss. */
export const JAVELINEER_TUNING = {
  minRange: 52,
  maxRange: 198,
  strafeSpeedMul: 0.92,
  orbitFlipMs: 1400,
  windupMs: 340,
  activeMs: 120,
  recoveryMs: 420,
  cooldownMs: 1100,
  projectileSpeed: 340,
  projectileMaxTravel: 240,
} as const;

export type MeleeCombatTuning = {
  wallAttackDamage: number;
  wallAttackTriggerRange: number;
  wallAttackRange: number;
  attackTriggerRange: number;
  attackRange: number;
  attackArcDeg: number;
  attackWindupMs: number;
  attackActiveMs: number;
  attackRecoveryMs: number;
  attackCooldownMs: number;
};

export const GRUNT_MELEE_TUNING: MeleeCombatTuning = {
  wallAttackDamage: ENEMY_TUNING.wallAttackDamage,
  wallAttackTriggerRange: ENEMY_TUNING.wallAttackTriggerRange,
  wallAttackRange: ENEMY_TUNING.wallAttackRange,
  attackTriggerRange: ENEMY_TUNING.attackTriggerRange,
  attackRange: ENEMY_TUNING.attackRange,
  attackArcDeg: ENEMY_TUNING.attackArcDeg,
  attackWindupMs: ENEMY_TUNING.attackWindupMs,
  attackActiveMs: ENEMY_TUNING.attackActiveMs,
  attackRecoveryMs: ENEMY_TUNING.attackRecoveryMs,
  attackCooldownMs: ENEMY_TUNING.attackCooldownMs,
};

/** Slow polearm skirmisher — long melee reach, telegraphed swings. */
export const BRUISER_MELEE_TUNING: MeleeCombatTuning = {
  wallAttackDamage: 8,
  wallAttackTriggerRange: 52,
  wallAttackRange: 44,
  attackTriggerRange: 50,
  attackRange: 44,
  attackArcDeg: 78,
  attackWindupMs: 480,
  attackActiveMs: 130,
  attackRecoveryMs: 600,
  attackCooldownMs: 520,
};

export function meleeCombatTuningForDef(defId: string): MeleeCombatTuning {
  return defId === "bruiser" ? BRUISER_MELEE_TUNING : GRUNT_MELEE_TUNING;
}