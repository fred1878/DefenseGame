import { describe, expect, it } from "vitest";
import { createNewSave } from "../core/GameState";
import { talentFixture } from "../test/talentFixture";
import {
  canLearn,
  canResetTalents,
  pointsAvailable,
} from "../talents/talentLogic";
import {
  debugInfiniteGold,
  hasEnoughGold,
  setDebugInfiniteGold,
  setDebugInfiniteTalentPoints,
} from "./debugEconomy";

function fakeRegistry(store: Record<string, unknown> = {}) {
  return {
    get: (key: string) => store[key],
    set: (key: string, value: unknown) => {
      store[key] = value;
    },
  } as Phaser.Data.DataManager;
}

describe("debugEconomy", () => {
  it("defaults infinite gold and talent debug flags to off", () => {
    const reg = fakeRegistry();
    expect(debugInfiniteGold(reg)).toBe(false);
    expect(pointsAvailable(createNewSave().talents, reg)).toBeGreaterThan(0);
  });

  it("hasEnoughGold ignores balance when infinite gold is on", () => {
    const reg = fakeRegistry();
    const save = createNewSave();
    save.gold = 0;
    expect(hasEnoughGold(save, 500, reg)).toBe(false);
    setDebugInfiniteGold(reg, true);
    expect(hasEnoughGold(save, 500, reg)).toBe(true);
  });

  it("infinite talent points allow learn and reset despite low gold", () => {
    const reg = fakeRegistry();
    setDebugInfiniteTalentPoints(reg, true);
    const cat = talentFixture();
    const save = createNewSave();
    save.gold = 0;
    save.talents = { ranks: { a1: 1 }, earned: 1 };
    expect(pointsAvailable(save.talents, reg)).toBeGreaterThan(1000);
    expect(canLearn(cat, save.talents, "a1", reg)).toBe(true);
    setDebugInfiniteGold(reg, true);
    expect(canResetTalents(cat, save.talents, save.gold, reg)).toBe(true);
  });
});
