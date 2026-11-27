import {
  blacksmithAt,
  shopLevel,
  shopMaxLevel,
  traderAt,
  type ShopContext,
  type ShopId,
} from "../../gear/shops";
import type { SaveGame } from "../../core/save/saveTypes";
import type { GearPanelContext } from "./gearPanelLogic";

export type ShopUpgradeInfo = {
  level: number;
  maxLevel: number;
  /** Gold for the next level, or null at max level / no buildings data. */
  nextCost: number | null;
  /** Trader reroll price at the current level (0 = no reroll). */
  rerollCost: number;
  /** What the shop offers now. */
  current: string;
  /** What the next level offers ("" at max level). */
  next: string;
};

const priceLabel = (priceMulPct: number) =>
  priceMulPct === 100 ? "list prices" : `${priceMulPct}% prices`;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function rarityOdds(weights: Partial<Record<string, number>>): string {
  return Object.entries(weights)
    .filter(([, w]) => (w ?? 0) > 0)
    .map(([r, w]) => `${r} ${w}`)
    .join("/");
}

/** One-line summary of a shop's perks at `level`. */
export function shopPerksLine(
  ctx: ShopContext,
  shop: ShopId,
  level: number,
): string {
  if (shop === "trader") {
    const t = traderAt(ctx, level);
    const parts = [
      plural(t.itemCount, "item"),
      `ilvl night+${t.minItemLevelOffset}–${t.maxItemLevelOffset}`,
      priceLabel(t.priceMulPct),
      `odds ${rarityOdds(t.rarityWeights)}`,
    ];
    if (t.rerollCost > 0) parts.push(`reroll ${t.rerollCost}g`);
    if (t.requestCount > 0) parts.push(plural(t.requestCount, "request"));
    return parts.join(" · ");
  }
  const b = blacksmithAt(ctx, level);
  const parts = [priceLabel(b.priceMulPct)];
  if (b.stockCount > 0) {
    parts.push(
      `${plural(b.stockCount, "masterwork")} (${rarityOdds(b.stockRarityWeights)}, ilvl night+${b.stockItemLevelOffset})`,
    );
  }
  if (b.unlockNightsEarly > 0) {
    parts.push(`unlocks ${plural(b.unlockNightsEarly, "night")} early`);
  }
  return parts.join(" · ");
}

/** Shop level, upgrade cost and perk lines for the shop panel. */
export function shopUpgradeInfo(
  ctx: GearPanelContext,
  save: SaveGame,
): ShopUpgradeInfo | null {
  if (!ctx.shop) return null;
  const { id, ctx: shopCtx, buildings } = ctx.shop;
  const level = shopLevel(save, shopCtx, id);
  const def = buildings?.[id];
  const maxLevel = Math.min(shopMaxLevel(shopCtx, id), def?.maxLevel ?? 0);
  const atMax = level >= maxLevel;
  return {
    level,
    maxLevel,
    nextCost: atMax ? null : (def?.costByLevel[level] ?? null),
    rerollCost: id === "trader" ? traderAt(shopCtx, level).rerollCost : 0,
    current: shopPerksLine(shopCtx, id, level),
    next: atMax ? "" : shopPerksLine(shopCtx, id, level + 1),
  };
}
