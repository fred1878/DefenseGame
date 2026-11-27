import { ENEMY_BEHAVIOR_IDS } from "../../core/enemyBehaviorIds";
import { describe, expect, it } from "vitest";
import { getEnemyBehavior } from "./index";
import { meleeChaserBehavior } from "./meleeChaser";
import { wardBehavior } from "./ward";

describe("getEnemyBehavior", () => {
  it("returns the named behavior", () => {
    expect(getEnemyBehavior("ward")).toBe(wardBehavior);
    expect(getEnemyBehavior("meleeChaser")).toBe(meleeChaserBehavior);
  });

  it("has a module for every known behavior id", () => {
    for (const id of ENEMY_BEHAVIOR_IDS) {
      expect(typeof getEnemyBehavior(id)).toBe("function");
    }
  });
});
