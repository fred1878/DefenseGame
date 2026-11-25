export type AttackMode = "melee" | "ranged" | "auto";

export type PlayerTuning = {
  moveSpeedWu: number;
  meleeWindupMs: number;
  meleeActiveMs: number;
  meleeRecoveryMs: number;
  /** Ms after player melee windup begins until swipe VFX (required in `player.json`). */
  meleeFxStartMs: number;
  /** Target on-screen player melee swipe duration; default `meleeActiveMs`. */
  meleeFxDurationMs: number;
  meleeStrikeRangeWu: number;
  meleeEngageTargetRadiusWu: number;
  meleeActivationSlackWu: number;
  meleeArcDeg: number;
  meleeDamage: number;
  rangedWindupMs: number;
  rangedActiveMs: number;
  rangedRecoveryMs: number;
  rangedDamage: number;
  rangedMaxRangeWu: number;
  projectileSpeedWu: number;
  meleeKnockbackWu: number;
  rangedKnockbackWu: number;
  maxHp: number;
  autoAttackMeleeRange: number;
  autoAttackRangedRange: number;
  targetTapRadiusWu: number;
  playerHitInvulnMs: number;
  nightSpawnInvulnMs: number;
  /** Arcade physics circle radius (authored world units). */
  bodyRadiusWu: number;
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