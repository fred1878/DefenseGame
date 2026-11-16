import { describe, expect, it } from "vitest";
import { DataStore } from "../core/DataStore";
import { listPlayableDefenseEnemyIds } from "./endlessEnemyRoster";

describe("listPlayableDefenseEnemyIds", () => {
  it("returns sorted ids referenced by waves", () => {
    const store = new DataStore();
    store.enemies = {
      grunt: {
        hp: 1,
        speed: 1,
        damage: 1,
        behavior: "meleeChaser",
        textureKey: "enemy_grunt",
        displayName: "Grunt",
      },
      unused: {
        hp: 1,
        speed: 1,
        damage: 1,
        behavior: "meleeChaser",
        textureKey: "enemy_unused",
        displayName: "Unused",
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