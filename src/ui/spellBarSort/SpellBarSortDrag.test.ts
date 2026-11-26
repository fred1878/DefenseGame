import { describe, expect, it, vi } from "vitest";
import { isSpellPoolSelectable } from "../../content/spellPoolReadiness";
import { getSpellCatalog } from "../../content/spells";
import { fakePointer } from "../../test/fakeInput";
import { fakeScene } from "../../test/fakeScene";
import { SpellBarSortDrag } from "./SpellBarSortDrag";

const selectable = getSpellCatalog().find(isSpellPoolSelectable)!;
const notSelectable = getSpellCatalog().find((d) => !isSpellPoolSelectable(d));

function make(textures: string[] = []) {
  const scene = fakeScene({ textures });
  const onDropOnSlot = vi.fn();
  const onPoolTap = vi.fn();
  const drag = new SpellBarSortDrag(scene as never, [], {
    onDropOnSlot,
    onPoolTap,
  });
  return { scene, drag, onDropOnSlot, onPoolTap };
}

describe("SpellBarSortDrag leftover branches", () => {
  it("ignores a second press, an unknown spell, and a non-selectable one", () => {
    const { drag } = make();
    drag.onPoolPointerDown(selectable.id, fakePointer(0, 0) as never);
    drag.onPoolPointerDown(selectable.id, fakePointer(1, 1) as never);
    drag.reset();
    drag.onPoolPointerDown("not-a-spell" as never, fakePointer(0, 0) as never);
    if (notSelectable) {
      drag.onPoolPointerDown(notSelectable.id, fakePointer(0, 0) as never);
    }
  });

  it("creates a ghost without an icon when the texture is missing", () => {
    const { drag, scene, onPoolTap } = make();
    drag.onPoolPointerDown(selectable.id, fakePointer(10, 10) as never);
    drag.onPointerMove(fakePointer(80, 10) as never);
    expect(scene.created.some((o) => o.kind === "container")).toBe(true);
    // Move again while a drag is already active.
    drag.onPointerMove(fakePointer(90, 12) as never);
    drag.reset();
    drag.onPointerUp(fakePointer(90, 12) as never);
    expect(onPoolTap).not.toHaveBeenCalled();
  });

  it("does not treat an over-threshold press as a tap", () => {
    const { drag, onPoolTap } = make();
    drag.onPoolPointerDown(selectable.id, fakePointer(0, 0) as never);
    const box = drag as unknown as {
      poolPress: { dragAccumPx: number } | null;
    };
    if (box.poolPress) box.poolPress.dragAccumPx = 40;
    drag.onPointerUp(fakePointer(40, 0) as never);
    expect(onPoolTap).not.toHaveBeenCalled();
  });

  it("ignores move and promote when no pool press is active", () => {
    const { drag } = make();
    expect(() =>
      drag.onPointerMove(fakePointer(10, 10) as never),
    ).not.toThrow();
    const promote = drag as unknown as {
      promotePoolPressToDrag: (pointer: unknown) => void;
    };
    expect(() =>
      promote.promotePoolPressToDrag(fakePointer(10, 10)),
    ).not.toThrow();
  });
});
