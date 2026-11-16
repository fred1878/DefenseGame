import { describe, expect, it } from "vitest";
import {
  DEFAULT_ARROW_RAIN_COMBAT,
  DEFAULT_JAVELINEER_COMBAT,
  DEFAULT_STATIONARY_RANGED_COMBAT,
  DEFAULT_WALL_SIEGE_COMBAT,
  DEFAULT_LOBBER_COMBAT,
  DEFAULT_MELEE_COMBAT,
  DEFAULT_WALL_COMBAT,
  resolveEnemyCombat,
} from "./enemyTuning";
import { normalizeEnemyRow } from "./normalizeEnemy";

describe("resolveEnemyCombat", () => {
  it("fills melee grunt defaults when combat omitted", () => {
    const tuned = resolveEnemyCombat("meleeChaser", undefined);
    expect(tuned.wall).toEqual(DEFAULT_WALL_COMBAT);
    expect(tuned.melee).toEqual(DEFAULT_MELEE_COMBAT);
    expect(tuned.arrowRain).toBeUndefined();
    expect(tuned.javelineer).toBeUndefined();
    expect(tuned.stationaryRanged).toBeUndefined();
  });

  it("merges partial wall override onto defaults", () => {
    const tuned = resolveEnemyCombat("meleeChaser", {
      wall: { damage: 9 },
    });
    expect(tuned.wall.damage).toBe(9);
    expect(tuned.wall.triggerRange).toBe(DEFAULT_WALL_COMBAT.triggerRange);
    expect(tuned.melee).toEqual(DEFAULT_MELEE_COMBAT);
  });

  it("attaches behavior-specific tables from defaults", () => {
    const arrow = resolveEnemyCombat("arrowRainArcher", {});
    expect(arrow.arrowRain).toEqual(DEFAULT_ARROW_RAIN_COMBAT);

    const jav = resolveEnemyCombat("javelineer", {
      javelineer: { maxRange: 210 },
    });
    expect(jav.javelineer?.maxRange).toBe(210);
    expect(jav.javelineer?.minRange).toBe(DEFAULT_JAVELINEER_COMBAT.minRange);

    const sentry = resolveEnemyCombat("stationaryRanged", {});
    expect(sentry.stationaryRanged).toEqual(DEFAULT_STATIONARY_RANGED_COMBAT);

    const siege = resolveEnemyCombat("wallSiege", {});
    expect(siege.wallSiege).toEqual(DEFAULT_WALL_SIEGE_COMBAT);

    const lob = resolveEnemyCombat("lobber", {});
    expect(lob.lobber).toEqual(DEFAULT_LOBBER_COMBAT);
  });
});

describe("normalizeEnemyRow", () => {
  it("fills missing scalar stats from default grunt row", () => {
    const row = normalizeEnemyRow("grunt", {
      behavior: "meleeChaser",
      textureKey: "enemy_grunt",
    });
    expect(row.hp).toBe(30);
    expect(row.speed).toBe(85);
    expect(row.damage).toBe(8);
    expect(row.displayName).toBe("Grunt");
  });
});