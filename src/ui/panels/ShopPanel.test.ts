import { describe, expect, it } from "vitest";
import buildingsRaw from "../../../public/data/buildings.json";
import {
  inventoryPanelCtx,
  owned,
  panelSave,
  shopPanelCtx,
} from "../../test/gearPanelFixture";
import { openPanel } from "../../test/panelHarness";
import { ShopPanel } from "./ShopPanel";

function open(
  id: "blacksmith" | "trader",
  save = panelSave(1, 5000),
  textures?: string[],
) {
  return openPanel(
    save,
    (scene, get, change, dismiss) =>
      new ShopPanel(scene, get, change, dismiss, shopPanelCtx(id, true)),
    textures,
  );
}

describe("ShopPanel", () => {
  it("needs a shop context", () => {
    expect(() =>
      openPanel(
        panelSave(),
        (scene, get, change, dismiss) =>
          new ShopPanel(scene, get, change, dismiss, inventoryPanelCtx),
      ),
    ).toThrow(/shop context/);
  });

  it("opens the blacksmith on the Buy tab with cards, chips and locked stock", () => {
    const h = open("blacksmith");
    const ids = h.ids();
    expect(ids).toEqual(
      expect.arrayContaining([
        "shop-close",
        "shop-tab-buy",
        "shop-tab-sell",
        "shop-sort",
        "shop-chip-all",
        "shop-chip-weapons",
        "shop-card-0",
        "shop-upgrade",
      ]),
    );
    expect(ids).not.toContain("shop-buy");
    const t = h.texts().join("\n");
    expect(t).toMatch(/FORGE STOCK/);
    expect(t).toMatch(/COMING SOON/);
    expect(t).toMatch(/Unlocks night \d+/);
    expect(t).toContain(`Upgrade · ${buildingsRaw.blacksmith.costByLevel[0]}g`);
  });

  it("buys, buys & equips, filters, sorts and sells", () => {
    const h = open("blacksmith");
    h.tap("shop-card-0");
    expect(h.ids()).toEqual(
      expect.arrayContaining(["shop-buy", "shop-buyEquip"]),
    );
    h.tap("shop-buy");
    expect(h.save().gear.items).toHaveLength(1);
    h.tap("shop-buyEquip");
    const s = h.save();
    expect(s.gear.items).toHaveLength(2);
    expect(Object.values(s.gear.equipped)).toHaveLength(1);
    h.tap("shop-card-0"); // deselect
    expect(h.ids()).not.toContain("shop-buy");
    h.tap("shop-chip-armour");
    expect(h.texts().join("\n")).not.toMatch(/Sword/);
    h.tap("shop-chip-all");
    h.tap("shop-sort");
    expect(h.texts().join("\n")).toMatch(/by rarity/);
    h.tap("shop-tab-sell");
    expect(h.texts().join("\n")).toMatch(/YOUR BAG/);
    h.tap("shop-card-0");
    h.tap("shop-sell");
    expect(h.save().gear.items).toHaveLength(1);
    expect(h.texts().join("\n")).toMatch(/Bag is empty/);
    h.tap("shop-tab-buy");
    h.tap("shop-upgrade");
    expect(h.save().buildings.blacksmith).toBe(1);
    h.tap("shop-close");
    expect(h.onDismiss).toHaveBeenCalledTimes(1);
    h.panel.destroy();
    expect(h.onDismiss).toHaveBeenCalledTimes(1);
  });

  it("equips straight from the sell tab and pages a full bag", () => {
    const items = Array.from({ length: 14 }, (_, i) =>
      owned(i + 1, "leather_cap"),
    );
    const h = open("blacksmith", panelSave(1, 0, items));
    h.tap("shop-tab-sell");
    expect(h.ids()).toContain("shop-next");
    expect(h.texts().join("\n")).toMatch(/1\/2/);
    h.tap("shop-next");
    expect(h.texts().join("\n")).toMatch(/2\/2/);
    expect(h.ids()).not.toContain("shop-next");
    h.tap("shop-prev");
    h.tap("shop-card-0");
    h.tap("shop-equip");
    expect(h.save().gear.equipped.helm).toBeDefined();
  });

  it("runs the trader with reroll and sold-out stock, without icon textures", () => {
    const s = panelSave(2, 5000);
    s.buildings.trader = 1;
    s.shops.trader = [{ kind: "consumable", id: "fire_bomb", qty: 1 }];
    const h = open("trader", s, []);
    expect(h.texts().join("\n")).toMatch(/TODAY'S STOCK/);
    expect(h.ids()).toContain("shop-reroll");
    h.tap("shop-card-0");
    h.tap("shop-buy");
    expect(h.save().consumables.fire_bomb).toBe(1);
    expect(h.texts().join("\n")).toMatch(/Sold out/);
    h.tap("shop-reroll");
    expect(h.onChange).toHaveBeenCalled();
    const empty = panelSave(2, 0);
    empty.shops.trader = [];
    expect(open("trader", empty).texts().join("\n")).toMatch(
      /Sold out — new stock after the next night/,
    );
  });

  it("sells to trader requests on the Wants tab", () => {
    const s = panelSave(2, 0, [owned(1, "rusty_sword")]);
    s.shops.trader = [];
    s.shops.requests = [
      { kind: "base", baseId: "rusty_sword" },
      { kind: "type", itemType: "ring", minRarity: "magic" },
    ];
    const h = open("trader", s);
    expect(h.ids()).toContain("shop-tab-wants");
    h.tap("shop-tab-wants");
    let t = h.texts().join("\n");
    expect(t).toMatch(/TRADER WANTS/i);
    expect(t).toMatch(/Requests pay 150%/);
    expect(h.ids()).not.toContain("shop-chip-all");
    expect(h.ids()).not.toContain("shop-sort");
    expect(h.ids()).not.toContain("shop-fill");
    h.tap("shop-card-1"); // no ring in the bag: Sell stays disabled
    expect(h.ids()).not.toContain("shop-fill");
    expect(h.texts().join("\n")).toMatch(/Nothing in your bag matches/);
    h.tap("shop-card-0");
    h.tap("shop-fill");
    expect(h.save().gold).toBeGreaterThan(0);
    expect(h.save().gear.items).toHaveLength(0);
    expect(h.save().shops.requests).toHaveLength(1);
    t = h.texts().join("\n");
    expect(t).toMatch(/Trader paid \d+g/);
    const none = panelSave(2, 0);
    none.shops.trader = [];
    none.shops.requests = [];
    const e = open("trader", none);
    e.tap("shop-tab-wants");
    expect(e.texts().join("\n")).toMatch(/No requests left/);
    expect(open("blacksmith").ids()).not.toContain("shop-tab-wants");
  });
});
