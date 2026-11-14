import { describe, expect, it } from "vitest";
import {
  FOCUS_SELECT_LOCK_MS,
  STICK_POST_DRAG_TAP_SUPPRESS_MS,
  VIRTUAL_STICK_DRAG_THRESHOLD_PX,
} from "./inputTuning";

describe("inputTuning", () => {
  it("keeps post-drag tap suppress brief", () => {
    expect(STICK_POST_DRAG_TAP_SUPPRESS_MS).toBeGreaterThan(0);
    expect(STICK_POST_DRAG_TAP_SUPPRESS_MS).toBeLessThanOrEqual(80);
  });

  it("uses a movement threshold above tap jitter", () => {
    expect(VIRTUAL_STICK_DRAG_THRESHOLD_PX).toBeGreaterThanOrEqual(14);
  });

  it("shortens focus re-tap lock vs legacy 220ms", () => {
    expect(FOCUS_SELECT_LOCK_MS).toBeLessThan(220);
  });
});