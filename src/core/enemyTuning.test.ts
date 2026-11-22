import { describe, expect, it } from "vitest";
import { resolveEnemyCombat } from "./enemyTuning";
import { ConfigLoadError } from "./configValidation";
import { assertEnemyResolvedCombat, normalizeEnemyRow } from "./normalizeEnemy";
import type { EnemyDef } from "./DataStore";
import { shippedEnemyCombat } from "../test/shippedEnemyCombat";

describe("resolveEnemyCombat", () => {
  it("requires a full combat block — no defaults merge", () => {
    const tuned = resolveEnemyCombat(
      "meleeChaser",
      shippedEnemyCombat("grunt"),
      "grunt",
    );
    expect(tuned.wall.damage).toBeGreaterThan(0);
    expect(tuned.melee!.triggerRange).toBeGreaterThanOrEqual(tuned.melee!.range);
    expect(tuned.arrowRain).toBeUndefined();
  });

  it("uses only authored wall fields", () => {
    const combat = {
      ...shippedEnemyCombat("grunt"),
      wall: { damage: 9, triggerRange: 42, hitRange: 34 },
    };
    const tuned = resolveEnemyCombat("meleeChaser", combat, "grunt");
    expect(tuned.wall.damage).toBe(9);
    expect(tuned.wall.triggerRange).toBe(42);
  });

  it("passes authored melee triggerRange and range unchanged", () => {
    const base = shippedEnemyCombat("grunt");
    const tuned = resolveEnemyCombat(
      "meleeChaser",
      {
        ...base,
        melee: {
          ...base.melee!,
          triggerRange: 30,
          range: 20,
        },
      },
      "grunt",
    );
    expect(tuned.melee!.triggerRange).toBe(30);
    expect(tuned.melee!.range).toBe(20);
  });

  it("attaches behavior-specific tables when behavior matches", () => {
    const arrow = resolveEnemyCombat(
      "arrowRainArcher",
      shippedEnemyCombat("arrow_rain_archer"),
      "arrow_rain_archer",
    );
    expect(arrow.arrowRain).toBeDefined();
    expect(arrow.arrowRain!.maxTicks).toBeGreaterThan(0);

    const jav = resolveEnemyCombat(
      "javelineer",
      {
        ...shippedEnemyCombat("javelineer"),
        javelineer: {
          ...shippedEnemyCombat("javelineer").javelineer!,
          maxRange: 210,
        },
      },
      "javelineer",
    );
    expect(jav.javelineer?.maxRange).toBe(210);
    expect(jav.javelineer?.minRange).toBe(
      shippedEnemyCombat("javelineer").javelineer!.minRange,
    );
  });

  it("requires meleeChaseStandoffWu for melee chaser behaviors only", () => {
    const gruntCombat = shippedEnemyCombat("grunt");
    const tuned = resolveEnemyCombat("meleeChaser", gruntCombat, "grunt");
    expect(tuned.melee!.meleeChaseStandoffWu).toBe(4);

    const lobber = resolveEnemyCombat(
      "lobber",
      shippedEnemyCombat("lobber"),
      "lobber",
    );
    expect(lobber.melee).toBeUndefined();
  });

  it("resolves authored ranged and charge damage", () => {
    const jav = resolveEnemyCombat(
      "javelineer",
      {
        ...shippedEnemyCombat("javelineer"),
        javelineer: {
          ...shippedEnemyCombat("javelineer").javelineer!,
          damage: 14,
        },
      },
      "javelineer",
    );
    expect(jav.javelineer?.damage).toBe(14);
    const archer = resolveEnemyCombat(
      "stationaryRanged",
      {
        ...shippedEnemyCombat("sentry_archer"),
        stationaryRanged: {
          ...shippedEnemyCombat("sentry_archer").stationaryRanged!,
          damage: 11,
        },
      },
      "sentry_archer",
    );
    expect(archer.stationaryRanged?.damage).toBe(11);
    const charger = resolveEnemyCombat(
      "charger",
      {
        ...shippedEnemyCombat("charger"),
        charger: {
          ...shippedEnemyCombat("charger").charger!,
          chargeDamage: 40,
        },
      },
      "charger",
    );
    expect(charger.charger?.chargeDamage).toBe(40);
  });
});

describe("normalizeEnemyRow", () => {
  it("requires hp, speed, damage, weight, and combat", () => {
    expect(() =>
      normalizeEnemyRow("grunt", {
        behavior: "meleeChaser",
        textureKey: "enemy_grunt",
        hp: 10,
        speed: 50,
        damage: 5,
        bodyRadius: 28,
        weight: 100,
        challengeRating: 1,
        combat: shippedEnemyCombat("grunt"),
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
      bodyRadius: 14,
      weight: 100,
      challengeRating: 4,
      behavior: "arrowRainArcher",
      textureKey: "enemy_arrow_rain_archer",
      combat: shippedEnemyCombat("arrow_rain_archer"),
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
      bodyRadius: 28,
      weight: 100,
      challengeRating: 1,
      combat: shippedEnemyCombat("grunt"),
    });
    expect(() => assertEnemyResolvedCombat("grunt", melee)).not.toThrow();
    const charger: EnemyDef = normalizeEnemyRow("charger", {
      behavior: "charger",
      textureKey: "enemy_charger",
      hp: 10,
      speed: 50,
      damage: 20,
      bodyRadius: 21,
      weight: 100,
      challengeRating: 6,
      combat: shippedEnemyCombat("charger"),
    });
    expect(() => assertEnemyResolvedCombat("charger", charger)).not.toThrow();
  });

  it("assertEnemyResolvedCombat requires meleeChaseStandoffWu for melee chasers", () => {
    const broken = {
      ...shippedEnemyCombat("grunt"),
      melee: { ...shippedEnemyCombat("grunt").melee! },
    };
    delete (broken.melee as { meleeChaseStandoffWu?: number }).meleeChaseStandoffWu;
    const missing: EnemyDef = normalizeEnemyRow("grunt", {
      behavior: "meleeChaser",
      textureKey: "enemy_grunt",
      hp: 10,
      speed: 50,
      damage: 5,
      bodyRadius: 28,
      weight: 100,
      challengeRating: 1,
      combat: broken,
    });
    expect(() => assertEnemyResolvedCombat("grunt", missing)).toThrow(
      ConfigLoadError,
    );
  });
});