import { describe, expect, it } from "vitest";
import {
  CODE_ENEMY_COMBAT_DEFAULTS,
  DEFAULT_MELEE_COMBAT,
  applyEnemyCombatDefaults,
  resolveEnemyCombat,
} from "./enemyTuning";
import { normalizeEnemyCombatDefaults } from "./normalizeEnemyCombatDefaults";

describe("normalizeEnemyCombatDefaults", () => {
  it("merges partial melee onto code baseline", () => {
    const out = normalizeEnemyCombatDefaults(CODE_ENEMY_COMBAT_DEFAULTS, {
      melee: { range: 40 },
    });
    expect(out.melee.range).toBe(40);
    expect(out.melee.windupMs).toBe(DEFAULT_MELEE_COMBAT.windupMs);
  });
});

describe("applyEnemyCombatDefaults", () => {
  it("updates resolveEnemyCombat baselines", () => {
    applyEnemyCombatDefaults({ wall: { damage: 11 } });
    expect(resolveEnemyCombat("meleeChaser", undefined).wall.damage).toBe(11);
    applyEnemyCombatDefaults({});
  });
});