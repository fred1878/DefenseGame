export type AttackMode = "melee" | "ranged" | "auto";

const meleeRange = 58;
const meleeStrikeRange = 93;

function deriveAutoAttackMeleeRange(
  strike: number,
  engageTargetRadius: number,
  activationSlackWu: number,
): number {
  return strike + engageTargetRadius - activationSlackWu;
}

/** Code defaults when `public/data/player.json` omits keys (also used before Boot loads). */
export const PLAYER_TUNING_DEFAULTS = {
  moveSpeed: 220,
  meleeWindupMs: 120,
  meleeActiveMs: 100,
  meleeRecoveryMs: 280,
  meleeRange,
  meleeStrikeRange,
  meleeEngageTargetRadius: 14,
  meleeActivationSlackWu: 6,
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
  autoAttackMeleeRange: deriveAutoAttackMeleeRange(meleeStrikeRange, 14, 6),
  autoAttackRangedRange: 300,
  targetTapRadiusWorld: 56,
  playerHitInvulnMs: 900,
  nightSpawnInvulnMs: 1500,
} as const;

/** Initial concurrent cap shown in endless roster (not used by spawner). */
export const ENDLESS_PANEL_DEFAULT_CONCURRENT = 5;

export type PlayerTuning = {
  -readonly [K in keyof typeof PLAYER_TUNING_DEFAULTS]: number;
};

/** Active tuning (from JSON after Boot; defaults until then). */
export let PLAYER_TUNING: PlayerTuning = {
  ...PLAYER_TUNING_DEFAULTS,
};

/** Replace runtime tuning after `public/data/player.json` loads (Boot). */
export function applyPlayerTuning(tuning: PlayerTuning): void {
  PLAYER_TUNING = { ...tuning };
}