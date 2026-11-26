import { describe, expect, it, vi } from "vitest";
import consumablesRaw from "../../public/data/consumables.json";
import itemsRaw from "../../public/data/items.json";
import lootRaw from "../../public/data/loot.json";
import buildingsRaw from "../../public/data/buildings.json";
import shopsRaw from "../../public/data/shops.json";
import { createNewSave } from "../core/GameState";
import { normalizeConsumables } from "../core/normalizeConsumables";
import { normalizeItems } from "../core/normalizeItems";
import { normalizeLoot } from "../core/normalizeLoot";
import { normalizeShops } from "../core/normalizeShops";
import type { SaveGame } from "../core/saveTypes";
import { createRng } from "../gear/rng";
import type { ShopContext, ShopId } from "../gear/shops";
import { fakeEventData, fakePointer } from "../test/fakeInput";
import { asScene, fakeScene, type FakeGameObject } from "../test/fakeScene";
import { GearPanel } from "./GearPanel";

type Btn = { container: FakeGameObject };
type Internals = {
  rows: Array<{
    bg: FakeGameObject;
    name: FakeGameObject;
    meta: FakeGameObject;
    key: number | null;
  }>;
  shopTab: Btn;
  bagTab: Btn;
  buyBtn: Btn;
  sellBtn: Btn;
  sortBtn: Btn;
  nextBtn: Btn;
  upgradeBtn: Btn & { label?: string };
  rerollBtn: Btn;
  titleText: FakeGameObject;
  detailName: FakeGameObject;
  detailText: FakeGameObject;
  statusText: FakeGameObject;
  summaryText: FakeGameObject;
};

const catalog = normalizeItems(itemsRaw);
const loot = normalizeLoot(lootRaw);
const shopCtx: ShopContext = {
  catalog,
  consumables: normalizeConsumables(consumablesRaw),
  shops: normalizeShops(shopsRaw),
  loot,
};

const textOf = (t: FakeGameObject) => (t.last("setText")?.[0] as string) ?? "";

function open(
  id: ShopId,
  init: (s: SaveGame) => void = () => {},
  withUpgrades = false,
) {
  const scene = fakeScene();
  let save: SaveGame = createNewSave();
  save.gold = 500;
  init(save);
  const onChange = vi.fn((next: SaveGame) => {
    save = next;
  });
  const panel = new GearPanel(asScene(scene), () => save, onChange, undefined, {
    catalog,
    loot,
    shop: withUpgrades
      ? { id, ctx: shopCtx, buildings: buildingsRaw, rng: createRng(4) }
      : { id, ctx: shopCtx },
  });
  const ui = panel as unknown as Internals;
  const tap = (c: FakeGameObject) => {
    c.emit("pointerdown", fakePointer(0, 0, 1), 0, 0, fakeEventData());
    scene.input.hitTestPointer.mockReturnValueOnce([c]);
    scene.input.emit("pointerup", fakePointer(0, 0, 1));
  };
  return { panel, ui, tap, onChange, getSave: () => save };
}

