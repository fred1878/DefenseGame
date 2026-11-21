import { describe, expect, it } from "vitest";
import { pickEndlessEnemyRowAtScreen } from "./endlessModePanelPick";

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
});