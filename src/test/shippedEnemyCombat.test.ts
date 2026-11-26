import { describe, expect, it } from "vitest";
import {
  shippedEnemyCombat,
  shippedEnemyCombatForBehavior,
} from "./shippedEnemyCombat";

describe("shippedEnemyCombat", () => {
  it("throws when the shipped row has no combat table", () => {
    expect(() => shippedEnemyCombat("not_a_real_enemy")).toThrow(
      /Missing combat/,
    );
  });

  it("falls back through behavior, def id, then grunt", () => {
    expect(shippedEnemyCombatForBehavior("meleeChaser")).toEqual(
      shippedEnemyCombat("grunt"),
    );
    expect(shippedEnemyCombatForBehavior("meleeChaser", "grunt")).toEqual(
      shippedEnemyCombat("grunt"),
    );
    expect(shippedEnemyCombatForBehavior("unknown_behavior", "lobber")).toEqual(
      shippedEnemyCombat("lobber"),
    );
    expect(shippedEnemyCombatForBehavior("unknown_behavior")).toEqual(
      shippedEnemyCombat("grunt"),
    );
  });
});
