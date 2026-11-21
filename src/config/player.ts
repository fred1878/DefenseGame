export type AttackMode = "melee" | "ranged" | "auto";

export type PlayerTuning = {
  moveSpeed: number;
  meleeWindupMs: number;
  meleeActiveMs: number;
  meleeRecoveryMs: number;
  meleeStrikeRange: number;
  meleeEngageTargetRadius: number;
  meleeActivationSlackWu: number;
  meleeArcDeg: number;
  meleeDamage: number;
  rangedWindupMs: number;
  rangedActiveMs: number;
  rangedRecoveryMs: number;
  rangedDamage: number;
  rangedMaxRange: number;
  projectileSpeed: number;
  meleeKnockback: number;
  rangedKnockback: number;
  maxHp: number;
  autoAttackMeleeRange: number;
  autoAttackRangedRange: number;
  targetTapRadiusWorld: number;
  playerHitInvulnMs: number;
  nightSpawnInvulnMs: number;
  /** Arcade physics circle radius (px, design units). */
  bodyRadius: number;
};

/** Active tuning (from JSON after Boot). Uninitialized until `applyPlayerTuning`. */
export let PLAYER_TUNING: PlayerTuning = unsetPlayerTuning();

function unsetPlayerTuning(): PlayerTuning {
  const trap = new Proxy({} as PlayerTuning, {
    get() {
      throw new Error(
        "PLAYER_TUNING not loaded — Boot must apply public/data/player.json",
      );
    },
  });
  return trap;
}

/** Replace runtime tuning after `public/data/player.json` loads (Boot). */
export function applyPlayerTuning(tuning: PlayerTuning): void {
  PLAYER_TUNING = { ...tuning };
}