import { describe, expect, it } from "vitest";
import buildingsRaw from "../../../public/data/buildings.json";
import {
  inventoryPanelCtx,
  panelSave,
  shippedShopCtx,
  shopPanelCtx,
} from "../../test/gearPanelFixture";
import { shopPerksLine, shopUpgradeInfo } from "./shopPanelLogic";

describe("shopPanelLogic", () => {
  it("describes shop levels, costs and perks", () => {
    const s = panelSave(3, 50);
    expect(shopUpgradeInfo(inventoryPanelCtx, s)).toBeNull();
    // No buildings data: no upgrades offered.
    expect(shopUpgradeInfo(shopPanelCtx("trader"), s)).toMatchObject({
      level: 0,
      maxLevel: 0,
      nextCost: null,
      next: "",
    });
    const up = shopPanelCtx("trader", true);
    const info = shopUpgradeInfo(up, s)!;
    expect(info).toMatchObject({
      level: 0,
      maxLevel: 3,
      nextCost: buildingsRaw.trader.costByLevel[0],
    });
    expect(info.rerollCost).toBe(0);
    expect(info.current).toMatch(/^\d+ items · ilvl night\+0–\d · \d+% prices/);
    expect(info.next).toMatch(/items.*reroll \d+g · \d+ requests$/);
    s.buildings.trader = 3;
    expect(shopUpgradeInfo(up, s)).toMatchObject({ nextCost: null, next: "" });
    expect(shopPerksLine(shippedShopCtx, "blacksmith", 0)).toBe("list prices");
    expect(shopPerksLine(shippedShopCtx, "blacksmith", 1)).toMatch(
      /^\d+% prices · 1 masterwork \(magic \d+\/rare \d+, ilvl night\+0\)$/,
    );
    expect(shopPerksLine(shippedShopCtx, "blacksmith", 3)).toMatch(
      /3 masterworks .* · unlocks 2 nights early$/,
    );
    expect(shopPerksLine(shippedShopCtx, "blacksmith", 2)).toMatch(
      /unlocks 1 night early$/,
    );
    expect(
      shopUpgradeInfo(shopPanelCtx("blacksmith", true), panelSave(1))!
        .rerollCost,
    ).toBe(0);
  });
});
