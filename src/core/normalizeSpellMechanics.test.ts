import { describe, expect, it } from "vitest";
import { ConfigLoadError } from "./configValidation";
import { normalizeSpellMechanics } from "./normalizeSpellMechanics";

describe("normalizeSpellMechanics", () => {
  it("requires all mechanic keys", () => {
    expect(() => normalizeSpellMechanics({})).toThrow(ConfigLoadError);
  });

  it("accepts a complete inline fixture", () => {
    const out = normalizeSpellMechanics({
      swingRangeWu: 70,
      swingArcDeg: 100,
      coneRangeWu: 110,
      coneArcDeg: 70,
      chainLightningHops: 3,
      chainLightningHopRangeWu: 100,
      blinkDistanceWu: 90,
      iceWallDistanceWu: 60,
      iceWallDurationMs: 5000,
      shadowformDurationMs: 8000,
      shadowformDamageMult: 1.2,
      frostRootMs: 6000,
      deepFreezeRootMs: 2000,
    });
    expect(out.swingRangeWu).toBe(70);
    expect(out.chainLightningHops).toBe(3);
  });
});