/** Shipped-data contexts for gear / shop panel tests. */
import buildingsRaw from "../../public/data/buildings.json";
import consumablesRaw from "../../public/data/consumables.json";
import itemsRaw from "../../public/data/items.json";
import lootRaw from "../../public/data/loot.json";
import shopsRaw from "../../public/data/shops.json";
import { createNewSave } from "../core/save/GameState";
import { normalizeConsumables } from "../core/data/normalizeConsumables";
import { normalizeItems } from "../core/data/normalizeItems";
import { normalizeLoot } from "../core/data/normalizeLoot";
import { normalizeShops } from "../core/data/normalizeShops";
import type { SaveGame } from "../core/save/saveTypes";
import type { ItemInstance } from "../gear/gearTypes";
import { createRng } from "../gear/rng";
import type { ShopContext, ShopId } from "../gear/shops";
import type { GearPanelContext } from "../ui/gearPanel/gearPanelLogic";

export const shippedCatalog = normalizeItems(itemsRaw);
export const shippedLoot = normalizeLoot(lootRaw);
export const shippedShopCtx: ShopContext = {
  catalog: shippedCatalog,
  consumables: normalizeConsumables(consumablesRaw),
  shops: normalizeShops(shopsRaw),
  loot: shippedLoot,
};

/** Shop panel context; `upgrades` adds buildings.json costs and a seeded rng. */
export function shopPanelCtx(id: ShopId, upgrades = false): GearPanelContext {
  return {
    catalog: shippedCatalog,
    loot: shippedLoot,
    shop: upgrades
      ? { id, ctx: shippedShopCtx, buildings: buildingsRaw, rng: createRng(4) }
      : { id, ctx: shippedShopCtx },
  };
}

export const inventoryPanelCtx: GearPanelContext = {
  catalog: shippedCatalog,
  loot: shippedLoot,
};

export function panelSave(
  night = 1,
  gold = 5000,
  items: ItemInstance[] = [],
  equipped = {},
): SaveGame {
  const s = createNewSave();
  s.night = night;
  s.gold = gold;
  s.gear = { items, equipped, nextUid: 500 };
  return s;
}

export const owned = (
  uid: number,
  baseId: string,
  extra: Partial<ItemInstance> = {},
): ItemInstance => ({
  uid,
  baseId,
  rarity: "common",
  itemLevel: 1,
  affixes: [],
  ...extra,
});
