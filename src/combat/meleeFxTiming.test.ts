import { describe, expect, it } from "vitest";
import { meleeFxPlaybackTimeScale } from "./meleeFxTiming";

describe("meleeFxPlaybackTimeScale", () => {
  it("uses natural speed when target omitted", () => {
    expect(meleeFxPlaybackTimeScale(750, undefined)).toBe(1);
  });

  it("speeds up when target is shorter than natural", () => {
    expect(meleeFxPlaybackTimeScale(750, 375)).toBeCloseTo(2);
  });

  it("slows when target is longer than natural", () => {
    expect(meleeFxPlaybackTimeScale(600, 1200)).toBeCloseTo(0.5);
  });

  it("matches natural when target equals natural", () => {
    expect(meleeFxPlaybackTimeScale(750, 750)).toBeCloseTo(1);
  });

  it("falls back to 1 for invalid durations", () => {
    expect(meleeFxPlaybackTimeScale(0, 100)).toBe(1);
    expect(meleeFxPlaybackTimeScale(750, 0)).toBe(1);
  });
});