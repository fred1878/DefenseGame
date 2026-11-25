import { describe, expect, it } from "vitest";
import {
  defaultEnemyMeleeFxDurationMs,
  finalizeEnemyMeleeFxTiming,
  meleeFxPlaybackTimeScale,
} from "./meleeFxTiming";

const baseMelee = {
  triggerRangeWu: 70,
  rangeWu: 60,
  arcDeg: 80,
  windupMs: 200,
  activeMs: 100,
  recoveryMs: 300,
  cooldownMs: 400,
  fxStartMs: 200,
  meleeChaseStandoffWu: 3,
};

describe("meleeFxTiming", () => {
  it("keeps authored fxStartMs from windup begin", () => {
    const resolved = finalizeEnemyMeleeFxTiming("grunt", {
      ...baseMelee,
      fxStartMs: 0,
    });
    expect(resolved.fxStartMs).toBe(0);
  });

  it("defaults fxDurationMs to sheet natural ms for clipped enemies", () => {
    expect(defaultEnemyMeleeFxDurationMs("grunt", 110)).toBeCloseTo(750);
    const resolved = finalizeEnemyMeleeFxTiming("grunt", baseMelee);
    expect(resolved.fxDurationMs).toBeCloseTo(750);
  });

  it("falls back to activeMs for enemies without melee clips", () => {
    expect(defaultEnemyMeleeFxDurationMs("javelineer", 120)).toBe(120);
  });

  it("meleeFxPlaybackTimeScale stretches or compresses to target duration", () => {
    expect(meleeFxPlaybackTimeScale(750, 750)).toBeCloseTo(1);
    expect(meleeFxPlaybackTimeScale(750, 375)).toBeCloseTo(2);
    expect(meleeFxPlaybackTimeScale(600, 1200)).toBeCloseTo(0.5);
    expect(meleeFxPlaybackTimeScale(0, 100)).toBe(1);
  });
});