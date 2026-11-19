import type { PlayerTuning } from "../config/player";
import {
  requireFiniteNumber,
  requireRecord,
} from "./configValidation";
import { clampEndlessConcurrent } from "../systems/endlessSpawnScheduler";

const PLAYER_TUNING_KEYS = [
  "moveSpeed",
  "meleeWindupMs",
  "meleeActiveMs",
  "meleeRecoveryMs",
  "meleeRange",
  "meleeStrikeRange",
  "meleeEngageTargetRadius",
  "meleeActivationSlackWu",
  "meleeArcDeg",
  "meleeDamage",
  "rangedWindupMs",
  "rangedActiveMs",
  "rangedRecoveryMs",
  "rangedDamage",
  "rangedMaxRange",
  "projectileSpeed",
  "meleeKnockback",
  "rangedKnockback",
  "maxHp",
  "autoAttackRangedRange",
  "targetTapRadiusWorld",
  "playerHitInvulnMs",
  "nightSpawnInvulnMs",
] as const satisfies readonly (keyof PlayerTuning)[];

/** Authorable subset of `public/data/player.json` (derived fields omitted). */
export type PlayerConfigInput = Partial<Record<(typeof PLAYER_TUNING_KEYS)[number], number>> & {
  endlessPanelDefaultConcurrent?: number;
};

export type PlayerConfig = PlayerTuning & {
  endlessPanelDefaultConcurrent: number;
};

export function normalizePlayerConfig(raw: PlayerConfigInput | null | undefined): PlayerConfig {
  const root = requireRecord(raw, "player");
  const tuning = {} as Record<string, number>;
  for (const key of PLAYER_TUNING_KEYS) {
    tuning[key] = requireFiniteNumber(root[key], `player.${key}`);
  }
  const meleeStrikeRange = tuning.meleeStrikeRange!;
  const meleeEngageTargetRadius = tuning.meleeEngageTargetRadius!;
  const meleeActivationSlackWu = tuning.meleeActivationSlackWu!;
  const playerTuning: PlayerTuning = {
    ...(tuning as PlayerTuning),
    autoAttackMeleeRange: computeAutoAttackMeleeRange(
      meleeStrikeRange,
      meleeEngageTargetRadius,
      meleeActivationSlackWu,
    ),
  };
  const endlessPanelDefaultConcurrent = clampEndlessConcurrent(
    requireFiniteNumber(
      root.endlessPanelDefaultConcurrent,
      "player.endlessPanelDefaultConcurrent",
    ),
  );
  return { ...playerTuning, endlessPanelDefaultConcurrent };
}

/** Center-to-center engage gate; matches derivation from strike + engage slack fields. */
function computeAutoAttackMeleeRange(
  meleeStrikeRange: number,
  meleeEngageTargetRadius: number,
  meleeActivationSlackWu: number,
): number {
  return meleeStrikeRange + meleeEngageTargetRadius - meleeActivationSlackWu;
}