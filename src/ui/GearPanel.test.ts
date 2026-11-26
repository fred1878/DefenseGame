import { describe, expect, it, vi } from "vitest";
import { createNewSave } from "../core/GameState";
import { normalizeLoot } from "../core/normalizeLoot";
import type { SaveGame } from "../core/saveTypes";
import type { ItemInstance } from "../gear/gearTypes";
import { fakeEventData, fakePointer } from "../test/fakeInput";
import { asScene, fakeScene, type FakeGameObject } from "../test/fakeScene";
import { gearFixture } from "../test/gearFixture";
import { GearPanel } from "./GearPanel";

type Btn = { container: FakeGameObject };
type Internals = {
  rows: Array<{ bg: FakeGameObject; name: FakeGameObject; key: number | null }>;
  cells: Array<{ slot: string; bg: FakeGameObject; name: FakeGameObject }>;
  equipBtn: Btn;
  unequipBtn: Btn;
  sellBtn: Btn;
  sortBtn: Btn;
  nextBtn: Btn;
  closeBtn: Btn;
  detailName: FakeGameObject;
  diffLines: FakeGameObject[];
  statusText: FakeGameObject;
  bagTitle: FakeGameObject;
};

const ctx = {
  catalog: gearFixture(),
  loot: normalizeLoot({ inventoryCapacity: 10, sellBackPct: 50, tables: {} }),
};

const inst = (uid: number, baseId: string): ItemInstance => ({
  uid,
  baseId,
  rarity: "common",
  itemLevel: 1,
  affixes: [],
});

const textOf = (t: FakeGameObject) => (t.last("setText")?.[0] as string) ?? "";

function open(items: ItemInstance[], equipped = {}) {
  const scene = fakeScene();
  let save: SaveGame = createNewSave();
  save.gear = { items, equipped, nextUid: 50 };
  const onChange = vi.fn((next: SaveGame) => {
    save = next;
  });
  const onDismiss = vi.fn();
  const panel = new GearPanel(
    asScene(scene),
    () => save,
    onChange,
    onDismiss,
    ctx,
  );
  const ui = panel as unknown as Internals;
  const tap = (c: FakeGameObject) => {
    c.emit("pointerdown", fakePointer(0, 0, 1), 0, 0, fakeEventData());
    scene.input.hitTestPointer.mockReturnValueOnce([c]);
    scene.input.emit("pointerup", fakePointer(0, 0, 1));
  };
  return { panel, ui, tap, onChange, onDismiss, getSave: () => save };
}

describe("GearPanel", () => {
  it("shows an empty bag hint and 11 slots", () => {
    const { ui, panel } = open([]);
    expect(ui.cells).toHaveLength(11);
    expect(textOf(ui.rows[0]!.name)).toMatch(/Bag is empty/);
    expect(textOf(ui.detailName)).toBe("Tap an item or slot");
    const targets = panel.e2eTapTargets();
    expect(targets["gear-close"]).toBeTruthy();
    expect(targets["gear-slot-ring2"]).toBeTruthy();
    expect(targets["gear-row-0"]).toBeUndefined();
    expect(targets["gear-equip"]).toBeUndefined();
  });

  it("selects, compares, equips, unequips and sells", () => {
    const { ui, tap, onChange, getSave, panel } = open([
      inst(1, "cap"),
      inst(2, "band"),
    ]);
    expect(textOf(ui.bagTitle)).toBe("Bag 2/10");
    const capRow = ui.rows.find((r) => r.key === 1)!;
    capRow.bg.emit("pointerup");
    expect(textOf(ui.detailName)).toBe("Cap");
    expect(ui.diffLines.map(textOf)).toContain("+10 Armour");
    expect(panel.e2eTapTargets()["gear-equip"]).toBeTruthy();

    tap(ui.equipBtn.container);
    expect(onChange).toHaveBeenCalledOnce();
    expect(getSave().gear.equipped.helm).toBe(1);
    expect(textOf(ui.cells.find((c) => c.slot === "helm")!.name)).toBe("Cap");
    expect(ui.unequipBtn.container.visible).toBe(true);
    expect(textOf(ui.statusText)).toBe("Equipped Cap");

    tap(ui.unequipBtn.container);
    expect(getSave().gear.equipped.helm).toBeUndefined();

    ui.cells.find((c) => c.slot === "boots")!.bg.emit("pointerup");
    expect(textOf(ui.detailName)).toBe("Tap an item or slot");

    ui.rows.find((r) => r.key === 2)!.bg.emit("pointerup");
    tap(ui.sellBtn.container);
    expect(getSave().gold).toBe(15);
    expect(getSave().gear.items.map((i) => i.uid)).toEqual([1]);

    tap(ui.sortBtn.container);
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it("shows 'No stat change' for an identical item and pages long bags", () => {
    const items = Array.from({ length: 8 }, (_, i) => inst(i + 1, "cap"));
    const { ui, tap, panel } = open(items, { helm: 1 });
    ui.rows[0]!.bg.emit("pointerup");
    expect(textOf(ui.diffLines[0]!)).toBe("No stat change");
    expect(panel.e2eTapTargets()["gear-next"]).toBeTruthy();
    tap(ui.nextBtn.container);
    expect(ui.rows.filter((r) => r.key !== null)).toHaveLength(1);
    // Rows without an item ignore taps.
    ui.rows[3]!.bg.emit("pointerup");
  });

  it("closes once and notifies the host", () => {
    const { ui, tap, onDismiss, panel } = open([]);
    tap(ui.closeBtn.container);
    panel.destroy();
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("defaults to the shipped catalog and loot config", () => {
    const scene = fakeScene();
    const panel = new GearPanel(asScene(scene), () => createNewSave(), vi.fn());
    expect(panel.e2eTapTargets()["gear-close"]).toBeTruthy();
    panel.destroy();
  });
});
