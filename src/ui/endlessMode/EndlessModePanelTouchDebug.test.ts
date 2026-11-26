import { describe, expect, it, vi } from "vitest";
import * as touchButton from "../touchButton";
import type { EndlessListLayout, EnemyRow } from "./EndlessModePanelBuild";
import { collectEndlessModeTouchDebugScreenRects } from "./EndlessModePanelTouchDebug";
import type { EndlessModePanelScroll } from "./EndlessModePanelScroll";

const layout: EndlessListLayout = {
  listTop: 200,
  listViewportH: 400,
  rowH: 50,
  rowStride: 60,
  contentHeight: 500,
  maxScroll: 100,
  rowW: 400,
  nameColW: 300,
  capColW: 100,
  listLeft: 70,
  capColLeft: 370,
};

describe("collectEndlessModeTouchDebugScreenRects leftover branches", () => {
  it("falls back to layout bounds when the viewport has no rect", () => {
    const rect = vi
      .spyOn(touchButton, "interactiveObjectScreenRect")
      .mockReturnValue(null);
    const hidden = { enemyId: "offscreen", bg: { y: 10_000 } } as EnemyRow;
    const visible = { enemyId: "grunt", bg: { y: 25 } } as EnemyRow;
    const scroll = {
      scrollY: 0,
      capControlCenter: () => null,
    } as unknown as EndlessModePanelScroll;
    const out = collectEndlessModeTouchDebugScreenRects({
      layout,
      scroll,
      rows: [hidden, visible],
      listViewport: {} as never,
      scrollTrack: {} as never,
      scrollThumb: {} as never,
      infiniteHpBg: {} as never,
      startBtn: null,
      closeBtn: null,
    });
    expect(out[0]).toEqual({
      x: layout.listLeft,
      y: layout.listTop,
      width: layout.rowW,
      height: layout.listViewportH,
    });
    // Hidden row is skipped; visible row still contributes name + cap (no
    // plus/minus centers). Null start/close are skipped in the extras loop.
    expect(out.length).toBe(3);
    rect.mockRestore();
  });
});
