import { describe, expect, it } from "vitest";
import { DataStore } from "../core/DataStore";
import {
  getEndlessConcurrentCap,
  listPlayableDefenseEnemyIds,
} from "./endlessEnemyRoster";

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

describe("getEndlessConcurrentCap", () => {
  const gruntDef = {
    hp: 1,
    speed: 1,
    damage: 1,
    behavior: "meleeChaser",
    textureKey: "enemy_grunt",
    displayName: "Grunt",
    endlessConcurrent: 10,
  };

  it("uses JSON endlessConcurrent when set", () => {
    expect(getEndlessConcurrentCap("grunt", gruntDef)).toBe(10);
    expect(
      getEndlessConcurrentCap("custom", {
        ...gruntDef,
        endlessConcurrent: 3,
      }),
    ).toBe(3);
  });

  it("falls back to per-id table", () => {
    expect(getEndlessConcurrentCap("javelineer", undefined)).toBe(3);
    expect(getEndlessConcurrentCap("grunt", undefined)).toBe(10);
  });

  it("falls back to behavior defaults", () => {
    expect(
      getEndlessConcurrentCap("unknown_melee", {
        behavior: "meleeChaser",
      }),
    ).toBe(9);
  });

  it("clamps out-of-range JSON values", () => {
    expect(
      getEndlessConcurrentCap("x", {
        behavior: "meleeChaser",
        endlessConcurrent: 50,
      }),
    ).toBe(10);
  });
});