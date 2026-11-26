import { beforeEach, describe, expect, it } from "vitest";
import {
  combatTally,
  recordCombatDamage,
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
});
