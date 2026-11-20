import { describe, expect, it } from "vitest";
import { enemyCollisionBodyRadius } from "../entities/entityPhysics";
import {
  enemyMeleeContactCenterDist,
  getEnemyCombatDefaults,
  resolveEnemyCombat,
} from "./enemyTuning";
import { ConfigLoadError } from "./configValidation";
import { normalizeEnemyRow } from "./normalizeEnemy";

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
      behavior: "arrowRainArcher",
      textureKey: "enemy_arrow_rain_archer",
    });
    expect(row.displayName).toBe("Arrow Rain Archer");
  });
});