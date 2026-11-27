import { TOWN_GROWTH_PLACEHOLDER } from "../../config/townGrowth";
import type { TownBuildingDef } from "../../core/townBuildingTypes";
import type { TownStageIndex } from "./townIsoTypes";

type Levels = Readonly<Record<string, number>>;
type TierTable = Readonly<Record<string, readonly number[]>>;

const G = TOWN_GROWTH_PLACEHOLDER;

/** Sum of the upgrade levels that drive town growth (placeholder rule, see config). */
export function townGrowthScore(buildings: Levels): number {
  let score = 0;
  for (const id of G.scoreBuildingIds) {
    const lv = buildings[id] ?? 0;
    if (Number.isFinite(lv) && lv > 0) score += lv;
  }
  return score;
}

/** Highest index i with `mins[i] <= value` (0 when below every entry). */
function tierFor(value: number, mins: readonly number[]): number {
  let tier = 0;
  for (let i = 0; i < mins.length; i++) {
    if (value >= (mins[i] ?? Number.POSITIVE_INFINITY)) tier = i;
  }
  return tier;
}

export type TownGrowthView = {
  /** Placeholder town level (1-based). */
  townLevel: number;
  maxTownLevel: number;
  stage: TownStageIndex;
  /** 0..1 progress toward the next town level (1 at max). */
  progress: number;
  /** Town level that unlocks the next growth stage, or null at the last stage. */
  nextStageTownLevel: number | null;
};

export function townGrowthView(buildings: Levels): TownGrowthView {
  const score = townGrowthScore(buildings);
  const mins = G.townLevelMinScore;
  const levelIdx = tierFor(score, mins);
  const townLevel = levelIdx + 1;
  const stage = tierFor(townLevel, G.stageMinTownLevel) as TownStageIndex;
  const lo = mins[levelIdx] ?? 0;
  const hi = mins[levelIdx + 1];
  const progress =
    hi === undefined ? 1 : Math.min(1, Math.max(0, (score - lo) / (hi - lo)));
  const nextStageTownLevel = G.stageMinTownLevel[stage + 1] ?? null;
  return {
    townLevel,
    maxTownLevel: mins.length,
    stage,
    progress,
    nextStageTownLevel,
  };
}

/**
 * Art tier (0..2) for a tappable building: its own upgrade / shop level when it has one
 * (`artTierMinLevel`), otherwise the town growth stage.
 */
export function townBuildingArtTier(
  def: TownBuildingDef,
  buildings: Levels,
  stage: TownStageIndex,
): TownStageIndex {
  const table = G.artTierMinLevel as TierTable;
  const id = def.upgradeId ?? def.opensShop;
  const mins = id ? table[id] : undefined;
  if (!id || !mins) return stage;
  return tierFor(buildings[id] ?? 0, mins) as TownStageIndex;
}
