import { afterEach, describe, expect, it, vi } from "vitest";
import { SPELL_BAR } from "../config";
import { spellIconTextureKey } from "../content/assets";
import { isSpellPoolSelectable } from "../content/spellPoolReadiness";
import { getSpellCatalog } from "../content/spells";
import { fakeEventData, fakePointer } from "../test/fakeInput";
import { asScene, fakeScene, type FakeGameObject } from "../test/fakeScene";
import { interactiveObjectScreenRect } from "./touchButton";
import {
  SpellBarSortPanel,
  type SpellBarSortResult,
} from "./SpellBarSortPanel";

const selectable = getSpellCatalog()
  .filter(isSpellPoolSelectable)
  .map((d) => d.id);
const notSelectable = getSpellCatalog().find((d) => !isSpellPoolSelectable(d));
const [A, B, C] = selectable as [string, string, string];
const empty = (): string[] => Array(SPELL_BAR.slotCount).fill("");

type Views = {
  slotViews: {
    frame: FakeGameObject;
    icon: FakeGameObject;
    nameLabel: FakeGameObject;
    indexLabel: FakeGameObject;
    autoBorder: FakeGameObject;
  }[];
  poolChips: {
    spellId: string;
    poolSelectable: boolean;
    frame: FakeGameObject;
  }[];
  clearAllBtn: { container: FakeGameObject };
};

function open(slots: string[] = empty(), autoCast: string[] = []) {
  const scene = fakeScene({
    textures: [A, B, C].map((id) => spellIconTextureKey(id)),
  });
  const onDone = vi.fn<(r: SpellBarSortResult) => void>();
  const panel = new SpellBarSortPanel(asScene(scene), slots, autoCast, onDone);
  const views = panel as unknown as Views;
  const targets = () => panel.e2eTapTargets();
  const at = (id: string) => {
    const t = targets()[id];
    if (!t) throw new Error(`no target ${id}`);
    return t;
  };
  const chip = (spellId: string) =>
    views.poolChips.find((c) => c.spellId === spellId)!;
  const ptr = (x: number, y: number, isDown = true) => ({
    ...fakePointer(x, y, 1),
    isDown,
  });
  /** Press a pool chip, optionally drag to (x, y), release there. */
  const poolGesture = (spellId: string, to?: { x: number; y: number }) => {
    const from = at(`spell-sort-pool-${spellId}`);
    chip(spellId).frame.emit("pointerdown", ptr(from.x, from.y));
    const end = to ?? from;
    scene.input.emit("pointermove", ptr(end.x, end.y));
    scene.input.emit("pointerup", ptr(end.x, end.y, false));
  };
  /** Press + release on a bar slot, holding for `holdMs`. */
  const slotGesture = (i: number, holdMs = 0) => {
    const now = vi.spyOn(performance, "now").mockReturnValue(1000);
    const c = at(`spell-sort-slot-${i}`);
    views.slotViews[i]!.frame.emit(
      "pointerdown",
      ptr(c.x, c.y),
      0,
      0,
      fakeEventData(),
    );
    now.mockReturnValue(1000 + holdMs);
    scene.input.emit("pointerup", ptr(c.x, c.y, false));
    now.mockRestore();
  };
  /** Real tap on a touch button container (press + release on it). */
  const tapButton = (btn: { container: FakeGameObject }) => {
    const r = interactiveObjectScreenRect(asGo(btn.container))!;
    const p = ptr(r.x + r.width / 2, r.y + r.height / 2);
    btn.container.emit("pointerdown", p, 0, 0, fakeEventData());
    scene.input.emit("pointerup", { ...p, isDown: false });
  };
  const done = () => {
    const container = scene.created.find(
      (o) =>
        o.kind === "container" &&
        (o.list as FakeGameObject[] | undefined)?.some(
          (c) => c.kind === "text" && c.args[2] === "Done",
        ),
    )!;
    tapButton({ container });
    return onDone.mock.calls[0]![0];
  };
  return {
    scene,
    panel,
    views,
    onDone,
    poolGesture,
    slotGesture,
    at,
    chip,
    done,
    tapButton,
  };
}

const asGo = (o: FakeGameObject) =>
  o as unknown as Parameters<typeof interactiveObjectScreenRect>[0];

afterEach(() => vi.restoreAllMocks());

