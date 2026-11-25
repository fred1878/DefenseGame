import { describe, expect, it } from "vitest";
import {
  getDebugFlags,
  setShowCombatRanges,
  setShowTouchInput,
  showCombatRanges,
  showTouchInput,
} from "./DebugState";

function fakeRegistry(store: Record<string, unknown> = {}): Phaser.Data.DataManager {
  return {
    get: (key: string) => store[key],
    set: (key: string, value: unknown) => {
      store[key] = value;
    },
  } as Phaser.Data.DataManager;
}

describe("DebugState", () => {
  it("defaults touch input debug off", () => {
    const reg = fakeRegistry();
    expect(getDebugFlags(reg)).toEqual({
      showHitboxes: false,
      showCombatRanges: false,
      showTouchInput: false,
      showEnemyPaths: false,
      showFpsCounter: false,
    });
  });

  it("merges legacy flags missing showTouchInput", () => {
    const reg = fakeRegistry({ debugFlags: { showHitboxes: true } });
    expect(getDebugFlags(reg).showTouchInput).toBe(false);
    expect(showTouchInput(reg)).toBe(false);
  });

  it("persists showTouchInput toggle", () => {
    const reg = fakeRegistry();
    getDebugFlags(reg);
    setShowTouchInput(reg, true);
    expect(showTouchInput(reg)).toBe(true);
  });

  it("persists showCombatRanges toggle", () => {
    const reg = fakeRegistry();
    getDebugFlags(reg);
    setShowCombatRanges(reg, true);
    expect(showCombatRanges(reg)).toBe(true);
  });
});