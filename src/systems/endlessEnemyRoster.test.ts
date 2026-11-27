import { describe, expect, it } from "vitest";
import { DataStore } from "../core/data/DataStore";
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

  it("skips unknown wave ids and sorts by id when a name is missing", () => {
    const store = new DataStore();
    const base = {
      hp: 1,
      speedWu: 1,
      damage: 1,
      weight: 100,
      behavior: "meleeChaser" as const,
      textureKey: "enemy_grunt",
      challengeRating: 1,
      bodyRadiusWu: 28,
      combat: shippedEnemyCombat("grunt"),
    };
    store.enemies = {
      zebra: { ...base, displayName: "Zebra" },
      ape: { ...base, textureKey: "enemy_ape", displayName: "Ape" },
      cat: { ...base, textureKey: "enemy_cat", displayName: "Cat" },
    };
    delete (store.enemies.ape as { displayName?: string }).displayName;
    store.waves = {
      "1": {
        rewardGold: 1,
        groups: [
          { atMs: 0, enemyId: "zebra", count: 1, intervalMs: 0 },
          { atMs: 0, enemyId: "ape", count: 1, intervalMs: 0 },
          { atMs: 0, enemyId: "cat", count: 1, intervalMs: 0 },
          { atMs: 0, enemyId: "missing", count: 1, intervalMs: 0 },
        ],
      },
    };
    expect(listPlayableDefenseEnemyIds(store)).toEqual(["ape", "cat", "zebra"]);
  });
});
