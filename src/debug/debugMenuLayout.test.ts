import { describe, expect, it } from "vitest";
import {
  DEBUG_MENU_CLOSE_OFFSET_DEFENSE,
  DEBUG_MENU_CLOSE_OFFSET_TOWN,
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

  it("keeps town Close above the canvas bottom on the design height", () => {
    const h = 1200;
    const center = debugMenuStackCenterY(h, noSafe, false);
    const closeCenter = center + DEBUG_MENU_CLOSE_OFFSET_TOWN;
    expect(closeCenter).toBeLessThanOrEqual(h - 20);
  });

  it("respects bottom safe inset", () => {
    const h = 1200;
    const safe = { ...noSafe, bottom: 34 };
    const center = debugMenuStackCenterY(h, safe, true);
    const closeCenter = center + DEBUG_MENU_CLOSE_OFFSET_DEFENSE;
    expect(closeCenter).toBeLessThanOrEqual(h - safe.bottom - 20);
  });
});
