export type AttackMode = "melee" | "ranged" | "auto";

/** Matches `ENTITY_BODY_RADIUS.enemy`; arc hits use `meleeRange + targetRadius`. */
const MELEE_ENGAGE_TARGET_RADIUS = 14;

const meleeRange = 62;

export const PLAYER_TUNING = {
  moveSpeed: 220,
  meleeWindupMs: 120,
  meleeActiveMs: 100,
  meleeRecoveryMs: 280,
  meleeRange,
  meleeArcDeg: 126,
  meleeDamage: 15,
  rangedWindupMs: 100,
  rangedActiveMs: 50,
  rangedRecoveryMs: 380,
  rangedDamage: 12,
  rangedMaxRange: 340,
  projectileSpeed: 420,
  meleeKnockback: 320,
  rangedKnockback: 110,
  maxHp: 100,
  autoAttackMeleeRange: meleeRange + MELEE_ENGAGE_TARGET_RADIUS,
  autoAttackRangedRange: 300,
  targetTapRadiusWorld: 56,
  playerHitInvulnMs: 900,
  nightSpawnInvulnMs: 1500,
} as const;