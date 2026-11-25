import { describe, expect, it } from "vitest";
import { GAME } from "../config";
import { scaleUiX, scaleUiY } from "../core/displayScale";
import { LIST_VIEWPORT_TOP_HIT_SLOP_PX } from "./endlessMode/EndlessModePanelBuild";
import {
  endlessRowCenterOverlapsViewport,
  endlessRowVisibleScreenYBand,
  pickEndlessEnemyRowAtScreen,
  pickEndlessRowBandAtScreen,
} from "./endlessModePanelPick";

const ROSTER = ["grunt", "skirmisher", "javelineer", "archer", "boss"] as const;

/** Layout numbers aligned with `buildEndlessModePanelUi` at the current canvas size. */
function scaledPanelPickLayout() {
  const rowW = GAME.width - scaleUiX(48);
  const capColW = scaleUiX(96);
  const nameColW = rowW - capColW - scaleUiX(4);
  const listLeft = (GAME.width - rowW) / 2;
  const capColLeft = listLeft + nameColW + scaleUiX(4);
  const rowH = scaleUiY(44);
  const gap = scaleUiY(8);
  const rowStride = rowH + gap;
  const listTop = scaleUiY(148);
  const listViewportH = 6 * rowStride - gap;
  const topHitSlopPx = scaleUiY(LIST_VIEWPORT_TOP_HIT_SLOP_PX);
  const nameColCenterX = listLeft + nameColW / 2;
  return {
    capColLeft,
    listTop,
    listViewportH,
    listContentY: listTop,
    rowStride,
    rowH,
    topHitSlopPx,
    listLeft,
    rowW,
    nameColCenterX,
    nameColLeft: listLeft + 1,
    nameColRight: capColLeft - 1,
    capColCenterX: capColLeft + capColW / 2,
  };
}

const LAYOUT = scaledPanelPickLayout();

function pick(
  overrides: Partial<Parameters<typeof pickEndlessEnemyRowAtScreen>[0]> & {
    screenY: number;
    screenX?: number;
  },
): string | null {
  const { screenX, screenY, ...rest } = overrides;
  return pickEndlessEnemyRowAtScreen({
    capColLeft: LAYOUT.capColLeft,
    listTop: LAYOUT.listTop,
    listViewportH: LAYOUT.listViewportH,
    listContentY: LAYOUT.listContentY,
    rowStride: LAYOUT.rowStride,
    rowH: LAYOUT.rowH,
    enemyIds: ROSTER,
    topHitSlopPx: LAYOUT.topHitSlopPx,
    screenX: screenX ?? LAYOUT.nameColCenterX,
    screenY,
    ...rest,
  });
}

function rowScreenBand(index: number, listContentY = LAYOUT.listContentY) {
  return endlessRowVisibleScreenYBand({
    listTop: LAYOUT.listTop,
    listViewportH: LAYOUT.listViewportH,
    listContentY,
    rowIndex: index,
    rowStride: LAYOUT.rowStride,
    rowH: LAYOUT.rowH,
    topHitSlopPx: LAYOUT.topHitSlopPx,
  });
}

describe("pickEndlessEnemyRowAtScreen", () => {
  it("picks every roster row across full name-column X and row height", () => {
    for (let index = 0; index < ROSTER.length; index++) {
      const band = rowScreenBand(index);
      expect(band).not.toBeNull();
      const yTop = band!.top;
      const yBottom = band!.bottom;
      for (const screenY of [yTop, yBottom, (yTop + yBottom) / 2]) {
        for (const screenX of [
          LAYOUT.nameColLeft,
          LAYOUT.nameColCenterX,
          LAYOUT.nameColRight,
        ]) {
          expect(pick({ screenY, screenX })).toBe(ROSTER[index]);
        }
      }
    }
  });

  it("ignores cap-column taps", () => {
    const band = rowScreenBand(0)!;
    const midY = (band.top + band.bottom) / 2;
    expect(pick({ screenY: midY, screenX: LAYOUT.capColCenterX })).toBeNull();
  });

  it("still picks a row when it is partially scrolled under the top clip", () => {
    const scrollY = scaleUiY(12);
    const listContentY = LAYOUT.listTop - scrollY;
    const band = rowScreenBand(0, listContentY)!;
    expect(pick({ screenY: band.top, listContentY })).toBe("grunt");
    expect(pick({ screenY: band.bottom, listContentY })).toBe("grunt");
  });

  it("accepts taps in the viewport top slop on the first row", () => {
    const band = rowScreenBand(0)!;
    expect(pick({ screenY: band.top })).toBe("grunt");
    expect(
      pick({ screenY: LAYOUT.listTop - LAYOUT.topHitSlopPx - 1 }),
    ).toBeNull();
  });

  it("rejects taps in row gaps and outside the visible band", () => {
    const gapY = LAYOUT.listTop + LAYOUT.rowH + 1;
    expect(pick({ screenY: gapY })).toBeNull();
    expect(
      pick({ screenY: LAYOUT.listTop + LAYOUT.listViewportH + 1 }),
    ).toBeNull();
  });
});

