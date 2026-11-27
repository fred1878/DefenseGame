import { describe, expect, it, vi } from "vitest";
import * as touchButton from "../touch/touchButton";
import type { PoolChip, SlotView } from "./SpellBarSortPanelBuild";
import {
  spellBarSortE2eSlotHitRects,
  spellBarSortE2eTapTargets,
} from "./SpellBarSortPanelE2E";

const frame = {} as SlotView["frame"];

const slot = { frame } as SlotView;
const chip = {
  spellId: "fire_bolt",
  poolSelectable: true,
  frame,
} as PoolChip;

describe("spellBarSortE2e leftover branches", () => {
  it("skips slots, pool chips, and clear-all when they have no rect", () => {
    const rect = vi
      .spyOn(touchButton, "interactiveObjectScreenRect")
      .mockReturnValue(null);
    const clearAllBtn = { container: {} };
    expect(
      spellBarSortE2eTapTargets([slot], [chip], clearAllBtn as never),
    ).toEqual({});
    expect(spellBarSortE2eSlotHitRects([slot])).toEqual([]);
    rect.mockRestore();
  });

  it("omits clear-all when the button is missing", () => {
    const rect = vi
      .spyOn(touchButton, "interactiveObjectScreenRect")
      .mockReturnValue({ x: 0, y: 0, width: 10, height: 10 });
    const out = spellBarSortE2eTapTargets([slot], [chip], null);
    expect(out["spell-sort-slot-0"]).toEqual({ x: 5, y: 5 });
    expect(out["spell-sort-pool-fire_bolt"]).toEqual({ x: 5, y: 5 });
    expect(out["spell-sort-clear-all"]).toBeUndefined();
    rect.mockRestore();
  });
});
