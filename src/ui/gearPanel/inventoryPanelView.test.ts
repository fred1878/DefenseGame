import { describe, expect, it } from "vitest";
import { sellValue, resolveItem } from "../../gear/itemStats";
import {
  inventoryPanelCtx as ctx,
  owned,
  panelSave,
  shippedCatalog,
  shippedLoot,
} from "../../test/gearPanelFixture";
import { DG_THEME } from "../theme/dgTheme";
import { createGearPanelState, type GearPanelState } from "./gearPanelLogic";
import { inventoryView } from "./inventoryPanelView";

const st = (o: Partial<GearPanelState> = {}): GearPanelState => ({
  ...createGearPanelState("bag"),
  ...o,
});

describe("inventoryView", () => {
  it("lays out an empty inventory", () => {
    const v = inventoryView(ctx, panelSave(3, 77), st());
    expect(v).toMatchObject({
      title: "Inventory",
      subtitle: `Night 3 · 0/${shippedLoot.inventoryCapacity} items in bag`,
      gold: "77g",
      gearCount: "0",
      consumableCount: "0",
      heroCaption: "Hero · Night 3",
      bagLabel: `Bag · 0/${shippedLoot.inventoryCapacity}`,
      sortLabel: "Slot",
      page: 0,
      pages: 1,
      detail: null,
    });
    expect(v.slots).toHaveLength(11);
    expect(v.slots.every((s) => s.tile === null && !s.selected)).toBe(true);
    expect(v.tiles).toHaveLength(21);
    expect(v.tiles.every((t) => t.key === null)).toBe(true);
    expect(v.actions.map((a) => [a.id, a.enabled, a.label])).toEqual([
      ["equip", false, "Equip"],
      ["sell", false, "Sell"],
    ]);
    expect(v.footnote.text).toBe(
      `Tap a slot or bag item. Items sell for ${shippedLoot.sellBackPct}% of their value.`,
    );
  });

  it("selects bag items with equip + real sell value", () => {
    const sword = owned(5, "iron_sword", { rarity: "magic", itemLevel: 3 });
    const s = panelSave(2, 0, [sword, owned(6, "leather_cap")]);
    const v = inventoryView(ctx, s, st({ selectedUid: 5, sort: "value" }));
    expect(v.sortLabel).toBe("Value");
    expect(v.tiles.filter((t) => t.key !== null)).toHaveLength(2);
    expect(v.tiles.find((t) => t.key === 5)?.selected).toBe(true);
    const price = resolveItem(shippedCatalog, sword)!.price;
    expect(v.actions[1]!.label).toBe(
      `Sell · ${sellValue(price, shippedLoot.sellBackPct)}g`,
    );
    expect(v.actions[0]).toMatchObject({ id: "equip", enabled: true });
    expect(v.detail?.compareTitle).toBe("Compared with equipped");
    expect(v.detail?.info).toEqual([]);
  });

  it("shows equipped items in slots with unequip", () => {
    const s = panelSave(
      9,
      0,
      [
        owned(2, "steel_sword", {
          rarity: "legendary",
          itemLevel: 8,
          uniqueId: "emberbrand",
        }),
      ],
      { meleeWeapon: 2 },
    );
    const v = inventoryView(ctx, s, st({ selectedUid: 2 }));
    const slot = v.slots.find((x) => x.slot === "meleeWeapon")!;
    expect(slot.selected).toBe(true);
    expect(slot.tile?.color).toBe("#fb923c");
    expect(v.actions[0]).toMatchObject({ id: "unequip", enabled: true });
    expect(v.detail?.compareTitle).toBe("If unequipped");
    expect(v.gearCount).toBe("0");
    expect(v.detail?.info).toEqual([
      "“Every swing leaves the air smouldering.”",
    ]);
  });

  it("pages a big bag", () => {
    const items = Array.from({ length: 30 }, (_, i) =>
      owned(i + 1, "leather_cap"),
    );
    const s = panelSave(1, 0, items);
    const v = inventoryView(ctx, s, st({ page: 5 }));
    expect(v.pages).toBe(2);
    expect(v.page).toBe(1);
    expect(v.tiles.filter((t) => t.key !== null)).toHaveLength(9);
  });

  it("lists consumables without actions", () => {
    const s = panelSave(1);
    s.consumables = { minor_healing_potion: 3 };
    const none = inventoryView(ctx, s, st({ view: "consumables" }));
    expect(none.consumableCount).toBe("3");
    expect(none.bagLabel).toBe("Potions & bombs");
    expect(none.actions).toEqual([]);
    expect(none.detail).toBeNull();
    expect(none.footnote.text).toMatch(/^Buy potions and bombs/);
    const v = inventoryView(
      ctx,
      s,
      st({ view: "consumables", selectedConsumable: "minor_healing_potion" }),
    );
    expect(v.tiles[0]).toMatchObject({ selected: true });
    expect(v.tiles[0]!.tile?.badge).toBe("×3");
    expect(v.detail?.name).toMatch(/Potion/);
    expect(v.detail?.rows).toEqual([]);
    expect(inventoryView(ctx, s, st({ status: "Sold" })).footnote).toEqual({
      text: "Sold",
      color: DG_THEME.accentGoldBright,
    });
  });
});
