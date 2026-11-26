export type AttackMode = "melee" | "ranged" | "auto";

export type PlayerTuning = {
  moveSpeedWu: number;
  meleeWindupMs: number;
  meleeActiveMs: number;
  meleeRecoveryMs: number;
  /** Ms after player melee windup begins until swipe VFX (required in `player.json`). */
  meleeFxStartMs: number;
  /**
   * Optional target player slash fade length (ms). Omit → default fade at `meleeActiveMs`.
   * When set: fade timeline matches `fxDurationMs` (faster/slower vs default).
   */
  meleeFxDurationMs?: number;
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

let BASE_PLAYER_TUNING: PlayerTuning = PLAYER_TUNING;

/** Replace runtime tuning after `public/data/player.json` loads (Boot). Resets any gear on top. */
export function applyPlayerTuning(tuning: PlayerTuning): void {
  BASE_PLAYER_TUNING = { ...tuning };
  PLAYER_TUNING = { ...tuning };
}

/** `player.json` values without gear (weapons fall back to these). */
export function basePlayerTuning(): PlayerTuning {
  return BASE_PLAYER_TUNING;
}

/** Active tuning with gear applied; the base stays as loaded from JSON. */
export function applyEffectivePlayerTuning(tuning: PlayerTuning): void {
  PLAYER_TUNING = { ...tuning };
}
