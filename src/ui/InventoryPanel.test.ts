import { describe, expect, it } from "vitest";
import { inventoryPanelCtx, owned, panelSave } from "../test/gearPanelFixture";
import { openPanel } from "../test/panelHarness";
import { InventoryPanel } from "./InventoryPanel";

function open(save = panelSave(1, 100), textures?: string[]) {
  return openPanel(
    save,
    (scene, get, change, dismiss) =>
      new InventoryPanel(scene, get, change, dismiss, inventoryPanelCtx),
    textures,
  );
}

describe("InventoryPanel", () => {
  it("shows 11 slots, an empty bag and disabled actions", () => {
    const h = open();
    const ids = h.ids();
    expect(ids.filter((i) => i.startsWith("inv-slot-"))).toHaveLength(11);
    expect(ids.filter((i) => i.startsWith("inv-bag-"))).toEqual([]);
    expect(ids).not.toContain("inv-equip");
    expect(ids).not.toContain("inv-sell");
    expect(h.texts().join("\n")).toMatch(/Night 1 · 0\/40 items in bag/);
  });

  it("selects, equips, unequips and sells", () => {
    const h = open(
      panelSave(2, 0, [owned(1, "leather_cap"), owned(2, "iron_sword")]),
    );
    h.tap("inv-bag-0");
    expect(h.ids()).toEqual(expect.arrayContaining(["inv-equip", "inv-sell"]));
    h.tap("inv-bag-0"); // toggle off
    expect(h.ids()).not.toContain("inv-equip");
    h.tap("inv-bag-0");
    h.tap("inv-equip");
    const equipped = Object.values(h.save().gear.equipped);
    expect(equipped).toHaveLength(1);
    const slot = Object.keys(h.save().gear.equipped)[0]!;
    // Selection follows the item into its slot; tapping the slot toggles it.
    expect(h.texts().join("\n")).toMatch(/IF UNEQUIPPED/);
    h.tap(`inv-slot-${slot}`);
    expect(h.ids()).not.toContain("inv-unequip");
    h.tap(`inv-slot-${slot}`);
    h.tap("inv-unequip");
    expect(Object.values(h.save().gear.equipped)).toHaveLength(0);
    expect(h.ids()).toContain("inv-equip"); // still selected, now in the bag
    h.tap("inv-sell");
    expect(h.save().gear.items).toHaveLength(1);
    expect(h.save().gold).toBeGreaterThan(0);
    h.tap("inv-sort");
    expect(h.texts().join("\n")).toMatch(/Rarity/);
    h.tap("inv-close");
    expect(h.onDismiss).toHaveBeenCalledTimes(1);
    h.panel.destroy();
    expect(h.onDismiss).toHaveBeenCalledTimes(1);
  });

  it("pages a full bag and lists consumables, without icon textures", () => {
    const items = Array.from({ length: 25 }, (_, i) =>
      owned(i + 1, "leather_cap"),
    );
    const s = panelSave(1, 0, items);
    s.consumables = { minor_healing_potion: 2 };
    const h = open(s, []);
    expect(h.ids()).toContain("inv-next");
    h.tap("inv-next");
    expect(h.ids().filter((i) => i.startsWith("inv-bag-"))).toHaveLength(4);
    h.tap("inv-prev");
    h.tap("inv-tab-consumables");
    expect(h.ids()).not.toContain("inv-sell");
    h.tap("inv-bag-0");
    expect(h.texts().join("\n")).toMatch(/Carrying 2\//);
    h.tap("inv-tab-gear");
    expect(h.ids().filter((i) => i.startsWith("inv-bag-"))).toHaveLength(21);
  });
});
