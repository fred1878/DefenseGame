import type { EconomyPolicy } from "../core/economyPolicy";

export const DEBUG_INFINITE_GOLD_KEY = "debugInfiniteGold";
export const DEBUG_INFINITE_TALENT_POINTS_KEY = "debugInfiniteTalentPoints";

/** Session-only: all gold costs pass affordability checks without spending balance. */
export function debugInfiniteGold(registry: Phaser.Data.DataManager): boolean {
  return registry.get(DEBUG_INFINITE_GOLD_KEY) === true;
}

export function setDebugInfiniteGold(
  registry: Phaser.Data.DataManager,
  value: boolean,
): void {
  registry.set(DEBUG_INFINITE_GOLD_KEY, value);
}

/** Session-only: talent learn / spend checks treat points as unlimited (earned total unchanged). */
export function debugInfiniteTalentPoints(
  registry: Phaser.Data.DataManager,
): boolean {
  return registry.get(DEBUG_INFINITE_TALENT_POINTS_KEY) === true;
}

export function setDebugInfiniteTalentPoints(
  registry: Phaser.Data.DataManager,
  value: boolean,
): void {
  registry.set(DEBUG_INFINITE_TALENT_POINTS_KEY, value);
}

/** Economy overrides for gold / talent rules from this session's debug cheats. */
export function debugEconomyPolicy(
  registry: Phaser.Data.DataManager,
): EconomyPolicy {
  return {
    infiniteGold: debugInfiniteGold(registry),
    infiniteTalentPoints: debugInfiniteTalentPoints(registry),
  };
}
