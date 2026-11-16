import { describe, expect, it } from "vitest";
import { EnemySpellStatusMap } from "./enemySpellStatus";

describe("EnemySpellStatusMap", () => {
  it("applies slow multiplier while slow is active", () => {
    const m = new EnemySpellStatusMap();
    m.applySlow("e1", 0.4, 1000);
    expect(m.moveSpeedMultiplier("e1")).toBeCloseTo(0.6);
    m.tick(500);
    expect(m.moveSpeedMultiplier("e1")).toBeCloseTo(0.6);
    m.tick(600);
    expect(m.moveSpeedMultiplier("e1")).toBe(1);
  });
});