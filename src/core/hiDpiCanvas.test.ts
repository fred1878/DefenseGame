import { describe, expect, it } from "vitest";
import { computeBackingSize } from "./hiDpiCanvas";
import { snapQuadLikePhaser3 } from "./phaser3PixelParity";

describe("computeBackingSize", () => {
  it("keeps the logical size at 1× CSS and DPR 1", () => {
    expect(computeBackingSize(540, 1200, 1)).toEqual({
      width: 540,
      height: 1200,
      scale: 1,
    });
  });

  it("matches CSS size × DPR (Pixel 7 style 2.625)", () => {
    const s = computeBackingSize(540, 1200, 2.625);
    expect(s.width).toBe(1418);
    expect(s.height).toBe(3150);
    expect(s.scale).toBeCloseTo(1418 / 540, 5);
  });

  it("uses the FIT scale of a smaller CSS box", () => {
    // 412×915 phone viewport (FIT limited by width) at DPR 2.
    const s = computeBackingSize(412, 915.6, 2);
    expect(s.width).toBe(824);
    expect(s.height).toBe(1831);
  });

  it("caps DPR at the render resolution cap", () => {
    const s = computeBackingSize(540, 1200, 4, 3);
    expect(s.width).toBe(1620);
  });

  it("never drops below half the logical size", () => {
    expect(computeBackingSize(54, 120, 1).width).toBe(270);
  });
});

describe("snapQuadLikePhaser3 backing scale", () => {
  it("snaps to whole game pixels at scale 1", () => {
    const q = [10.4, 5.6, 20.4, 5.6, 20.4, 15.6, 10.4, 15.6];
    snapQuadLikePhaser3(q, 1);
    expect(q[0]).toBeCloseTo(10);
    expect(q[1]).toBeCloseTo(6);
    expect(q[2]).toBeCloseTo(20);
  });

  it("snaps to whole backing pixels at a fractional scale", () => {
    const scale = 2.625;
    const q = [10.4, 5.6, 20.4, 5.6, 20.4, 15.6, 10.4, 15.6];
    snapQuadLikePhaser3(q, scale);
    const px = (q[0] ?? 0) * scale;
    expect(Math.abs(px - Math.round(px))).toBeLessThan(1e-6);
    // Quad size is preserved.
    expect((q[2] ?? 0) - (q[0] ?? 0)).toBeCloseTo(10);
  });
});
