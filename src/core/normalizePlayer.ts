import type { PlayerTuning } from "../config/player";
import {
  requireFiniteNumber,
  requireRecord,
} from "./configValidation";
import { clampEndlessConcurrent } from "../systems/endlessSpawnScheduler";

const PLAYER_TUNING_KEYS = [
  "moveSpeedWu",
  "meleeWindupMs",
  "meleeActiveMs",
  "meleeRecoveryMs",
  "meleeStrikeRangeWu",
  "meleeEngageTargetRadiusWu",
  "meleeActivationSlackWu",
  "meleeArcDeg",
  "meleeDamage",
  "rangedWindupMs",
  "rangedActiveMs",
  "rangedRecoveryMs",
  "rangedDamage",
  "rangedMaxRangeWu",
  "projectileSpeedWu",
  "meleeKnockbackWu",
  "rangedKnockbackWu",
  "maxHp",
  "autoAttackRangedRange",
  "targetTapRadiusWu",
  "playerHitInvulnMs",
  "nightSpawnInvulnMs",
  "bodyRadiusWu",
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
  const meleeStrikeRangeWu = tuning.meleeStrikeRangeWu!;
  const meleeEngageTargetRadiusWu = tuning.meleeEngageTargetRadiusWu!;
  const meleeActivationSlackWu = tuning.meleeActivationSlackWu!;
  const playerTuning: PlayerTuning = {
    ...(tuning as PlayerTuning),
    autoAttackMeleeRange: computeAutoAttackMeleeRange(
      meleeStrikeRangeWu,
      meleeEngageTargetRadiusWu,
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

/** Center-to-center engage gate; matches derivation from strike + engage slack fields (WU). */
function computeAutoAttackMeleeRange(
  meleeStrikeRangeWu: number,
  meleeEngageTargetRadiusWu: number,
  meleeActivationSlackWu: number,
): number {
  return meleeStrikeRangeWu + meleeEngageTargetRadiusWu - meleeActivationSlackWu;
}