describe("pickEndlessRowBandAtScreen", () => {
  it("includes cap-column taps on the same row band", () => {
    const band = rowScreenBand(0)!;
    const midY = (band.top + band.bottom) / 2;
    expect(
      pickEndlessRowBandAtScreen({
        screenX: LAYOUT.capColCenterX,
        screenY: midY,
        listLeft: LAYOUT.listLeft,
        rowW: LAYOUT.rowW,
        listTop: LAYOUT.listTop,
        listViewportH: LAYOUT.listViewportH,
        listContentY: LAYOUT.listContentY,
        rowStride: LAYOUT.rowStride,
        rowH: LAYOUT.rowH,
        enemyIds: ROSTER,
        topHitSlopPx: LAYOUT.topHitSlopPx,
      }),
    ).toBe("grunt");
  });

  it("still rejects horizontal misses outside the roster width", () => {
    const band = rowScreenBand(0)!;
    expect(
      pickEndlessRowBandAtScreen({
        screenX: 10,
        screenY: (band.top + band.bottom) / 2,
        listLeft: LAYOUT.listLeft,
        rowW: LAYOUT.rowW,
        listTop: LAYOUT.listTop,
        listViewportH: LAYOUT.listViewportH,
        listContentY: LAYOUT.listContentY,
        rowStride: LAYOUT.rowStride,
        rowH: LAYOUT.rowH,
        enemyIds: ROSTER,
      }),
    ).toBeNull();
  });

  it("sweeps Y across each row band at list left and right edges", () => {
    for (let index = 0; index < ROSTER.length; index++) {
      const band = rowScreenBand(index)!;
      const xs = [LAYOUT.listLeft + 1, LAYOUT.listLeft + LAYOUT.rowW - 1];
      for (let screenY = band.top; screenY <= band.bottom; screenY++) {
        for (const screenX of xs) {
          expect(
            pickEndlessRowBandAtScreen({
              screenX,
              screenY,
              listLeft: LAYOUT.listLeft,
              rowW: LAYOUT.rowW,
              listTop: LAYOUT.listTop,
              listViewportH: LAYOUT.listViewportH,
              listContentY: LAYOUT.listContentY,
              rowStride: LAYOUT.rowStride,
              rowH: LAYOUT.rowH,
              enemyIds: ROSTER,
              topHitSlopPx: LAYOUT.topHitSlopPx,
            }),
          ).toBe(ROSTER[index]);
        }
      }
    }
  });
});

describe("endlessRowCenterOverlapsViewport", () => {
  const base = {
    listTop: LAYOUT.listTop,
    listViewportH: LAYOUT.listViewportH,
    rowH: LAYOUT.rowH,
  };

  it("rejects rows entirely above or below the viewport", () => {
    expect(
      endlessRowCenterOverlapsViewport({
        ...base,
        listContentY: LAYOUT.listTop,
        rowCenterY: LAYOUT.rowH / 2 - 200,
      }),
    ).toBe(false);
    expect(
      endlessRowCenterOverlapsViewport({
        ...base,
        listContentY: LAYOUT.listTop - 500,
        rowCenterY: 4 * LAYOUT.rowStride + LAYOUT.rowH / 2,
      }),
    ).toBe(false);
  });

  it("accepts rows that intersect the viewport band", () => {
    expect(
      endlessRowCenterOverlapsViewport({
        ...base,
        listContentY: LAYOUT.listTop,
        rowCenterY: LAYOUT.rowH / 2,
      }),
    ).toBe(true);
    expect(
      endlessRowCenterOverlapsViewport({
        ...base,
        listContentY: LAYOUT.listTop - scaleUiY(12),
        rowCenterY: LAYOUT.rowH / 2,
      }),
    ).toBe(true);
  });
});
