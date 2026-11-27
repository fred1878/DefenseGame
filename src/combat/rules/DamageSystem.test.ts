import { describe, expect, it, vi } from "vitest";
import {
  applyDamage,
  MELEE_HIT_FLAVOR,
  swingSpellDamageFlavor,
  type Damageable,
} from "./DamageSystem";

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
  it("reduces hp and calls onDamaged with flavor", () => {
    const onDamaged = vi.fn();
    const t = makeTarget(20);
    t.onDamaged = onDamaged;
    applyDamage(t, 5, "fire");
    expect(t.hp).toBe(15);
    expect(onDamaged).toHaveBeenCalledWith(5, "fire");
  });

  it("kills at zero hp and calls onDeath", () => {
    const onDeath = vi.fn();
    const t = makeTarget(8);
    t.onDeath = onDeath;
    applyDamage(t, 8, "physical");
    expect(t.hp).toBe(0);
    expect(t.alive).toBe(false);
    expect(onDeath).toHaveBeenCalled();
  });

  it("ignores damage when already dead", () => {
    const t = makeTarget(0);
    t.alive = false;
    applyDamage(t, 10, "frost");
    expect(t.hp).toBe(0);
  });

  it("passes explicit physical flavor to onDamaged", () => {
    const onDamaged = vi.fn();
    const t = makeTarget(20);
    t.onDamaged = onDamaged;
    applyDamage(t, 5, MELEE_HIT_FLAVOR);
    expect(onDamaged).toHaveBeenCalledWith(5, "physical");
  });
});

describe("swingSpellDamageFlavor", () => {
  it("maps missing spell flavor to melee physical", () => {
    expect(swingSpellDamageFlavor(undefined)).toBe("physical");
  });

  it("keeps explicit spell flavors", () => {
    expect(swingSpellDamageFlavor("fire")).toBe("fire");
    expect(swingSpellDamageFlavor("frost")).toBe("frost");
    expect(swingSpellDamageFlavor("water")).toBe("water");
    expect(swingSpellDamageFlavor("lightning")).toBe("lightning");
  });
});
