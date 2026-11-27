import { describe, expect, it } from "vitest";
import { jitterTelegraphCenter } from "./aoeTelegraphJitter";

describe("jitterTelegraphCenter", () => {
  it("offsets 1–5 px from the aim point", () => {
    let ri = 0;
    const random = () => {
      const seq = [0, 0.5, 0.25, 0.75];
      return seq[ri++ % seq.length]!;
    };
    const { x, y } = jitterTelegraphCenter(100, 200, random);
    const dist = Math.hypot(x - 100, y - 200);
    expect(dist).toBeGreaterThanOrEqual(1);
    expect(dist).toBeLessThanOrEqual(5.0001);
  });

  it("returns the origin when distance rolls to minimum at zero angle", () => {
    let n = 0;
    const random = () => (n++ === 0 ? 0 : 0);
    const { x, y } = jitterTelegraphCenter(50, 50, random);
    expect(x).toBeCloseTo(51, 4);
    expect(y).toBeCloseTo(50, 4);
  });
});
