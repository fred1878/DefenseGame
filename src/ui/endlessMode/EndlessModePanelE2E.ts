import { GAME } from "../../config";
import { interactiveObjectScreenRect, type createTouchButton } from "../touchButton";
import {
  MAX_VISIBLE_ROWS,
  type EndlessListLayout,
  type EnemyRow,
} from "./EndlessModePanelBuild";
import type { EndlessModePanelScroll } from "./EndlessModePanelScroll";

type TouchButton = ReturnType<typeof createTouchButton>;

export type EndlessPanelTapTargetInput = {
  rows: readonly EnemyRow[];
  scroll: EndlessModePanelScroll;
  startBtn: TouchButton | null;
  closeBtn: TouchButton | null;
  infiniteHpRowY: number;
  challengeRatingY: number;
};

/** Screen tap points keyed by e2e test id (`endless-enemy-*`, `endless-cap-*`, `endless-start`, …). */
export function endlessPanelE2eTapTargets(
  input: EndlessPanelTapTargetInput,
): Record<string, { x: number; y: number }> {
  const out: Record<string, { x: number; y: number }> = {};
  for (const row of input.rows) {
    const center = input.scroll.rowScreenCenter(row);
    if (!center) continue;
    out[`endless-enemy-${row.enemyId}`] = center;
    const minus = input.scroll.capControlCenter(row, "minus");
    const plus = input.scroll.capControlCenter(row, "plus");
    if (minus) out[`endless-cap-minus-${row.enemyId}`] = minus;
    if (plus) out[`endless-cap-plus-${row.enemyId}`] = plus;
  }
  if (input.startBtn) {
    const r = interactiveObjectScreenRect(input.startBtn.container);
    if (r) {
      out["endless-start"] = {
        x: r.x + r.width / 2,
        y: r.y + r.height / 2,
      };
    }
  }
  if (input.closeBtn) {
    const r = interactiveObjectScreenRect(input.closeBtn.container);
    if (r) {
      out["endless-close"] = {
        x: r.x + r.width / 2,
        y: r.y + r.height / 2,
      };
    }
  }
  out["endless-infinite-hp"] = {
    x: GAME.width / 2,
    y: input.infiniteHpRowY,
  };
  out["endless-challenge-rating"] = {
    x: GAME.width / 2,
    y: input.challengeRatingY,
  };
  return out;
}

export type EndlessPanelScrollState = {
  scrollY: number;
  maxScroll: number;
  listTop: number;
  listViewportH: number;
  contentHeight: number;
  scrollbarVisible: boolean;
  maxVisibleRows: number;
};

export function endlessPanelE2eScrollState(
  scrollY: number,
  layout: EndlessListLayout,
): EndlessPanelScrollState {
  return {
    scrollY,
    maxScroll: layout.maxScroll,
    listTop: layout.listTop,
    listViewportH: layout.listViewportH,
    contentHeight: layout.contentHeight,
    scrollbarVisible: layout.maxScroll > 0,
    maxVisibleRows: MAX_VISIBLE_ROWS,
  };
}
