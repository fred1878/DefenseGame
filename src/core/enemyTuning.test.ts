import { describe, expect, it } from "vitest";
import { enemyCollisionBodyRadius } from "../entities/entityPhysics";
import {
  enemyMeleeContactCenterDist,
  getEnemyCombatDefaults,
  resolveEnemyCombat,
} from "./enemyTuning";
import { ConfigLoadError } from "./configValidation";
import { assertEnemyResolvedCombat, normalizeEnemyRow } from "./normalizeEnemy";
import type { EnemyDef } from "./DataStore";

describe("resolveEnemyCombat", () => {
  it("merges omitted enemy combat from loaded JSON defaults", () => {
    const tuned = resolveEnemyCombat("meleeChaser", undefined, "grunt");
    expect(tuned.wall.damage).toBeGreaterThan(0);
    expect(tuned.melee.triggerRange).toBeGreaterThanOrEqual(tuned.melee.range);
    expect(tuned.arrowRain).toBeUndefined();
  });

  it("merges partial wall override onto loaded defaults", () => {
    const tuned = resolveEnemyCombat("meleeChaser", {
      wall: { damage: 9 },
    });
    expect(tuned.wall.damage).toBe(9);
    expect(tuned.wall.triggerRange).toBe(getEnemyCombatDefaults().wall.triggerRange);
  });

  it("raises short melee engage values to physics contact for meleeChaser", () => {
    const contact = enemyMeleeContactCenterDist("meleeChaser", "grunt");
    const tuned = resolveEnemyCombat(
      "meleeChaser",
      { melee: { triggerRange: 30, range: 20 } },
      "grunt",
    );
    expect(tuned.melee.triggerRange).toBeGreaterThanOrEqual(contact);
    expect(tuned.melee.range).toBeGreaterThanOrEqual(
      enemyCollisionBodyRadius("meleeChaser", "grunt"),
    );
  });

  it("attaches behavior-specific tables when behavior matches", () => {
    const arrow = resolveEnemyCombat("arrowRainArcher", {});
    expect(arrow.arrowRain).toBeDefined();
    expect(arrow.arrowRain!.maxTicks).toBeGreaterThan(0);

    const jav = resolveEnemyCombat("javelineer", {
      javelineer: { maxRange: 210 },
    });
    expect(jav.javelineer?.maxRange).toBe(210);
    expect(jav.javelineer?.minRange).toBe(
      getEnemyCombatDefaults().javelineer.minRange,
    );
  });

  it("merges ranged damage overrides onto defaults", () => {
    const jav = resolveEnemyCombat("javelineer", {
      javelineer: { damage: 14 },
    });
    expect(jav.javelineer?.damage).toBe(14);
    const archer = resolveEnemyCombat("stationaryRanged", {
      stationaryRanged: { damage: 11 },
    });
    expect(archer.stationaryRanged?.damage).toBe(11);
    const charger = resolveEnemyCombat("charger", {
      charger: { chargeDamage: 40 },
    });
    expect(charger.charger?.chargeDamage).toBe(40);
  });
});

describe("normalizeEnemyRow", () => {
  it("requires hp, speed, damage, and weight", () => {
    expect(() =>
      normalizeEnemyRow("grunt", {
        behavior: "meleeChaser",
        textureKey: "enemy_grunt",
        hp: 10,
        speed: 50,
        damage: 5,
        weight: 100,
        challengeRating: 1,
      }),
    ).not.toThrow();
    expect(() =>
      normalizeEnemyRow("bad", {
        behavior: "meleeChaser",
        textureKey: "x",
      }),
    ).toThrow(ConfigLoadError);
  });

  it("derives displayName from id when omitted", () => {
    const row = normalizeEnemyRow("arrow_rain_archer", {
      hp: 1,
      speed: 1,
      damage: 1,
      weight: 100,
      challengeRating: 4,
      behavior: "arrowRainArcher",
      textureKey: "enemy_arrow_rain_archer",
    });
    expect(row.displayName).toBe("Arrow Rain Archer");
  });

  it("assertEnemyResolvedCombat requires resolved ranged and charge damage", () => {
    const melee: EnemyDef = normalizeEnemyRow("grunt", {
      behavior: "meleeChaser",
      textureKey: "enemy_grunt",
      hp: 10,
      speed: 50,
      damage: 5,
      weight: 100,
      challengeRating: 1,
    });
    expect(() => assertEnemyResolvedCombat("grunt", melee)).not.toThrow();
    const charger: EnemyDef = normalizeEnemyRow("charger", {
      behavior: "charger",
      textureKey: "enemy_charger",
      hp: 10,
      speed: 50,
      damage: 20,
      weight: 100,
      challengeRating: 6,
    });
    expect(() => assertEnemyResolvedCombat("charger", charger)).not.toThrow();
  });
});