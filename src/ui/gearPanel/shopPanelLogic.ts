import {
  consumableCount,
  consumableEffectLine,
  getConsumablesConfig,
} from "../../gear/consumables";
import {
  diffGear,
  itemDetailLines,
  SLOT_LABELS,
  type StatDiff,
} from "../../gear/gearText";
import { addItem, equipItem, targetSlotFor } from "../../gear/inventory";
import type { ItemDraft } from "../../gear/itemGen";
import { resolveItem } from "../../gear/itemStats";
import {
  blacksmithAt,
  offerPrice,
  shopLevel,
  shopMaxLevel,
  shopOffers,
  traderAt,
  type ShopContext,
  type ShopId,
  type ShopOffer,
} from "../../gear/shops";
import type { SaveGame } from "../../core/saveTypes";
import type { GearPanelContext } from "./gearPanelLogic";

export type PanelRow = {
  /** Bag: item uid. Shop: offer index. */
  key: number;
  name: string;
  color: string;
  meta: string;
};

export type OfferDetail = {
  name: string;
  color: string;
  lines: string[];
  diffs: StatDiff[];
  diffTitle: string;
  price: number | null;
  soldOut: boolean;
};

const CONSUMABLE_COLOR = "#fde68a";

function stockLabel(offer: ShopOffer): string {
  return offer.qty === null ? "" : ` · ${offer.qty} left`;
}

/** Shop tab rows (all offers; paging is applied by the panel). */
export function shopRows(ctx: GearPanelContext, save: SaveGame): PanelRow[] {
  if (!ctx.shop) return [];
  const { id, ctx: shopCtx } = ctx.shop;
  const rows: PanelRow[] = [];
  const level = shopLevel(save, shopCtx, id);
  shopOffers(save, shopCtx, id).forEach((offer, key) => {
    const price = offerPrice(shopCtx, id, offer, level);
    if (offer.kind === "consumable") {
      const def = shopCtx.consumables.items[offer.id];
      rows.push({
        key,
        name: def?.name ?? offer.id,
        color: CONSUMABLE_COLOR,
        meta: `${def ? consumableEffectLine(def) : "Unavailable"} · ${price ?? "—"}g${stockLabel(offer)}`,
      });
      return;
    }
    const r = resolveItem(ctx.catalog, { ...offer.item, uid: 0 });
    rows.push({
      key,
      name: r?.name ?? offer.item.baseId,
      color: r?.rarity.color ?? "#71717a",
      meta: r
        ? `${r.rarity.label} · ilvl ${r.item.itemLevel} · ${slotLabel(ctx, r.item)} · ${price}g${stockLabel(offer)}`
        : "Unavailable",
    });
  });
  return rows;
}

function slotLabel(ctx: GearPanelContext, item: ItemDraft): string {
  const empty = { items: [], equipped: {}, nextUid: 1 };
  const slot = targetSlotFor(ctx.catalog, empty, { ...item, uid: 0 });
  return slot ? SLOT_LABELS[slot] : "";
}

/** Detail box + compare lines for a shop offer. */
export function offerDetail(
  ctx: GearPanelContext,
  save: SaveGame,
  index: number | null,
): OfferDetail | null {
  if (!ctx.shop || index === null) return null;
  const { id, ctx: shopCtx } = ctx.shop;
  const offer = shopOffers(save, shopCtx, id)[index];
  if (!offer) return null;
  const level = shopLevel(save, shopCtx, id);
  const price = offerPrice(shopCtx, id, offer, level);
  const soldOut = offer.qty === 0;
  if (offer.kind === "consumable") {
    const def = shopCtx.consumables.items[offer.id];
    return {
      name: def?.name ?? offer.id,
      color: CONSUMABLE_COLOR,
      lines: def
        ? [
            def.kind === "heal"
              ? "Potion · drink in combat (Q)"
              : "Bomb · throw in combat (E)",
            consumableEffectLine(def),
            `Carrying ${consumableCount(save, def.id)}/${def.maxStack}`,
          ]
        : [],
      diffs: [],
      diffTitle: "",
      price,
      soldOut,
    };
  }
  const r = resolveItem(ctx.catalog, { ...offer.item, uid: 0 });
  if (!r) return null;
  const added = addItem(save.gear, offer.item);
  const diffs = diffGear(
    ctx.catalog,
    save.gear,
    equipItem(ctx.catalog, added.gear, added.uid),
  );
  return {
    name: r.name,
    color: r.rarity.color,
    lines: itemDetailLines(r),
    diffs,
    diffTitle: "If equipped:",
    price,
    soldOut,
  };
}

/** Owned potions / bombs for the panel summary. */
export function consumablesSummary(
  ctx: GearPanelContext,
  save: SaveGame,
): string {
  const items = (ctx.shop?.ctx.consumables ?? getConsumablesConfig()).items;
  const parts = Object.values(items)
    .filter((d) => consumableCount(save, d.id) > 0)
    .map((d) => `${d.name} ×${consumableCount(save, d.id)}`);
  return parts.length ? `Carrying: ${parts.join(" · ")}` : "";
}

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