describe("SpellBarSortPanel", () => {
  it("pads short bars to the slot count and labels empty slots by index", () => {
    const { panel, views } = open([A]);
    expect(panel.e2eBarSlots()).toEqual([A, ...empty().slice(1)]);
    expect(views.slotViews[0]!.nameLabel.visible).toBe(true);
    expect(views.slotViews[0]!.indexLabel.visible).toBe(false);
    expect(views.slotViews[0]!.icon.visible).toBe(true);
    expect(views.slotViews[1]!.indexLabel.visible).toBe(true);
    expect(views.slotViews[1]!.indexLabel.last("setText")).toEqual(["2"]);
  });

  it("tapping a pool spell adds it to the first empty slot, tapping again removes it", () => {
    const { panel, poolGesture } = open([A]);
    poolGesture(B);
    expect(panel.e2eBarSlots().slice(0, 2)).toEqual([A, B]);
    poolGesture(B);
    expect(panel.e2eBarSlots()).not.toContain(B);
  });

  it("dragging a pool spell onto a filled slot replaces it and re-homes the displaced spell", () => {
    const { panel, poolGesture, at, scene } = open([A]);
    poolGesture(B, at("spell-sort-slot-0"));
    const bar = panel.e2eBarSlots();
    expect(bar[0]).toBe(B);
    expect(bar[1]).toBe(A);
    // the drag ghost is gone after the drop
    const ghosts = scene.created.filter(
      (o) => o.kind === "container" && o.destroyed,
    );
    expect(ghosts.length).toBeGreaterThan(0);
  });

  it("dragging a spell already on the bar moves it instead of duplicating it", () => {
    const { panel, poolGesture, at } = open([A, B]);
    poolGesture(A, at("spell-sort-slot-3"));
    const bar = panel.e2eBarSlots();
    expect(bar.filter((s) => s === A)).toHaveLength(1);
    expect(bar[3]).toBe(A);
    expect(bar[0]).toBe("");
  });

  it("dropping a drag outside every slot cancels it", () => {
    const { panel, poolGesture } = open([A]);
    poolGesture(B, { x: 2, y: 1190 });
    expect(panel.e2eBarSlots()).toEqual([A, ...empty().slice(1)]);
  });

  it("tapping a filled slot clears it; long-pressing toggles auto-cast", () => {
    const { panel, views, slotGesture, done } = open([A, B], []);
    slotGesture(1, SPELL_BAR.longPressMs + 50);
    expect(views.slotViews[1]!.autoBorder.visible).toBe(true);
    slotGesture(0);
    expect(panel.e2eBarSlots()[0]).toBe("");
    const result = done();
    expect(result.autoCastSpellIds).toEqual([B]);
    expect(result.slots.slice(0, 2)).toEqual(["", B]);
  });

  it("long-pressing an empty slot does nothing", () => {
    const { views, slotGesture } = open();
    slotGesture(0, SPELL_BAR.longPressMs + 50);
    expect(views.slotViews[0]!.autoBorder.visible).toBe(false);
  });

  it("removing an auto-cast spell from the bar prunes it from auto-cast", () => {
    const { poolGesture, done } = open([A], [A]);
    poolGesture(A);
    expect(done().autoCastSpellIds).toEqual([]);
  });

  it("Clear all empties the bar and prunes auto-cast", () => {
    const { views, panel, done, tapButton } = open([A, B], [A]);
    tapButton(views.clearAllBtn);
    expect(panel.e2eBarSlots()).toEqual(empty());
    expect(views.slotViews[0]!.autoBorder.visible).toBe(false);
    expect(done()).toEqual({ slots: empty(), autoCastSpellIds: [] });
  });

  it("finishing reports once, destroys the panel and detaches scene listeners", () => {
    const { scene, onDone, done, poolGesture, panel } = open([A]);
    done();
    expect(onDone).toHaveBeenCalledTimes(1);
    const before = panel.e2eBarSlots();
    poolGesture(B);
    expect(panel.e2eBarSlots()).toEqual(before);
    expect(scene.created.find((o) => o.kind === "container")!.destroyed).toBe(
      true,
    );
  });

  it("exposes e2e targets only for selectable pool spells, inside each slot rect", () => {
    const { panel, chip } = open();
    const targets = panel.e2eTapTargets();
    for (let i = 0; i < SPELL_BAR.slotCount; i++) {
      expect(targets[`spell-sort-slot-${i}`]).toBeDefined();
    }
    expect(targets["spell-sort-clear-all"]).toBeDefined();
    if (notSelectable) {
      expect(targets[`spell-sort-pool-${notSelectable.id}`]).toBeUndefined();
      expect(
        chip(notSelectable.id).frame.callsTo("setInteractive"),
      ).toHaveLength(0);
    }
    const rects = panel.e2eSlotHitRects();
    expect(rects).toHaveLength(SPELL_BAR.slotCount);
    for (const r of rects) {
      const t = targets[`spell-sort-slot-${r.index}`]!;
      expect(t.x).toBeGreaterThan(r.x);
      expect(t.x).toBeLessThan(r.x + r.width);
      expect(t.y).toBeGreaterThan(r.y);
      expect(t.y).toBeLessThan(r.y + r.height);
    }
  });
});
