export const GAME = {
  width: 390,
  height: 844,
  worldHalfSize: 520,
} as const;

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
  meleeKnockback: 320,
  rangedKnockback: 110,
  maxHp: 100,
  autoAttackMeleeRange: 52,
  autoAttackRangedRange: 300,
  targetTapRadiusWorld: 56,
  playerHitInvulnMs: 900,
  nightSpawnInvulnMs: 1500,
} as const;

export const ENEMY_TUNING = {
  gruntHp: 30,
  gruntSpeed: 85,
  attackDamage: 8,
  attackTriggerRange: 36,
  attackRange: 26,
  attackArcDeg: 70,
  attackWindupMs: 380,
  attackActiveMs: 110,
  attackRecoveryMs: 480,
  attackCooldownMs: 350,
} as const;

export type SaveGame = {
  night: number;
  gold: number;
  buildings: Record<string, number>;
  townWallHp: number;
  townWallHpMax: number;
  player: {
    hp: number;
    hpMax: number;
    weaponId: string;
    moveSpeed: number;
  };
  flags: string[];
};

export type NightResult = {
  won: boolean;
  goldEarned: number;
  wallDamage: number;
  night: number;
};

export const SAVE_VERSION = 1;