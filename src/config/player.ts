export type AttackMode = "melee" | "ranged" | "auto";

/** Matches `ENTITY_BODY_RADIUS.enemy`; added to strike reach for auto-melee engage. */
const MELEE_ENGAGE_TARGET_RADIUS = 14;

/** Base melee tuning export; arc hits use `meleeStrikeRange`. */
const meleeRange = 58;
/** Damage / connect arc reach (world units at 2×). */
const meleeStrikeRange = 93;

export const PLAYER_TUNING = {
  moveSpeed: 220,
  meleeWindupMs: 120,
  meleeActiveMs: 100,
  meleeRecoveryMs: 280,
  meleeRange,
  meleeStrikeRange,
  meleeArcDeg: 121,
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
  /** Center-to-center gate for auto/melee windup (strike + enemy radius, −4px vs prior). */
  autoAttackMeleeRange: meleeStrikeRange + MELEE_ENGAGE_TARGET_RADIUS - 4,
  autoAttackRangedRange: 300,
  targetTapRadiusWorld: 56,
  playerHitInvulnMs: 900,
  nightSpawnInvulnMs: 1500,
} as const;