import { describe, expect, it } from "vitest";
import { ConfigLoadError } from "./configValidation";
import { resolveEnemyCombat } from "../enemyTuning";
import { shippedEnemyCombat } from "../../test/shippedEnemyCombat";

describe("resolveEnemyCombat explicit authoring", () => {
  it("rejects missing combat root", () => {
    expect(() => resolveEnemyCombat("meleeChaser", undefined, "grunt")).toThrow(
      ConfigLoadError,
    );
  });

  it("resolves shipped grunt combat without defaults file", () => {
    const tuned = resolveEnemyCombat(
      "meleeChaser",
      shippedEnemyCombat("grunt"),
      "grunt",
    );
    expect(tuned.wall.damage).toBe(6);
    expect(tuned.melee!.triggerRangeWu).toBeGreaterThanOrEqual(
      tuned.melee!.rangeWu,
    );
    expect(tuned.melee!.meleeChaseStandoffWu).toBe(4);
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

  it("resolves shipped attackMovement defaults that match prior on-screen behavior", () => {
    const still = { windupMul: 0, activeMul: 0, recoveryMul: 0 };
    const bruiser = resolveEnemyCombat(
      "bruiser",
      shippedEnemyCombat("bruiser"),
      "bruiser",
    );
    expect(bruiser.melee!.attackMovement).toEqual({
      windupMul: 0.5,
      activeMul: 0.5,
      recoveryMul: 0.5,
    });
    const grunt = resolveEnemyCombat(
      "meleeChaser",
      shippedEnemyCombat("grunt"),
      "grunt",
    );
    expect(grunt.melee!.attackMovement).toEqual(still);
    const jav = resolveEnemyCombat(
      "javelineer",
      shippedEnemyCombat("javelineer"),
      "javelineer",
    );
    expect(jav.javelineer!.attackMovement).toEqual(still);
    const lobber = resolveEnemyCombat(
      "lobber",
      shippedEnemyCombat("lobber"),
      "lobber",
    );
    expect(lobber.lobber!.attackMovement).toEqual(still);
    expect(lobber.lobber!.attackCreepSpeedMul).toBe(0);
    const reaver = resolveEnemyCombat(
      "rangedHybrid",
      shippedEnemyCombat("reaver"),
      "reaver",
    );
    expect(reaver.melee!.attackMovement).toEqual(still);
    expect(reaver.stationaryRanged!.attackMovement).toEqual(still);
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