describe("GearPanel shop mode", () => {
  it("opens the blacksmith on the shop tab and buys a potion", () => {
    const { ui, tap, getSave, panel } = open("blacksmith");
    expect(textOf(ui.detailText)).toMatch(
      /^More stock unlocks at night 2\.\nNow: list prices$/,
    );
    expect(panel.e2eTapTargets()["gear-buy"]).toBeUndefined();
    expect(panel.e2eTapTargets()["gear-tab-shop"]).toBeTruthy();
    tap(ui.nextBtn.container);
    const potRow = ui.rows.find(
      (r) => textOf(r.name) === "Minor Healing Potion",
    )!;
    potRow.bg.emit("pointerup");
    expect(textOf(ui.detailName)).toBe("Minor Healing Potion");
    expect(panel.e2eTapTargets()["gear-buy"]).toBeTruthy();
    tap(ui.buyBtn.container);
    expect(getSave().consumables.minor_healing_potion).toBe(1);
    expect(getSave().gold).toBe(480);
    expect(textOf(ui.statusText)).toBe("Bought Minor Healing Potion for 20g");
    expect(textOf(ui.summaryText)).toMatch(/Carrying: Minor Healing Potion ×1/);
  });

  it("buys an item, then sells it from the bag tab", () => {
    const { ui, tap, getSave } = open("blacksmith");
    ui.rows[0]!.bg.emit("pointerup");
    tap(ui.buyBtn.container);
    expect(getSave().gear.items).toHaveLength(1);
    tap(ui.bagTab.container);
    expect(ui.sortBtn.container.visible).toBe(true);
    ui.rows[0]!.bg.emit("pointerup");
    tap(ui.sellBtn.container);
    expect(getSave().gear.items).toHaveLength(0);
    tap(ui.shopTab.container);
    expect(ui.buyBtn.container.visible).toBe(true);
  });

  it("shows the trader hint and a sold-out list", () => {
    const { ui } = open("trader", (s) => {
      s.shops = { trader: [], blacksmith: [] };
    });
    expect(textOf(ui.detailText)).toMatch(
      /^Stock changes after every night\.\nNow: 6 items/,
    );
    expect(textOf(ui.rows[0]!.name)).toMatch(/Sold out/);
  });

  it("reports a fully unlocked blacksmith", () => {
    const { ui } = open("blacksmith", (s) => {
      s.night = 99;
    });
    expect(textOf(ui.detailText)).toMatch(/^Full catalogue unlocked\./);
  });

  it("shows the shop level, buys upgrades and rerolls the trader", () => {
    const { ui, tap, getSave, panel } = open(
      "trader",
      (s) => {
        s.gold = 1000;
        s.shops = { trader: [], blacksmith: [] };
      },
      true,
    );
    expect(textOf(ui.titleText)).toBe("Trader · L0/3");
    expect(ui.rerollBtn.container.visible).toBe(false);
    expect(textOf(ui.detailText)).toMatch(/Next \(90g\): 7 items/);
    tap(ui.upgradeBtn.container);
    expect(getSave().buildings.trader).toBe(1);
    expect(getSave().gold).toBe(910);
    // Upgrading restocks at the new level (7 items + consumables).
    expect(
      getSave().shops.trader!.filter((o) => o.kind === "item"),
    ).toHaveLength(7);
    expect(textOf(ui.titleText)).toBe("Trader · L1/3");
    expect(textOf(ui.statusText)).toBe("Upgraded to L1");
    expect(panel.e2eTapTargets()["gear-reroll"]).toBeTruthy();
    const before = getSave().shops.trader;
    tap(ui.rerollBtn.container);
    expect(getSave().gold).toBe(880);
    expect(getSave().shops.trader).not.toBe(before);
    expect(textOf(ui.statusText)).toBe("New stock for 30g");
    tap(ui.upgradeBtn.container);
    tap(ui.upgradeBtn.container);
    expect(getSave().buildings.trader).toBe(3);
    expect(panel.e2eTapTargets()["gear-upgrade"]).toBeUndefined();
    expect(textOf(ui.detailText)).not.toMatch(/Next/);
  });

  it("upgrades the blacksmith with masterwork stock", () => {
    const { ui, tap, getSave } = open(
      "blacksmith",
      (s) => {
        s.gold = 100;
        s.night = 4;
      },
      true,
    );
    tap(ui.upgradeBtn.container);
    expect(getSave().buildings.blacksmith).toBe(1);
    expect(getSave().shops.blacksmith).toHaveLength(1);
    expect(textOf(ui.rows[0]!.meta)).toMatch(/1 left$/);
    tap(ui.upgradeBtn.container);
    expect(textOf(ui.statusText)).toBe("Need 180g (have 0g)");
  });
});
