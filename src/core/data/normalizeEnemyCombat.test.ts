import { describe, expect, it } from "vitest";
import { ConfigLoadError } from "./configValidation";
import { resolveEnemyCombat } from "../enemyTuning";
import { shippedEnemyCombat } from "../../test/shippedEnemyCombat";
import {
  testJavelineerCombat,
  testMeleeCombat,
  testWallCombat,
} from "../../test/fixtures/inlineCombat";

describe("resolveEnemyCombat explicit authoring", () => {
  it("rejects missing combat root", () => {
    expect(() => resolveEnemyCombat("meleeChaser", undefined, "grunt")).toThrow(
      ConfigLoadError,
    );
  });

  it("resolves an authored melee combat block without a defaults file", () => {
    const tuned = resolveEnemyCombat(
      "meleeChaser",
      { wall: testWallCombat, melee: testMeleeCombat },
      "inline_grunt",
    );
    expect(tuned.wall.damage).toBe(testWallCombat.damage);
    expect(tuned.melee!.triggerRangeWu).toBeGreaterThanOrEqual(
      tuned.melee!.rangeWu,
    );
    expect(tuned.melee!.meleeChaseStandoffWu).toBe(
      testMeleeCombat.meleeChaseStandoffWu,
    );
    expect(tuned.arrowRain).toBeUndefined();
  });

  it("omits melee for ranged-only activation behaviors", () => {
    const lobber = resolveEnemyCombat(
      "lobber",
      shippedEnemyCombat("lobber"),
      "lobber",
    );
    expect(lobber.melee).toBeUndefined();
    expect(lobber.lobber!.damage).toBeGreaterThan(0);
  });

  it("requires melee vfx display fields", () => {
    const combat = shippedEnemyCombat("grunt");
    const {
      vfxDisplayW: _w,
      vfxDisplayH: _h,
      vfxOffsetWu: _o,
      ...melee
    } = combat.melee!;
    expect(() =>
      resolveEnemyCombat("meleeChaser", { ...combat, melee }, "grunt"),
    ).toThrow(ConfigLoadError);
  });

  it("requires a boolean fxRecycleOnDeath", () => {
    const { fxRecycleOnDeath: _f, ...melee } = testMeleeCombat;
    expect(() =>
      resolveEnemyCombat(
        "meleeChaser",
        { wall: testWallCombat, melee },
        "inline_grunt",
      ),
    ).toThrow(ConfigLoadError);
    expect(() =>
      resolveEnemyCombat(
        "meleeChaser",
        {
          wall: testWallCombat,
          melee: { ...testMeleeCombat, fxRecycleOnDeath: "yes" as never },
        },
        "inline_grunt",
      ),
    ).toThrow(/Expected boolean at .*fxRecycleOnDeath/);

    const tuned = resolveEnemyCombat(
      "meleeChaser",
      {
        wall: testWallCombat,
        melee: { ...testMeleeCombat, fxRecycleOnDeath: true },
      },
      "inline_grunt",
    );
    expect(tuned.melee!.fxRecycleOnDeath).toBe(true);
  });

  it("requires lobber impactVfxBlastMul", () => {
    const combat = shippedEnemyCombat("lobber");
    const { impactVfxBlastMul: _m, ...lobber } = combat.lobber!;
    expect(() =>
      resolveEnemyCombat("lobber", { ...combat, lobber }, "lobber"),
    ).toThrow(ConfigLoadError);
  });

  it("requires behavior-specific kit sections", () => {
    expect(() =>
      resolveEnemyCombat("arrowRainArcher", shippedEnemyCombat("grunt"), "bad"),
    ).toThrow(ConfigLoadError);
    const arrow = resolveEnemyCombat(
      "arrowRainArcher",
      shippedEnemyCombat("arrow_rain_archer"),
      "arrow_rain_archer",
    );
    expect(arrow.arrowRain!.maxTicks).toBeGreaterThan(0);
  });

  it("passes authored attackMovement through without a defaults merge", () => {
    const still = { windupMul: 0, activeMul: 0, recoveryMul: 0 };
    const phased = { windupMul: 0.25, activeMul: 0.5, recoveryMul: 0.75 };

    const melee = resolveEnemyCombat(
      "meleeChaser",
      {
        wall: testWallCombat,
        melee: { ...testMeleeCombat, attackMovement: phased },
      },
      "inline_chaser",
    );
    expect(melee.melee!.attackMovement).toEqual(phased);

    const jav = resolveEnemyCombat(
      "javelineer",
      {
        wall: testWallCombat,
        javelineer: { ...testJavelineerCombat, attackMovement: still },
      },
      "inline_javelineer",
    );
    expect(jav.javelineer!.attackMovement).toEqual(still);
  });

  it("requires attackMovement on phased attack kits", () => {
    const combat = shippedEnemyCombat("grunt");
    const { attackMovement: _ignored, ...melee } = combat.melee!;
    expect(() =>
      resolveEnemyCombat("meleeChaser", { ...combat, melee }, "grunt"),
    ).toThrow(ConfigLoadError);
  });

  it("rejects negative attackMovement multipliers", () => {
    const combat = shippedEnemyCombat("grunt");
    const melee = {
      ...combat.melee!,
      attackMovement: { windupMul: -0.1, activeMul: 0, recoveryMul: 0 },
    };
    expect(() =>
      resolveEnemyCombat("meleeChaser", { ...combat, melee }, "grunt"),
    ).toThrow(/must be >= 0/);
  });

  it("rejects a partial attackMovement object", () => {
    const combat = shippedEnemyCombat("sentry_archer");
    const stationaryRanged = {
      ...combat.stationaryRanged!,
      attackMovement: { windupMul: 1, recoveryMul: 1 },
    };
    expect(() =>
      resolveEnemyCombat(
        "stationaryRanged",
        { ...combat, stationaryRanged },
        "sentry_archer",
      ),
    ).toThrow(ConfigLoadError);
  });

  it("requires a non-negative attackCreepSpeedMul on lobbers", () => {
    const combat = shippedEnemyCombat("lobber");
    const { attackCreepSpeedMul: _ignored, ...lobber } = combat.lobber!;
    expect(() =>
      resolveEnemyCombat("lobber", { ...combat, lobber }, "lobber"),
    ).toThrow(ConfigLoadError);
    expect(() =>
      resolveEnemyCombat(
        "lobber",
        {
          ...combat,
          lobber: { ...combat.lobber!, attackCreepSpeedMul: -1 },
        },
        "lobber",
      ),
    ).toThrow(/attackCreepSpeedMul must be >= 0/);
  });
});
