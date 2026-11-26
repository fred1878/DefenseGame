import { describe, expect, it } from "vitest";
import consumablesRaw from "../../../public/data/consumables.json";
import itemsRaw from "../../../public/data/items.json";
import lootRaw from "../../../public/data/loot.json";
import shopsRaw from "../../../public/data/shops.json";
import { createNewSave } from "../../core/GameState";
import { normalizeConsumables } from "../../core/normalizeConsumables";
import { normalizeItems } from "../../core/normalizeItems";
import { normalizeLoot } from "../../core/normalizeLoot";
import { normalizeShops } from "../../core/normalizeShops";
import type { SaveGame } from "../../core/saveTypes";
import type { BuyRequest } from "../../gear/buyRequests";
import type { ItemInstance } from "../../gear/gearTypes";
import type { ShopContext } from "../../gear/shops";
import {
  createGearPanelState,
  reduceGearPanel,
  tabRowCount,
  type GearPanelContext,
} from "./gearPanelLogic";
import { requestDetail, requestRows } from "./requestPanelLogic";

const catalog = normalizeItems(itemsRaw);
const loot = normalizeLoot(lootRaw);
const shopCtx: ShopContext = {
  catalog,
  consumables: normalizeConsumables(consumablesRaw),
  shops: normalizeShops(shopsRaw),
  loot,
};
const trader: GearPanelContext = {
  catalog,
  loot,
  shop: { id: "trader", ctx: shopCtx },
};
const smith: GearPanelContext = {
  catalog,
  loot,
  shop: { id: "blacksmith", ctx: shopCtx },
};
const plain: GearPanelContext = { catalog, loot };

const sword = (uid: number, rarity: ItemInstance["rarity"] = "common") => ({
  uid,
  baseId: "rusty_sword",
  rarity,
  itemLevel: 1,
  affixes: [],
});

const REQUESTS: BuyRequest[] = [
  { kind: "base", baseId: "rusty_sword" },
  { kind: "type", itemType: "ring", minRarity: "rare" },
  { kind: "unique", uniqueId: Object.keys(catalog.uniques)[0]! },
];

function save(items: ItemInstance[] = [sword(1), sword(2, "magic")]): SaveGame {
  const s = createNewSave();
  s.gold = 100;
  s.gear = { items, equipped: {}, nextUid: items.length + 1 };
  s.shops = { trader: [], blacksmith: [], requests: [...REQUESTS] };
  return s;
}

describe("requestPanelLogic", () => {
  it("lists trader requests with the best bag match or a no-match hint", () => {
    const rows = requestRows(trader, save());
    expect(rows).toHaveLength(3);
    expect(rows[0]!.name).toBe("Rusty Sword");
    expect(rows[0]!.meta).toMatch(/^Pays 150% · .+ → \d+g$/);
    expect(rows[1]!.meta).toBe(
      "Any item of this type · Pays 150% · no match in bag",
    );
    expect(rows[2]!.meta).toBe("Unique · Pays 150% · no match in bag");
    // Only the trader posts requests.
    expect(requestRows(smith, save())).toEqual([]);
    expect(requestRows(plain, save())).toEqual([]);
    const none = save();
    delete none.shops.requests;
    expect(requestRows(trader, none)).toEqual([]);
  });

  it("details a request with matches and payout", () => {
    const d = requestDetail(trader, save(), 0)!;
    expect(d.payout).toBeGreaterThan(0);
    expect(d.lines[0]).toBe("The trader wants: Rusty Sword (any rarity).");
    expect(d.lines[1]).toBe("Pays 150% of the item's value for one item.");
    expect(d.lines[3]).toMatch(/^In your bag: .+\(\d+g\), .+\(\d+g\)$/);
    const miss = requestDetail(trader, save(), 2)!;
    expect(miss.payout).toBeNull();
    expect(miss.lines[0]).toMatch(/\(unique\)\.$/);
    expect(miss.lines[3]).toBe(
      "Nothing in your bag matches (equipped gear doesn't count).",
    );
    expect(requestDetail(trader, save(), null)).toBeNull();
    expect(requestDetail(trader, save(), 9)).toBeNull();
    expect(requestDetail(plain, save(), 0)).toBeNull();
  });

  it("counts request rows and fills the selected request", () => {
    const s = save();
    const state = { ...createGearPanelState(), tab: "requests" as const };
    expect(tabRowCount(trader, s, state)).toBe(3);
    expect(tabRowCount(smith, s, state)).toBe(0);
    const none = save();
    none.shops = { trader: [], blacksmith: [] };
    expect(tabRowCount(trader, none, state)).toBe(0);

    // Nothing selected / not the trader: no-op.
    expect(reduceGearPanel(trader, s, state, { type: "fillRequest" }).save).toBe(
      s,
    );
    const picked = reduceGearPanel(trader, s, state, {
      type: "selectOffer",
      index: 0,
    }).state;
    expect(
      reduceGearPanel(smith, s, picked, { type: "fillRequest" }).save,
    ).toBe(s);

    const sold = reduceGearPanel(trader, s, picked, { type: "fillRequest" });
    expect(sold.save.gold).toBeGreaterThan(100);
    expect(sold.save.shops.requests).toHaveLength(2);
    expect(sold.state.selectedOffer).toBeNull();
    expect(sold.state.status).toMatch(/^Trader paid \d+g for /);

    const miss = reduceGearPanel(trader, sold.save, picked, {
      type: "fillRequest",
    });
    expect(miss.save).toBe(sold.save);
    expect(miss.state.selectedOffer).toBe(0);
    expect(miss.state.status).toBe("No matching item in your bag");
  });
});
