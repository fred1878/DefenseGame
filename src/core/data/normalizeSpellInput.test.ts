import { describe, expect, it } from "vitest";
import { ConfigLoadError } from "./configValidation";
import {
  normalizeSpellInput,
  type SpellInputConfigInput,
} from "./normalizeSpellInput";

const aiming = {
  groundAimFacingRangeFrac: 0.55,
  groundAimEnemyRadiusFrac: 0.25,
  instantTargetFallbackPx: 40,
  enemyTapRadiusWu: 26,
};

describe("normalizeSpellInput", () => {
  it("requires both stick epsilon fields", () => {
    expect(() => normalizeSpellInput({})).toThrow(ConfigLoadError);
  });

  it("returns parsed numbers from a complete fixture", () => {
    const out = normalizeSpellInput({
      castInterruptStickAngleDeg: 25,
      stickMovingMagnitudeEps: 0.1,
      ...aiming,
    });
    expect(out.castInterruptStickAngleDeg).toBe(25);
    expect(out.stickMovingMagnitudeEps).toBe(0.1);
    expect(out.groundTapAutoCastSpellIds).toEqual([]);
    expect(out.enemyTapRadiusWu).toBe(26);
  });

  it("requires the aiming defaults", () => {
    const { enemyTapRadiusWu: _tap, ...rest } = aiming;
    expect(() =>
      normalizeSpellInput({
        castInterruptStickAngleDeg: 20,
        stickMovingMagnitudeEps: 0.1,
        ...rest,
      }),
    ).toThrow(/spell_input\.enemyTapRadiusWu/);
  });

  it("filters groundTapAutoCastSpellIds to strings", () => {
    const out = normalizeSpellInput({
      castInterruptStickAngleDeg: 20,
      stickMovingMagnitudeEps: 0.1,
      ...aiming,
      groundTapAutoCastSpellIds: ["meteor", 0, null, "blizzard"],
    } as SpellInputConfigInput);
    expect(out.groundTapAutoCastSpellIds).toEqual(["meteor", "blizzard"]);
  });
});
