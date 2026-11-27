import { setTuning, tuning } from "../tuning/gameTuning";

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

let activePlayerTuning: PlayerTuning | null = null;

/** Active player tuning: `player.json` plus gear / talents for this run. */
export function playerTuning(): PlayerTuning {
  if (!activePlayerTuning) {
    throw new Error(
      "player tuning not loaded — Boot must apply public/data/player.json",
    );
  }
  return activePlayerTuning;
}

/** Replace runtime tuning after `public/data/player.json` loads (Boot). Resets any gear on top. */
export function applyPlayerTuning(next: PlayerTuning): void {
  setTuning("player", next);
  activePlayerTuning = { ...next };
}

/** `player.json` values without gear (weapons fall back to these). */
export function basePlayerTuning(): PlayerTuning {
  return tuning("player");
}

/** Active tuning with gear applied; the base stays as loaded from JSON. */
export function applyEffectivePlayerTuning(next: PlayerTuning): void {
  activePlayerTuning = { ...next };
}
