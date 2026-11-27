import { beforeEach, describe, expect, it } from "vitest";
import {
  castTally,
  combatTally,
  recordCombatDamage,
  recordPlayerHealed,
  recordSpellCast,
  resetCombatTally,
} from "./combatTally";

describe("combatTally", () => {
  beforeEach(() => resetCombatTally());

  it("sums damage and hits by flavor, physical by default", () => {
    recordCombatDamage("fire", 10);
    recordCombatDamage("fire", 5);
    recordCombatDamage(undefined, 3);
    recordCombatDamage("frost", 0);
    recordCombatDamage("frost", Number.NaN);
    const t = combatTally();
    expect(t).toEqual({
      fire: { damage: 15, hits: 2 },
      physical: { damage: 3, hits: 1 },
    });
    t.fire!.damage = 0;
    expect(combatTally().fire!.damage).toBe(15);
    resetCombatTally();
    expect(combatTally()).toEqual({});
  });

  it("counts casts per spell and HP healed", () => {
    recordSpellCast("heal");
    recordSpellCast("heal");
    recordSpellCast("fire_bolt");
    recordPlayerHealed(12);
    recordPlayerHealed(-4);
    const t = castTally();
    expect(t).toEqual({ casts: { heal: 2, fire_bolt: 1 }, healed: 12 });
    t.casts.heal = 0;
    expect(castTally().casts.heal).toBe(2);
    resetCombatTally();
    expect(castTally()).toEqual({ casts: {}, healed: 0 });
  });
});
