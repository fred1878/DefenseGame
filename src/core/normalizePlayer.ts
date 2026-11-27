import type { PlayerTuning } from "../config/player";
import {
  optionalFiniteNumber,
  requireFiniteNumber,
  requireRecord,
} from "./configValidation";
import { clampEndlessConcurrent } from "./endlessLimits";

/** Boot-required tuning keys for `public/data/player.json` (see `DATA_FIELDS.md`). */
export const PLAYER_TUNING_BOOT_KEYS = [
  "moveSpeedWu",
  "meleeWindupMs",
  "meleeActiveMs",
  "meleeFxStartMs",
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
export const PLAYER_MELEE_FX_OPTIONAL_KEYS = ["meleeFxDurationMs"] as const;

export const PLAYER_BOOT_KEYS = [
  ...PLAYER_TUNING_BOOT_KEYS,
  ...PLAYER_MELEE_FX_OPTIONAL_KEYS,
  "endlessPanelDefaultConcurrent",
] as const;

export type PlayerConfigInput = Partial<
  Record<(typeof PLAYER_TUNING_BOOT_KEYS)[number], number>
> & {
  endlessPanelDefaultConcurrent?: number;
};

export type PlayerConfig = PlayerTuning & {
  endlessPanelDefaultConcurrent: number;
};

export function normalizePlayerConfig(
  raw: PlayerConfigInput | null | undefined,
): PlayerConfig {
  const root = requireRecord(raw, "player");
  const tuning = {} as Record<string, number>;
  for (const key of PLAYER_TUNING_BOOT_KEYS) {
    tuning[key] = requireFiniteNumber(root[key], `player.${key}`);
  }
  const meleeStrikeRangeWu = tuning.meleeStrikeRangeWu!;
  const meleeEngageTargetRadiusWu = tuning.meleeEngageTargetRadiusWu!;
  const meleeActivationSlackWu = tuning.meleeActivationSlackWu!;
  const meleeFxDurationMs = optionalFiniteNumber(
    root.meleeFxDurationMs,
    "player.meleeFxDurationMs",
  );
  const playerTuning: PlayerTuning = {
    ...(tuning as PlayerTuning),
    ...(meleeFxDurationMs !== undefined ? { meleeFxDurationMs } : {}),
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
  return (
    meleeStrikeRangeWu + meleeEngageTargetRadiusWu - meleeActivationSlackWu
  );
}
