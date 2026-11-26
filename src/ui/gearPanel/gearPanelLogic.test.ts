import { describe, expect, it } from "vitest";
import { createNewSave } from "../../core/GameState";
import { normalizeLoot } from "../../core/normalizeLoot";
import type { ItemInstance } from "../../gear/gearTypes";
import { gearFixture } from "../../test/gearFixture";
import {
  bagRows,
  createGearPanelState,
  gearPanelActions,
  pageCount,
  reduceGearPanel,
  selectedDiff,
  visibleRows,
  type GearPanelContext,
} from "./gearPanelLogic";

const ctx: GearPanelContext = {
  catalog: gearFixture(),
  loot: normalizeLoot({ inventoryCapacity: 3, sellBackPct: 50, tables: {} }),
};

const inst = (uid: number, baseId: string): ItemInstance => ({
  uid,
  baseId,
  rarity: "common",
  itemLevel: 1,
  affixes: [],
});

function saveWith(items: ItemInstance[], equipped = {}) {
  const save = createNewSave();
  save.gold = 0;
  save.gear = { items, equipped, nextUid: 100 };
  return save;
}

describe("gearPanelLogic", () => {
  it("pages and sorts the bag", () => {
    const items = Array.from({ length: 8 }, (_, i) =>
      inst(i + 1, i % 2 ? "cap" : "band"),
    );
    const save = saveWith(items);
    let state = createGearPanelState();
    expect(pageCount(0)).toBe(1);
    expect(pageCount(bagRows(ctx, save, state).length)).toBe(2);
    expect(visibleRows(bagRows(ctx, save, state), 1)).toHaveLength(2);
    state = reduceGearPanel(ctx, save, state, { type: "page", delta: 5 }).state;
    expect(state.page).toBe(1);
    state = reduceGearPanel(ctx, save, state, {
      type: "page",
      delta: -9,
    }).state;
    expect(state.page).toBe(0);
    state = reduceGearPanel(
      ctx,
      save,
      { ...state, page: 1 },
      { type: "sort" },
    ).state;
    expect(state).toMatchObject({ sort: "rarity", page: 0 });
  });

  it("equips with a diff, unequips and sells", () => {
    let save = saveWith([inst(1, "cap"), inst(2, "cap"), inst(3, "band")], {
      helm: 1,
    });
    let state = createGearPanelState();
    expect(gearPanelActions(ctx, save, state)).toEqual({
      canEquip: false,
      canUnequip: false,
      canSell: false,
      sellPrice: 0,
    });
    expect(selectedDiff(ctx, save, state)).toEqual([]);
    // No-ops without a selection.
    for (const type of ["equip", "unequip", "sell"] as const) {
      expect(reduceGearPanel(ctx, save, state, { type }).save).toBe(save);
    }

    state = reduceGearPanel(ctx, save, state, { type: "select", uid: 3 }).state;
    expect(gearPanelActions(ctx, save, state)).toMatchObject({
      canEquip: true,
      sellPrice: 15,
    });
    expect(selectedDiff(ctx, save, state).map((d) => d.label)).toContain(
      "Spell power",
    );
    expect(reduceGearPanel(ctx, save, state, { type: "unequip" }).save).toBe(
      save,
    );
    ({ save, state } = reduceGearPanel(ctx, save, state, { type: "equip" }));
    expect(save.gear.equipped.ring1).toBe(3);
    expect(state.status).toBe("Equipped Band");
    expect(reduceGearPanel(ctx, save, state, { type: "equip" }).save).toBe(
      save,
    );
    expect(selectedDiff(ctx, save, state)).toEqual([]);

    state = reduceGearPanel(ctx, save, state, {
      type: "selectSlot",
      slot: "helm",
    }).state;
    expect(state.selectedUid).toBe(1);
    expect(gearPanelActions(ctx, save, state).canUnequip).toBe(true);
    ({ save, state } = reduceGearPanel(ctx, save, state, { type: "unequip" }));
    expect(save.gear.equipped.helm).toBeUndefined();

    state = reduceGearPanel(ctx, save, state, {
      type: "selectSlot",
      slot: "boots",
    }).state;
    expect(state.selectedUid).toBeNull();

    state = reduceGearPanel(ctx, save, state, { type: "select", uid: 2 }).state;
    ({ save, state } = reduceGearPanel(ctx, save, state, { type: "sell" }));
    expect(save.gold).toBe(5);
    expect(save.gear.items.map((i) => i.uid)).toEqual([1, 3]);
    expect(state).toMatchObject({
      selectedUid: null,
      status: "Sold Cap for 5g",
    });
  });

  it("blocks unequip when the bag is full and ignores stale selections", () => {
    const save = saveWith(
      [inst(1, "cap"), inst(2, "band"), inst(3, "band"), inst(4, "band")],
      { helm: 1 },
    );
    const state = { ...createGearPanelState(), selectedUid: 1 };
    const r = reduceGearPanel(ctx, save, state, { type: "unequip" });
    expect(r.save).toBe(save);
    expect(r.state.status).toMatch(/Bag is full/);
    const stale = { ...createGearPanelState(), selectedUid: 42 };
    expect(gearPanelActions(ctx, save, stale).canSell).toBe(false);
  });
});
