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
import { blacksmithOffers, type ShopContext } from "../../gear/shops";
import {
  createGearPanelState,
  gearPanelActions,
  reduceGearPanel,
  tabRowCount,
  type GearPanelContext,
} from "./gearPanelLogic";
import { consumablesSummary, offerDetail, shopRows } from "./shopPanelLogic";

const catalog = normalizeItems(itemsRaw);
const loot = normalizeLoot(lootRaw);
const shopCtx: ShopContext = {
  catalog,
  consumables: normalizeConsumables(consumablesRaw),
  shops: normalizeShops(shopsRaw),
  loot,
};
const smith: GearPanelContext = {
  catalog,
  loot,
  shop: { id: "blacksmith", ctx: shopCtx },
};
const trader: GearPanelContext = {
  catalog,
  loot,
  shop: { id: "trader", ctx: shopCtx },
};
const plain: GearPanelContext = { catalog, loot };

function save(night = 1, gold = 5000): SaveGame {
  const s = createNewSave();
  s.night = night;
  s.gold = gold;
  return s;
}

describe("shopPanelLogic", () => {
  it("lists blacksmith items and consumables with prices", () => {
    const rows = shopRows(smith, save());
    expect(rows.length).toBe(blacksmithOffers(shopCtx, 1).length);
    expect(rows[0]!.meta).toMatch(/Common · ilvl 1 · .+ · \d+g$/);
    const pot = rows.find((r) => r.name === "Minor Healing Potion")!;
    expect(pot.meta).toBe("Heals 35 HP · 20g");
    expect(shopRows(plain, save())).toEqual([]);
  });

  it("shows trader stock counts and unavailable rows", () => {
    const s = save();
    const item = blacksmithOffers(shopCtx, 1)[0]!;
    if (item.kind !== "item") throw new Error("item expected");
    s.shops = {
      trader: [
        { kind: "consumable", id: "fire_bomb", qty: 2 },
        { kind: "consumable", id: "ghost", qty: 1 },
        { ...item, qty: 1 },
        { kind: "item", item: { ...item.item, baseId: "ghost" }, qty: 1 },
      ],
    };
    const rows = shopRows(trader, s);
    expect(rows[0]!.meta).toMatch(/· 2 left$/);
    expect(rows[1]!.meta).toBe("Unavailable · —g · 1 left");
    expect(rows[2]!.meta).toMatch(/1 left$/);
    expect(rows[3]).toMatchObject({ name: "ghost", meta: "Unavailable" });
    expect(offerDetail(trader, s, 1)).toMatchObject({
      name: "ghost",
      lines: [],
    });
    expect(offerDetail(trader, s, 3)).toBeNull();
  });

  it("details offers with a compare for items", () => {
    const s = save();
    const rows = blacksmithOffers(shopCtx, 1);
    const itemIdx = rows.findIndex((o) => o.kind === "item");
    const d = offerDetail(smith, s, itemIdx)!;
    expect(d.diffTitle).toBe("If equipped:");
    expect(d.diffs.length).toBeGreaterThan(0);
    expect(d.price).toBeGreaterThan(0);
    expect(d.soldOut).toBe(false);
    const potIdx = rows.findIndex((o) => o.kind === "consumable");
    expect(offerDetail(smith, s, potIdx)!.lines).toEqual([
      "Potion · drink in combat (Q)",
      "Heals 35 HP",
      "Carrying 0/5",
    ]);
    const bombs = blacksmithOffers(shopCtx, 2);
    const bombIdx = bombs.findIndex(
      (o) => o.kind === "consumable" && o.id === "fire_bomb",
    );
    expect(offerDetail(smith, save(2), bombIdx)!.lines[0]).toMatch(/Bomb/);
    expect(offerDetail(smith, s, null)).toBeNull();
    expect(offerDetail(smith, s, 999)).toBeNull();
    expect(offerDetail(plain, s, 0)).toBeNull();
  });

  it("summarises carried consumables", () => {
    const s = save();
    expect(consumablesSummary(smith, s)).toBe("");
    s.consumables = { fire_bomb: 2, minor_healing_potion: 1 };
    expect(consumablesSummary(smith, s)).toBe(
      "Carrying: Minor Healing Potion ×1 · Fire Bomb ×2",
    );
    expect(consumablesSummary(plain, s)).toMatch(/^Carrying/);
  });

  it("switches tabs, selects and buys through the reducer", () => {
    let s = save();
    let state = createGearPanelState("shop");
    expect(tabRowCount(smith, s, state)).toBe(
      blacksmithOffers(shopCtx, 1).length,
    );
    expect(tabRowCount(plain, s, state)).toBe(0);
    // Buy with nothing selected is a no-op.
    expect(reduceGearPanel(smith, s, state, { type: "buy" }).save).toBe(s);
    expect(reduceGearPanel(plain, s, state, { type: "buy" }).save).toBe(s);
    state = reduceGearPanel(smith, s, state, {
      type: "selectOffer",
      index: 0,
    }).state;
    expect(state.selectedOffer).toBe(0);
    const r = reduceGearPanel(smith, s, state, { type: "buy" });
    expect(r.state.status).toMatch(/^Bought /);
    expect(r.state.selectedOffer).toBe(0);
    s = r.save;
    expect(s.gear.items).toHaveLength(1);
    const bag = reduceGearPanel(smith, s, r.state, {
      type: "tab",
      tab: "bag",
    }).state;
    expect(bag).toMatchObject({ tab: "bag", selectedOffer: null, page: 0 });
    expect(gearPanelActions(smith, s, bag).canSell).toBe(false);
  });

  it("drops the selection when the last trader unit sells", () => {
    const s = save();
    s.shops = { trader: [{ kind: "consumable", id: "fire_bomb", qty: 1 }] };
    let state = createGearPanelState("shop");
    state = reduceGearPanel(trader, s, state, {
      type: "selectOffer",
      index: 0,
    }).state;
    const r = reduceGearPanel(trader, s, state, { type: "buy" });
    expect(r.save.shops.trader).toEqual([]);
    expect(r.state.selectedOffer).toBeNull();
  });
});
