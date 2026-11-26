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
import { offerPrice, shopOffers, type ShopOffer } from "../../gear/shops";
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
  shopOffers(save, shopCtx, id).forEach((offer, key) => {
    const price = offerPrice(shopCtx, id, offer);
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
  const price = offerPrice(shopCtx, id, offer);
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
