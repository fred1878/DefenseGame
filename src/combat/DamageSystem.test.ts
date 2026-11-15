import { describe, expect, it, vi } from "vitest";
import { applyDamage, type Damageable } from "./DamageSystem";

function makeTarget(hp = 30): Damageable {
  return {
    id: "t",
    hp,
    maxHp: hp,
    alive: true,
    team: "enemy",
  };
}

describe("applyDamage", () => {
  it("reduces hp and calls onDamaged", () => {
    const onDamaged = vi.fn();
    const t = makeTarget(20);
    t.onDamaged = onDamaged;
    applyDamage(t, 5);
    expect(t.hp).toBe(15);
    expect(onDamaged).toHaveBeenCalledWith(5, "default");
  });

  it("kills at zero hp and calls onDeath", () => {
    const onDeath = vi.fn();
    const t = makeTarget(8);
    t.onDeath = onDeath;
    applyDamage(t, 8);
    expect(t.hp).toBe(0);
    expect(t.alive).toBe(false);
    expect(onDeath).toHaveBeenCalled();
  });

  it("ignores damage when already dead", () => {
    const t = makeTarget(0);
    t.alive = false;
    applyDamage(t, 10);
    expect(t.hp).toBe(0);
  });
});