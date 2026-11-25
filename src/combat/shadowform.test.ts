import { describe, expect, it } from "vitest";
import {
  effectivePlayerAggroRadius,
  scalePlayerIncomingDamage,
  shadowformActive,
  shadowformBuffRemainingMs,
  shadowformMoveSpeedMultiplier,
} from "./shadowform";

const mechanics = {
  moveSpeedMult: 1.2,
  damageTakenMult: 0.7,
  aggroRadiusMult: 0.5,
};

describe("shadowform", () => {
  it("reports active only while endsAt is in the future", () => {
    expect(shadowformActive(5000, 4000)).toBe(true);
    expect(shadowformActive(5000, 5000)).toBe(false);
    expect(shadowformBuffRemainingMs(5000, 4200)).toBe(800);
    expect(shadowformBuffRemainingMs(5000, 6000)).toBe(0);
  });

  it("scales incoming damage by data mult when active", () => {
    expect(scalePlayerIncomingDamage(100, false, mechanics)).toBe(100);
    expect(scalePlayerIncomingDamage(100, true, mechanics)).toBeCloseTo(70);
    expect(scalePlayerIncomingDamage(0, true, mechanics)).toBe(0);
  });

  it("reduces effective aggro radius when active", () => {
    expect(effectivePlayerAggroRadius(320, false, mechanics)).toBe(320);
    expect(effectivePlayerAggroRadius(320, true, mechanics)).toBe(160);
  });

  it("composes move speed with optional status slow", () => {
    expect(shadowformMoveSpeedMultiplier(false, mechanics)).toBe(1);
    expect(shadowformMoveSpeedMultiplier(true, mechanics)).toBeCloseTo(1.2);
    expect(shadowformMoveSpeedMultiplier(true, mechanics, 0.5)).toBeCloseTo(
      0.6,
    );
  });
});
