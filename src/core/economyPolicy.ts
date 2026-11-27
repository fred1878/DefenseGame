import type { SaveGame } from "./save/saveTypes";

/**
 * Overrides passed into gold and talent rules. Today only the debug menu's
 * session cheats set these (`debug/debugEconomy.debugEconomyPolicy`), so the
 * rules themselves never read debug state.
 */
export type EconomyPolicy = {
  /** Gold checks always pass (gold still deducts when spent). */
  readonly infiniteGold?: boolean;
  /** Talent learn / spend checks treat points as unlimited. */
  readonly infiniteTalentPoints?: boolean;
};

export function hasEnoughGold(
  save: SaveGame,
  cost: number,
  policy?: EconomyPolicy,
): boolean {
  if (policy?.infiniteGold) return true;
  return save.gold >= cost;
}
