export type AttackMode = "melee" | "ranged";

export const PLAYER_TUNING = {
  moveSpeed: 220,
  meleeWindupMs: 120,
  meleeActiveMs: 100,
  meleeRecoveryMs: 280,
  meleeRange: 42,
  meleeArcDeg: 90,
  meleeDamage: 15,
  rangedWindupMs: 100,
  rangedActiveMs: 50,
  rangedRecoveryMs: 380,
  rangedDamage: 12,
  rangedMaxRange: 340,
  projectileSpeed: 420,
  maxHp: 100,
  autoAttackMeleeRange: 52,
  autoAttackRangedRange: 300,
  targetTapRadiusWorld: 56,
  playerHitInvulnMs: 900,
  nightSpawnInvulnMs: 1500,
} as const;