import { describe, expect, it } from "vitest";
import { EnemySpellStatusMap } from "./enemySpellStatus";

describe("EnemySpellStatusMap", () => {
  it("tracks stun duration independently from root", () => {
    const m = new EnemySpellStatusMap();
    m.applyStun("e1", 800);
    expect(m.isStunned("e1")).toBe(true);
    expect(m.isRooted("e1")).toBe(false);
    m.tick(900);
    expect(m.isStunned("e1")).toBe(false);
  });

  it("extends stun when re-applied", () => {
    const m = new EnemySpellStatusMap();
    m.applyStun("e1", 500);
    m.applyStun("e1", 700);
    m.tick(600);
    expect(m.isStunned("e1")).toBe(true);
    m.tick(200);
    expect(m.isStunned("e1")).toBe(false);
  });

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