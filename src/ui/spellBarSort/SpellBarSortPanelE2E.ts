import { interactiveObjectScreenRect, type createTouchButton } from "../touchButton";
import type { PoolChip, SlotView } from "./SpellBarSortPanelBuild";

export type SpellSortSlotHitRect = {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Slot / pool / Clear all centers in game coords (540×1200), keyed by test id. */
export function spellBarSortE2eTapTargets(
  slotViews: readonly SlotView[],
  poolChips: readonly PoolChip[],
  clearAllBtn: ReturnType<typeof createTouchButton> | null,
): Record<string, { x: number; y: number }> {
  const out: Record<string, { x: number; y: number }> = {};
  for (let i = 0; i < slotViews.length; i++) {
    const r = interactiveObjectScreenRect(slotViews[i]!.frame);
    if (!r) continue;
    out[`spell-sort-slot-${i}`] = {
      x: r.x + r.width / 2,
      y: r.y + r.height / 2,
    };
  }
  for (const chip of poolChips) {
    if (!chip.poolSelectable) continue;
    const r = interactiveObjectScreenRect(chip.frame);
    if (!r) continue;
    out[`spell-sort-pool-${chip.spellId}`] = {
      x: r.x + r.width / 2,
      y: r.y + r.height / 2,
    };
  }
  if (clearAllBtn) {
    const r = interactiveObjectScreenRect(clearAllBtn.container);
    if (r) {
      out["spell-sort-clear-all"] = {
        x: r.x + r.width / 2,
        y: r.y + r.height / 2,
      };
    }
  }
  return out;
}

export function spellBarSortE2eSlotHitRects(
  slotViews: readonly SlotView[],
): SpellSortSlotHitRect[] {
  const rects: SpellSortSlotHitRect[] = [];
  for (let i = 0; i < slotViews.length; i++) {
    const r = interactiveObjectScreenRect(slotViews[i]!.frame);
    if (!r) continue;
    rects.push({ index: i, ...r });
  }
  return rects;
}
