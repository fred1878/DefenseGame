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
  const tuning: PlayerTuning = {
    ...PLAYER_TUNING_DEFAULTS,
    ...raw,
    meleeStrikeRange,
    autoAttackMeleeRange: computeAutoAttackMeleeRange(meleeStrikeRange),
  };
  return { ...tuning, endlessPanelDefaultConcurrent };
}

/** Center-to-center engage gate; matches legacy `src/config/player.ts` derivation. */
function computeAutoAttackMeleeRange(meleeStrikeRange: number): number {
  const MELEE_ENGAGE_TARGET_RADIUS = 14;
  const MELEE_ACTIVATION_SLACK_WU = 6;
  return (
    meleeStrikeRange + MELEE_ENGAGE_TARGET_RADIUS - MELEE_ACTIVATION_SLACK_WU
  );
}