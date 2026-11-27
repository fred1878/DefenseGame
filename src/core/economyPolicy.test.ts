import { describe, expect, it } from "vitest";
import { createNewSave } from "./save/GameState";
import { hasEnoughGold, spendGold } from "./economyPolicy";

describe("economyPolicy", () => {
  it("spendGold leaves balance unchanged under infinite gold", () => {
    expect(spendGold(12, 99, { infiniteGold: true })).toBe(12);
  });

  it("spendGold deducts when infinite gold is off", () => {
    const save = createNewSave();
    save.gold = 50;
    expect(spendGold(save.gold, 30)).toBe(20);
    expect(hasEnoughGold(save, 100)).toBe(false);
    expect(hasEnoughGold(save, 100, { infiniteGold: true })).toBe(true);
  });
});
