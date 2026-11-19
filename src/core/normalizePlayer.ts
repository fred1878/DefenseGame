import {
  ENDLESS_PANEL_DEFAULT_CONCURRENT,
  PLAYER_TUNING_DEFAULTS,
  type PlayerTuning,
} from "../config/player";
import { clampEndlessConcurrent } from "../systems/endlessSpawnScheduler";

/** Authorable subset of `public/data/player.json` (derived fields omitted). */
export type PlayerConfigInput = Partial<{
  [K in keyof typeof PLAYER_TUNING_DEFAULTS]: number;
}> & {
  endlessPanelDefaultConcurrent?: number;
};

export type PlayerConfig = PlayerTuning & {
  endlessPanelDefaultConcurrent: number;
};

export function normalizePlayerConfig(raw: PlayerConfigInput): PlayerConfig {
  const meleeStrikeRange =
    raw.meleeStrikeRange ?? PLAYER_TUNING_DEFAULTS.meleeStrikeRange;
  const endlessPanelDefaultConcurrent = clampEndlessConcurrent(
    raw.endlessPanelDefaultConcurrent ?? ENDLESS_PANEL_DEFAULT_CONCURRENT,
  );
  const meleeEngageTargetRadius =
    raw.meleeEngageTargetRadius ?? PLAYER_TUNING_DEFAULTS.meleeEngageTargetRadius;
  const meleeActivationSlackWu =
    raw.meleeActivationSlackWu ?? PLAYER_TUNING_DEFAULTS.meleeActivationSlackWu;
  const tuning: PlayerTuning = {
    ...PLAYER_TUNING_DEFAULTS,
    ...raw,
    meleeStrikeRange,
    meleeEngageTargetRadius,
    meleeActivationSlackWu,
    autoAttackMeleeRange: computeAutoAttackMeleeRange(
      meleeStrikeRange,
      meleeEngageTargetRadius,
      meleeActivationSlackWu,
    ),
  };
  return { ...tuning, endlessPanelDefaultConcurrent };
}

/** Center-to-center engage gate; matches `src/config/player.ts` derivation. */
function computeAutoAttackMeleeRange(
  meleeStrikeRange: number,
  meleeEngageTargetRadius: number,
  meleeActivationSlackWu: number,
): number {
  return meleeStrikeRange + meleeEngageTargetRadius - meleeActivationSlackWu;
}