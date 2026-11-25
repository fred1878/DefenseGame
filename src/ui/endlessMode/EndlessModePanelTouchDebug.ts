import type Phaser from "phaser";
import { scaleUiX, scaleUiY } from "../../core/displayScale";
import type { ScreenRect } from "../screenLayout";
import { interactiveObjectScreenRect } from "../touchButton";
import { endlessRowCenterOverlapsViewport } from "../endlessModePanelPick";
import type { createTouchButton } from "../touchButton";
import type { EndlessListLayout, EnemyRow } from "./EndlessModePanelBuild";
import type { EndlessModePanelScroll } from "./EndlessModePanelScroll";

const CAP_BTN_W = () => scaleUiX(28);
const CAP_BTN_H = () => scaleUiY(30);

export type EndlessModeTouchDebugInput = {
  layout: EndlessListLayout;
  scroll: EndlessModePanelScroll;
  rows: readonly EnemyRow[];
  listViewport: Phaser.GameObjects.Rectangle;
  scrollTrack: Phaser.GameObjects.Rectangle;
  scrollThumb: Phaser.GameObjects.Rectangle;
  infiniteHpBg: Phaser.GameObjects.GameObject;
  startBtn: ReturnType<typeof createTouchButton> | null;
  closeBtn: ReturnType<typeof createTouchButton> | null;
};

/** Endless-only touch debug outlines derived from panel layout (not wave planner geometry). */
export function collectEndlessModeTouchDebugScreenRects(
  input: EndlessModeTouchDebugInput,
): ScreenRect[] {
  const { layout, scroll, rows } = input;
  const out: ScreenRect[] = [];

  const viewportRect = interactiveObjectScreenRect(input.listViewport);
  if (viewportRect) out.push(viewportRect);
  else {
    out.push({
      x: layout.listLeft,
      y: layout.listTop,
      width: layout.rowW,
      height: layout.listViewportH,
    });
  }

  const listContentY = layout.listTop - scroll.scrollY;
  for (const row of rows) {
    const overlaps = endlessRowCenterOverlapsViewport({
      listTop: layout.listTop,
      listViewportH: layout.listViewportH,
      listContentY,
      rowCenterY: row.bg.y,
      rowH: layout.rowH,
    });
    if (!overlaps) continue;

    const cy = listContentY + row.bg.y;
    out.push({
      x: layout.listLeft,
      y: cy - layout.rowH / 2,
      width: layout.nameColW,
      height: layout.rowH,
    });
    out.push({
      x: layout.capColLeft,
      y: cy - layout.rowH / 2,
      width: layout.capColW,
      height: layout.rowH,
    });
    const btnW = CAP_BTN_W();
    const btnH = CAP_BTN_H();
    const minus = scroll.capControlCenter(row, "minus");
    const plus = scroll.capControlCenter(row, "plus");
    if (minus) {
      out.push({
        x: minus.x - btnW / 2,
        y: minus.y - btnH / 2,
        width: btnW,
        height: btnH,
      });
    }
    if (plus) {
      out.push({
        x: plus.x - btnW / 2,
        y: plus.y - btnH / 2,
        width: btnW,
        height: btnH,
      });
    }
  }

  for (const extra of [
    input.scrollTrack,
    input.scrollThumb,
    input.infiniteHpBg,
    input.startBtn?.container,
    input.closeBtn?.container,
  ]) {
    if (!extra) continue;
    const r = interactiveObjectScreenRect(extra);
    if (r) out.push(r);
  }

  return out;
}