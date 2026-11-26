import { describe, expect, it, vi } from "vitest";
import { applyDamage, type Damageable } from "./DamageSystem";
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

  it("fires onDamaged once per DOT tick with stored flavor", () => {
    const m = new EnemySpellStatusMap();
    m.applyDot("e1", 20, 2000, "fire");
    const onDamaged = vi.fn();
    const damageable: Damageable = {
      id: "e1",
      hp: 100,
      maxHp: 100,
      alive: true,
      team: "enemy",
      onDamaged,
    };
    m.tick(250, (enemyId, amount, flavor) => {
      expect(enemyId).toBe("e1");
      applyDamage(damageable, amount, flavor);
    });
    expect(onDamaged).toHaveBeenCalledTimes(1);
    expect(onDamaged).toHaveBeenCalledWith(5, "fire");
  });

  it("clears a finished DOT after the last tick", () => {
    const m = new EnemySpellStatusMap();
    m.applyDot("e1", 20, 200, "fire");
    const hits: number[] = [];
    m.tick(250, (_id, amount) => {
      hits.push(amount);
    });
    expect(hits.length).toBeGreaterThan(0);
    expect(m.moveSpeedMultiplier("e1")).toBe(1);
  });
});
