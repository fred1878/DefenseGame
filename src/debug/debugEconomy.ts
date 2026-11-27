import type { SaveGame } from "../core/saveTypes";

export const DEBUG_INFINITE_GOLD_KEY = "debugInfiniteGold";
export const DEBUG_INFINITE_TALENT_POINTS_KEY = "debugInfiniteTalentPoints";

/** Session-only: town upgrades / shops ignore insufficient gold (gold still deducts when spent). */
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

export function hasEnoughGold(
  save: SaveGame,
  cost: number,
  registry?: Phaser.Data.DataManager,
): boolean {
  if (registry && debugInfiniteGold(registry)) return true;
  return save.gold >= cost;
}
