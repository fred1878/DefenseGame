import { describe, expect, it } from "vitest";
import { ConfigLoadError } from "./configValidation";
import { resolveEnemyCombat } from "./enemyTuning";
import { shippedEnemyCombat } from "../test/shippedEnemyCombat";

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
    expect(tuned.melee!.triggerRangeWu).toBeGreaterThanOrEqual(tuned.melee!.rangeWu);
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
});