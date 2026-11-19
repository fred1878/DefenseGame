import { describe, expect, it } from "vitest";
import { ConfigLoadError } from "./configValidation";
import { getEnemyCombatDefaults, resolveEnemyCombat } from "./enemyTuning";
import { normalizeEnemyCombatDefaults } from "./normalizeEnemyCombatDefaults";

describe("normalizeEnemyCombatDefaults", () => {
  it("rejects empty input", () => {
    expect(() => normalizeEnemyCombatDefaults({})).toThrow(ConfigLoadError);
  });

  it("accepts shipped fixture shape from boot", () => {
    const bundle = getEnemyCombatDefaults();
    expect(bundle.wall.damage).toBeGreaterThan(0);
    expect(bundle.melee.range).toBeGreaterThan(0);
  });
});

describe("resolveEnemyCombat after boot", () => {
  it("uses loaded wall damage baseline until enemy overrides", () => {
    const baseDamage = getEnemyCombatDefaults().wall.damage;
    expect(resolveEnemyCombat("meleeChaser", undefined).wall.damage).toBe(
      baseDamage,
    );
    expect(
      resolveEnemyCombat("meleeChaser", { wall: { damage: 11 } }).wall.damage,
    ).toBe(11);
  });
});