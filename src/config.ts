export const GAME = {
  width: 390,
  height: 844,
  worldHalfSize: 520,
} as const;

export const PLAYER_TUNING = {
  moveSpeed: 220,
  attackWindupMs: 120,
  attackActiveMs: 100,
  attackRecoveryMs: 280,
  attackRange: 42,
  attackArcDeg: 90,
  attackDamage: 15,
  maxHp: 100,
} as const;

export const ENEMY_TUNING = {
  gruntHp: 30,
  gruntSpeed: 85,
  touchDamage: 8,
  touchCooldownMs: 600,
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