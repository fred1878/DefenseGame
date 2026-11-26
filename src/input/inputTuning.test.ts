import { describe, expect, it, vi } from "vitest";
import {
  FOCUS_SELECT_LOCK_MS,
  STICK_POST_DRAG_TAP_SUPPRESS_MS,
  VIRTUAL_STICK_DRAG_THRESHOLD_PX,
  configureSceneInput,
} from "./inputTuning";

describe("inputTuning", () => {
  it("keeps post-drag tap suppress brief", () => {
    expect(STICK_POST_DRAG_TAP_SUPPRESS_MS).toBeGreaterThan(0);
    expect(STICK_POST_DRAG_TAP_SUPPRESS_MS).toBeLessThanOrEqual(80);
  });

  it("uses a movement threshold above tap jitter", () => {
    expect(VIRTUAL_STICK_DRAG_THRESHOLD_PX).toBeGreaterThanOrEqual(18);
  });

  it("shortens focus re-tap lock vs legacy 220ms", () => {
    expect(FOCUS_SELECT_LOCK_MS).toBeLessThan(220);
  });
});

describe("configureSceneInput", () => {
  it("turns off top-only picking and the context menu", () => {
    const setTopOnly = vi.fn();
    const disableContextMenu = vi.fn();
    configureSceneInput({
      input: { setTopOnly, mouse: { disableContextMenu } },
    } as unknown as Phaser.Scene);
    expect(setTopOnly).toHaveBeenCalledWith(false);
    expect(disableContextMenu).toHaveBeenCalled();
  });

  it("skips the context menu when mouse input is missing", () => {
    const setTopOnly = vi.fn();
    configureSceneInput({
      input: { setTopOnly },
    } as unknown as Phaser.Scene);
    expect(setTopOnly).toHaveBeenCalledWith(false);
  });
});
