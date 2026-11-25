import { describe, expect, it } from "vitest";
import {
  endlessRowCenterOverlapsViewport,
  pickEndlessEnemyRowAtScreen,
  pickEndlessRowBandAtScreen,
} from "./endlessModePanelPick";

const ROSTER = ["grunt", "skirmisher", "javelineer", "archer", "boss"] as const;

function pick(
  overrides: Partial<Parameters<typeof pickEndlessEnemyRowAtScreen>[0]> & {
    screenY: number;
    screenX?: number;
  },
): string | null {
  const {
    screenX = 120,
    screenY,
    capColLeft = 400,
    listTop = 210,
    listViewportH = 6 * 74 - 11,
    listContentY = listTop,
    rowStride = 74,
    rowH = 63,
    enemyIds = ROSTER,
    topHitSlopPx = 0,
  } = { ...overrides };
  return pickEndlessEnemyRowAtScreen({
    screenX,
    screenY,
    capColLeft,
    listTop,
    listViewportH,
    listContentY,
    rowStride,
    rowH,
    enemyIds,
    topHitSlopPx,
  });
}

describe("pickEndlessEnemyRowAtScreen", () => {
  it("picks the top roster row at the top edge of the viewport", () => {
    expect(pick({ screenY: 210 })).toBe("grunt");
    expect(pick({ screenY: 210 + 10 })).toBe("grunt");
    expect(pick({ screenY: 210 + 62 })).toBe("grunt");
  });

  it("ignores cap-column taps", () => {
    expect(pick({ screenY: 230, screenX: 420 })).toBeNull();
  });

  it("still picks a row when it is partially scrolled under the top clip", () => {
    const scrollY = 20;
    const listContentY = 210 - scrollY;
    const tapY = 210 + 5;
    expect(
      pick({
        screenY: tapY,
        listContentY,
      }),
    ).toBe("grunt");
  });

  it("respects top hit slop for expanded viewport taps", () => {
    expect(pick({ screenY: 206, topHitSlopPx: 8 })).toBe("grunt");
    expect(pick({ screenY: 201, topHitSlopPx: 8 })).toBeNull();
  });

  it("rejects taps in row gaps and outside the visible band", () => {
    expect(pick({ screenY: 210 + 64 })).toBeNull();
    const listViewportH = 6 * 74 - 11;
    expect(pick({ screenY: 210 + listViewportH + 1 })).toBeNull();
  });

  it("picks rows in the lower half of the viewport", () => {
    const listTop = 210;
    expect(
      pick({
        screenY: listTop + 3 * 74 + 31,
        screenX: 200,
      }),
    ).toBe(ROSTER[3]);
    expect(
      pick({
        screenY: listTop + 4 * 74 + 31,
        screenX: 200,
      }),
    ).toBe(ROSTER[4]);
  });
});

describe("pickEndlessRowBandAtScreen", () => {
  it("includes cap-column taps on the same row band", () => {
    const listLeft = 46;
    const rowW = 448;
    expect(
      pickEndlessRowBandAtScreen({
        screenX: 420,
        screenY: 230,
        listLeft,
        rowW,
        listTop: 210,
        listViewportH: 6 * 74 - 11,
        listContentY: 210,
        rowStride: 74,
        rowH: 63,
        enemyIds: ROSTER,
      }),
    ).toBe("grunt");
  });

  it("still rejects horizontal misses outside the roster width", () => {
    expect(
      pickEndlessRowBandAtScreen({
        screenX: 10,
        screenY: 230,
        listLeft: 46,
        rowW: 448,
        listTop: 210,
        listViewportH: 6 * 74 - 11,
        listContentY: 210,
        rowStride: 74,
        rowH: 63,
        enemyIds: ROSTER,
      }),
    ).toBeNull();
  });
});

describe("endlessRowCenterOverlapsViewport", () => {
  const base = {
    listTop: 210,
    listViewportH: 6 * 74 - 11,
    rowH: 63,
  };

  it("rejects rows entirely above or below the viewport", () => {
    expect(
      endlessRowCenterOverlapsViewport({
        ...base,
        listContentY: 210,
        rowCenterY: 31.5 - 200,
      }),
    ).toBe(false);
    expect(
      endlessRowCenterOverlapsViewport({
        ...base,
        listContentY: 210 - 500,
        rowCenterY: 4 * 74 + 31.5,
      }),
    ).toBe(false);
  });

  it("accepts rows that intersect the viewport band", () => {
    expect(
      endlessRowCenterOverlapsViewport({
        ...base,
        listContentY: 210,
        rowCenterY: 31.5,
      }),
    ).toBe(true);
    expect(
      endlessRowCenterOverlapsViewport({
        ...base,
        listContentY: 190,
        rowCenterY: 15,
      }),
    ).toBe(true);
  });
});
