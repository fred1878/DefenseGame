import { describe, expect, it } from "vitest";
import { DataStore } from "../core/DataStore";
import { shippedEnemyCombat } from "../test/shippedEnemyCombat";
import { listPlayableDefenseEnemyIds } from "./endlessEnemyRoster";

describe("listPlayableDefenseEnemyIds", () => {
  it("returns sorted ids referenced by waves", () => {
    const store = new DataStore();
    store.enemies = {
      grunt: {
        hp: 1,
        speedWu: 1,
        damage: 1,
        weight: 100,
        behavior: "meleeChaser",
        textureKey: "enemy_grunt",
        displayName: "Grunt",
        challengeRating: 1,
        bodyRadiusWu: 28,
        combat: shippedEnemyCombat("grunt"),
      },
      unused: {
        hp: 1,
        speedWu: 1,
        damage: 1,
        weight: 100,
        behavior: "meleeChaser",
        textureKey: "enemy_unused",
        displayName: "Unused",
        challengeRating: 1,
        bodyRadiusWu: 14,
        combat: shippedEnemyCombat("grunt"),
      },
    };
    store.waves = {
      "1": {
        rewardGold: 1,
        groups: [
          { atMs: 0, enemyId: "grunt", count: 1, intervalMs: 0 },
          { atMs: 0, enemyId: "grunt", count: 1, intervalMs: 0 },
        ],
      },
    };
    expect(listPlayableDefenseEnemyIds(store)).toEqual(["grunt"]);
  });
});
