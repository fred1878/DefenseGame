import type { EnemyAiTuning } from "../../config/enemy";
import {
  type NumberSections,
  numberSectionKeys,
  requireFiniteNumber,
  requireNumberSections,
  requireRecord,
} from "./configValidation";

/** Authorable shape; every field is checked by {@link normalizeEnemyAi}. */
export type EnemyAiInput = Partial<Record<keyof EnemyAiTuning, unknown>>;

/** Boot-required top-level keys for `public/data/enemy-ai.json` (see `DATA_FIELDS.md`). */
export const ENEMY_AI_BOOT_KEYS = [
  "playerAggroRadiusWu",
  "playerChaseMemoryMs",
  "wallVelocityBlendMs",
  "northWallMeleeStandoffWu",
] as const satisfies readonly (keyof EnemyAiTuning)[];

/**
 * Boot-required nested sections of `enemy-ai.json`: shared pathing / retreat
 * steering plus per-behaviour movement multipliers and distances. These apply
 * to every enemy with that `behavior`; per-enemy attack numbers stay in
 * `enemies.json` `combat`.
 */
export const ENEMY_AI_SECTION_KEYS = {
  pathing: ["waypointRadiusWu", "replanMs", "stallMs", "stallProgressWu"],
  retreat: [
    "probeDistPx",
    "defaultGoalWu",
    "sidestepSpeedMul",
    "blendReachWu",
    "blendMinWeight",
  ],
  javelineer: [
    "strafeProbeDistPx",
    "rangeApproachBlend",
    "rangeRetreatBlend",
    "closeRetreatBlend",
    "idealRangeNudge",
    "idealBandFrac",
    "closeRetreatSpeedMul",
    "closeRetreatExtraWu",
    "closeRetreatMinWu",
    "approachSpeedMul",
    "bandRetreatMinSpeedMul",
    "bandRetreatMinWu",
    "wallRetreatSpeedMul",
    "wallRetreatExtraWu",
    "wallRetreatMinWu",
  ],
  stationaryRanged: [
    "wallRetreatSpeedMul",
    "wallRetreatMinWu",
    "playerRetreatSpeedMul",
    "playerRetreatMinWu",
    "followSpeedMul",
  ],
  arrowRainArcher: [
    "followSpeedMul",
    "wallRetreatSpeedMul",
    "wallRetreatMinWu",
    "playerRetreatSpeedMul",
    "playerRetreatMinWu",
  ],
  rangedHybrid: [
    "retreatSpeedMul",
    "retreatMinWu",
    "meleeChaseSpeedMul",
    "closeChaseSpeedMul",
    "kiteRetreatSpeedMul",
    "kiteRetreatMinWu",
    "kiteFollowSpeedMul",
  ],
  lobber: ["retreatSpeedMul", "retreatMinWu", "followSpeedMul"],
  ward: ["chaseSpeedMul"],
} as const;

export type EnemyAiSections = NumberSections<typeof ENEMY_AI_SECTION_KEYS>;

/** Flat key names of {@link ENEMY_AI_SECTION_KEYS} (doc parity). */
export const ENEMY_AI_SECTION_DOC_KEYS = numberSectionKeys(
  ENEMY_AI_SECTION_KEYS,
);

export function normalizeEnemyAi(
  raw: EnemyAiInput | null | undefined,
): EnemyAiTuning {
  const root = requireRecord(raw, "enemy-ai");
  const flat = {} as Record<(typeof ENEMY_AI_BOOT_KEYS)[number], number>;
  for (const key of ENEMY_AI_BOOT_KEYS) {
    flat[key] = requireFiniteNumber(root[key], `enemy-ai.${key}`);
  }
  return {
    ...flat,
    ...requireNumberSections(root, ENEMY_AI_SECTION_KEYS, "enemy-ai"),
  };
}
