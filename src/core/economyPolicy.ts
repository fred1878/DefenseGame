import type { SaveGame } from "./save/saveTypes";

/**
 * Overrides passed into gold and talent rules. Today only the debug menu's
 * session cheats set these (`debug/debugEconomy.debugEconomyPolicy`), so the
 * rules themselves never read debug state.
 */
export type EconomyPolicy = {
  /** Gold checks always pass; spending does not reduce balance. */
  readonly infiniteGold?: boolean;
  /** Talent learn / spend checks treat points as unlimited. */
  readonly infiniteTalentPoints?: boolean;
};

export function hasEnoughGold(
  save: SaveGame,
  cost: number,
  policy?: EconomyPolicy,
): boolean {
  if (cost <= 0) return true;
  if (policy?.infiniteGold) return true;
  return save.gold >= cost;
}

/** Apply a gold cost; infinite-gold policy leaves the balance unchanged. */
export function spendGold(
  balance: number,
  cost: number,
  policy?: EconomyPolicy,
): number {
  if (cost <= 0 || policy?.infiniteGold) return balance;
  return balance - cost;
}
