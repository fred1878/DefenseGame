/** Chase player when line-of-sight is clear and distance ≤ this (world px). */
export const PLAYER_AGGRO_RADIUS = 240;

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