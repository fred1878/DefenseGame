/** Chase player when line-of-sight is clear and distance ≤ this (world px). */
export const PLAYER_AGGRO_RADIUS = 140;

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