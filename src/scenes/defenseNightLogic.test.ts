import { describe, expect, it } from "vitest";
import { evaluateEndlessEnd, evaluateNightEnd } from "./defenseNightLogic";

describe("evaluateNightEnd", () => {
  const base = {
    nightEnded: false,
    wallHp: 100,
    playerHp: 50,
    spawnPlanComplete: true,
    livingEnemies: 2,
  };

  it("ignores updates after night already ended", () => {
    expect(evaluateNightEnd({ ...base, nightEnded: true })).toBe(false);
  });

  it("loss when wall reaches zero", () => {
    expect(evaluateNightEnd({ ...base, wallHp: 0 })).toEqual({
      won: false,
      lossReason: "wall",
    });
  });

  it("loss when player hp reaches zero", () => {
    expect(evaluateNightEnd({ ...base, playerHp: 0 })).toEqual({
      won: false,
      lossReason: "player",
    });
  });

  it("win when spawn plan done and no living enemies", () => {
    expect(evaluateNightEnd({ ...base, livingEnemies: 0 })).toEqual({
      won: true,
    });
  });

  it("no end while enemies remain", () => {
    expect(evaluateNightEnd(base)).toBe(false);
  });

  it("no win before spawn plan completes", () => {
    expect(
      evaluateNightEnd({ ...base, spawnPlanComplete: false, livingEnemies: 0 }),
    ).toBe(false);
  });
});

describe("evaluateEndlessEnd", () => {
  const base = { nightEnded: false, playerHp: 40 };

  it("does not end when spawns are clear", () => {
    expect(evaluateEndlessEnd(base)).toBe(false);
  });

  it("ends on player death", () => {
    expect(evaluateEndlessEnd({ ...base, playerHp: 0 })).toEqual({
      reason: "player",
    });
  });

  it("does not end on player death when infinite HP is enabled", () => {
    expect(evaluateEndlessEnd({ ...base, playerHp: 0, infiniteHp: true })).toBe(
      false,
    );
  });
});
