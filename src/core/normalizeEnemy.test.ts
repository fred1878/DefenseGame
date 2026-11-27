import { describe, expect, it } from "vitest";
import { ConfigLoadError } from "./configValidation";
import { shippedEnemyCombat } from "../test/shippedEnemyCombat";
import {
  assertEnemyResolvedCombat,
  normalizeEnemyRow,
  type EnemyDefInput,
} from "./normalizeEnemy";

const meleeCombat = shippedEnemyCombat("grunt");

function baseRow(over: Partial<EnemyDefInput> = {}): EnemyDefInput {
  return {
    hp: 10,
    speedWu: 40,
    damage: 5,
    bodyRadiusWu: 12,
    weight: 1,
    challengeRating: 1,
    behavior: "meleeChaser",
    textureKey: "enemy_grunt",
    combat: meleeCombat,
    ...over,
  };
}

describe("normalizeEnemyRow", () => {
  it("fills a title-cased display name when one is omitted or blank", () => {
    const named = normalizeEnemyRow("arrow_rain_archer", baseRow());
    expect(named.displayName).toBe("Arrow Rain Archer");
    const blank = normalizeEnemyRow("foo_bar", baseRow({ displayName: "   " }));
    expect(blank.displayName).toBe("Foo Bar");
    expect(
      normalizeEnemyRow("grunt", baseRow({ displayName: "Grunt" })).displayName,
    ).toBe("Grunt");
  });

  it("rejects an unknown behavior instead of falling back to meleeChaser", () => {
    expect(() =>
      normalizeEnemyRow("x", baseRow({ behavior: "melee" })),
    ).toThrow(ConfigLoadError);
    expect(() =>
      normalizeEnemyRow("x", baseRow({ behavior: "melee" })),
    ).toThrow(/Unknown behavior "melee" at enemies\.x\.behavior/);
  });

  it("rejects missing or invalid required fields", () => {
    const required = [
      "hp",
      "speedWu",
      "damage",
      "bodyRadiusWu",
      "weight",
      "challengeRating",
    ] as const;
    for (const key of required) {
      const raw = baseRow();
      delete raw[key];
      expect(() => normalizeEnemyRow("x", raw)).toThrow(ConfigLoadError);
    }
    const noCombat = baseRow();
    delete (noCombat as { combat?: unknown }).combat;
    expect(() => normalizeEnemyRow("x", noCombat)).toThrow(/combat/);
    expect(() =>
      normalizeEnemyRow("x", baseRow({ challengeRating: -1 })),
    ).toThrow(/challengeRating/);
  });
});

describe("assertEnemyResolvedCombat", () => {
  it("accepts a valid melee chaser and rejects a missing standoff", () => {
    const row = normalizeEnemyRow("grunt", baseRow());
    expect(() => assertEnemyResolvedCombat("grunt", row)).not.toThrow();
    const noGap = normalizeEnemyRow(
      "grunt",
      baseRow({
        combat: {
          ...meleeCombat,
          melee: {
            ...meleeCombat.melee!,
          },
        },
      }),
    );
    // The field may still be present as undefined after spread.
    if (noGap.combat?.melee) {
      delete (noGap.combat.melee as { meleeChaseStandoffWu?: number })
        .meleeChaseStandoffWu;
    }
    expect(() => assertEnemyResolvedCombat("grunt", noGap)).toThrow(
      /meleeChaseStandoffWu/,
    );
    const badGap = normalizeEnemyRow(
      "grunt",
      baseRow({
        combat: {
          ...meleeCombat,
          melee: { ...meleeCombat.melee!, meleeChaseStandoffWu: -4 },
        },
      }),
    );
    expect(() => assertEnemyResolvedCombat("grunt", badGap)).toThrow(
      /meleeChaseStandoffWu/,
    );
  });

  it("rejects non-positive row damage", () => {
    const row = normalizeEnemyRow("grunt", baseRow({ damage: 0 }));
    expect(() => assertEnemyResolvedCombat("grunt", row)).toThrow(
      /invalid number/,
    );
  });
});
