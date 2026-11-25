import { describe, expect, it } from "vitest";
import { ConfigLoadError } from "./configValidation";
import {
  normalizeSpellInput,
  type SpellInputConfigInput,
} from "./normalizeSpellInput";

describe("normalizeSpellInput", () => {
  it("requires both stick epsilon fields", () => {
    expect(() => normalizeSpellInput({})).toThrow(ConfigLoadError);
  });

  it("returns parsed numbers from a complete fixture", () => {
    const out = normalizeSpellInput({
      castInterruptStickAngleDeg: 25,
      stickMovingMagnitudeEps: 0.1,
    });
    expect(out.castInterruptStickAngleDeg).toBe(25);
    expect(out.stickMovingMagnitudeEps).toBe(0.1);
    expect(out.groundTapAutoCastSpellIds).toEqual([]);
  });

  it("filters groundTapAutoCastSpellIds to strings", () => {
    const out = normalizeSpellInput({
      castInterruptStickAngleDeg: 20,
      stickMovingMagnitudeEps: 0.1,
      groundTapAutoCastSpellIds: ["meteor", 0, null, "blizzard"],
    } as SpellInputConfigInput);
    expect(out.groundTapAutoCastSpellIds).toEqual(["meteor", "blizzard"]);
  });
});
