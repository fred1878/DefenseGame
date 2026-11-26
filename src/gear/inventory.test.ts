import { describe, expect, it } from "vitest";
import { gearFixture } from "../test/gearFixture";
import {
  addItem,
  bagItems,
  equipItem,
  equippedSlotOf,
  findItem,
  nextSortMode,
  removeItem,
  sortItems,
  targetSlotFor,
  unequipSlot,
} from "./inventory";
import type { ItemInstance, SaveGear } from "./gearTypes";
import { createEmptyGear } from "./saveGear";

const catalog = gearFixture();

function item(
  uid: number,
  baseId: string,
  extra: Partial<ItemInstance> = {},
): ItemInstance {
  return { uid, baseId, rarity: "common", itemLevel: 1, affixes: [], ...extra };
}

function gearOf(
  items: ItemInstance[],
  equipped: SaveGear["equipped"] = {},
): SaveGear {
  return { items, equipped, nextUid: items.length + 1 };
}

describe("inventory", () => {
  it("adds items with increasing uids and lists the bag", () => {
    let g = createEmptyGear();
    const a = addItem(g, {
      baseId: "cap",
      rarity: "common",
      itemLevel: 1,
      affixes: [],
    });
    g = a.gear;
    const b = addItem(g, {
      baseId: "band",
      rarity: "magic",
      itemLevel: 2,
      affixes: [],
    });
    g = b.gear;
    expect([a.uid, b.uid]).toEqual([1, 2]);
    expect(g.nextUid).toBe(3);
    expect(findItem(g, 2)?.baseId).toBe("band");
    expect(findItem(g, 9)).toBeUndefined();
    g = equipItem(catalog, g, 1);
    expect(equippedSlotOf(g, 1)).toBe("helm");
    expect(bagItems(g).map((i) => i.uid)).toEqual([2]);
  });

  it("fills empty ring slots first, then swaps the first slot", () => {
    let g = gearOf([item(1, "band"), item(2, "band"), item(3, "band")]);
    g = equipItem(catalog, g, 1);
    g = equipItem(catalog, g, 2);
    expect(g.equipped).toEqual({ ring1: 1, ring2: 2 });
    expect(targetSlotFor(catalog, g, item(3, "band"))).toBe("ring1");
    g = equipItem(catalog, g, 3);
    expect(g.equipped).toEqual({ ring1: 3, ring2: 2 });
    expect(bagItems(g).map((i) => i.uid)).toEqual([1]);
    // Explicit slot moves an equipped ring.
    g = equipItem(catalog, g, 3, "ring2");
    expect(g.equipped).toEqual({ ring2: 3 });
    expect(targetSlotFor(catalog, g, findItem(g, 3)!)).toBe("ring2");
  });

  it("ignores unknown items, bases and wrong slots", () => {
    const g = gearOf([item(1, "cap"), item(2, "ghost")]);
    expect(equipItem(catalog, g, 99)).toBe(g);
    expect(equipItem(catalog, g, 2)).toBe(g);
    expect(equipItem(catalog, g, 1, "boots")).toBe(g);
    expect(targetSlotFor(catalog, g, item(2, "ghost"))).toBeUndefined();
  });

  it("unequips and removes items", () => {
    let g = gearOf([item(1, "cap"), item(2, "blade")], {
      helm: 1,
      meleeWeapon: 2,
    });
    expect(unequipSlot(g, "boots")).toBe(g);
    g = unequipSlot(g, "helm");
    expect(g.equipped).toEqual({ meleeWeapon: 2 });
    g = removeItem(g, 2);
    expect(g.items.map((i) => i.uid)).toEqual([1]);
    expect(g.equipped).toEqual({});
    expect(removeItem(g, 1).items).toEqual([]);
  });

  it("cycles sort modes and sorts by slot, rarity, value and level", () => {
    expect(nextSortMode("slot")).toBe("rarity");
    expect(nextSortMode("level")).toBe("slot");
    const items = [
      item(1, "cap", { itemLevel: 3 }),
      item(2, "blade", { rarity: "magic" }),
      item(3, "band", { rarity: "rare", itemLevel: 2 }),
      item(4, "ghost"),
      item(5, "cap", { itemLevel: 3 }),
    ];
    const ids = (mode: Parameters<typeof sortItems>[2]) =>
      sortItems(catalog, items, mode).map((r) => r.item.uid);
    expect(ids("slot")).toEqual([2, 1, 5, 3]);
    expect(ids("rarity")).toEqual([3, 2, 1, 5]);
    expect(ids("value")[0]).toBe(3);
    expect(ids("level")).toEqual([1, 5, 3, 2]);
  });
});
