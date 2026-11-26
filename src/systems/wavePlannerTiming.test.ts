import { describe, expect, it } from "vitest";
import {
  WAVE_PLANNER_COUNT_MIN,
  clampWavePlannerCount,
  clampWavePlannerTimeMs,
} from "./wavePlannerTiming";

describe("wavePlannerTiming", () => {
  it("clamps non-finite values to the minimums", () => {
    expect(clampWavePlannerCount(Number.NaN)).toBe(WAVE_PLANNER_COUNT_MIN);
    expect(clampWavePlannerCount(Number.POSITIVE_INFINITY)).toBe(
      WAVE_PLANNER_COUNT_MIN,
    );
    expect(clampWavePlannerTimeMs(Number.NaN)).toBe(0);
    expect(clampWavePlannerTimeMs(Number.NEGATIVE_INFINITY)).toBe(0);
  });

  it("clamps finite values into range", () => {
    expect(clampWavePlannerCount(4.4)).toBe(4);
    expect(clampWavePlannerTimeMs(150)).toBe(200);
  });
});
