import { describe, expect, it } from "vitest";
import {
  getDebugFlags,
  setShowCombatRanges,
  setShowEnemyPaths,
  setShowFpsCounter,
  setShowHitboxes,
  setShowTouchInput,
  showCombatRanges,
  showEnemyPaths,
  showFpsCounter,
  showHitboxes,
  showTouchInput,
} from "./DebugState";

function fakeRegistry(
  store: Record<string, unknown> = {},
): Phaser.Data.DataManager {
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

describe("DebugState remaining accessors", () => {
  it("toggles hitboxes, enemy paths, and fps counter", () => {
    const reg = fakeRegistry();
    expect(showHitboxes(reg)).toBe(false);
    setShowHitboxes(reg, true);
    expect(showHitboxes(reg)).toBe(true);
    expect(showEnemyPaths(reg)).toBe(false);
    setShowEnemyPaths(reg, true);
    expect(showEnemyPaths(reg)).toBe(true);
    expect(showFpsCounter(reg)).toBe(false);
    setShowFpsCounter(reg, true);
    expect(showFpsCounter(reg)).toBe(true);
  });
});

describe("getDebugFlags leftover branches", () => {
  it("defaults a missing showHitboxes flag on a partial record", () => {
    const reg = fakeRegistry({
      debugFlags: { showCombatRanges: true },
    });
    expect(getDebugFlags(reg).showHitboxes).toBe(false);
    expect(getDebugFlags(reg).showCombatRanges).toBe(true);
  });
});
