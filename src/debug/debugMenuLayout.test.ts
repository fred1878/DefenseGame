import { describe, expect, it } from "vitest";
import {
  DEBUG_MENU_CLOSE_OFFSET_DEFENSE,
  debugMenuStackCenterY,
} from "./debugMenuLayout";

const noSafe = { top: 0, right: 0, bottom: 0, left: 0 };

describe("debugMenuStackCenterY", () => {
  it("keeps defense Close above the canvas bottom on the design height", () => {
    const h = 1200;
    const center = debugMenuStackCenterY(h, noSafe, true);
    const closeCenter = center + DEBUG_MENU_CLOSE_OFFSET_DEFENSE;
    expect(closeCenter).toBeLessThanOrEqual(h - 20);
  });

  it("leaves town menu centered when the shorter stack fits", () => {
    expect(debugMenuStackCenterY(1200, noSafe, false)).toBe(600);
  });

  it("respects bottom safe inset", () => {
    const h = 1200;
    const safe = { ...noSafe, bottom: 34 };
    const center = debugMenuStackCenterY(h, safe, true);
    const closeCenter = center + DEBUG_MENU_CLOSE_OFFSET_DEFENSE;
    expect(closeCenter).toBeLessThanOrEqual(h - safe.bottom - 20);
  });
});
