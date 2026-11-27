import { describe, expect, it } from "vitest";
import {
  buildChainLightningSegments,
  jitterLightningPolyline,
} from "./ChainLightningFx";

describe("buildChainLightningSegments", () => {
  it("chains primary through each hop in order", () => {
    const segs = buildChainLightningSegments({ x: 0, y: 0 }, [
      { x: 50, y: 0 },
      { x: 80, y: 30 },
    ]);
    expect(segs).toEqual([
      { from: { x: 0, y: 0 }, to: { x: 50, y: 0 } },
      { from: { x: 50, y: 0 }, to: { x: 80, y: 30 } },
    ]);
  });
});

describe("jitterLightningPolyline", () => {
  it("starts and ends at segment endpoints", () => {
    const poly = jitterLightningPolyline(10, 20, 110, 20, 4, 8, () => 0.5);
    expect(poly[0]).toEqual({ x: 10, y: 20 });
    expect(poly[poly.length - 1]).toEqual({ x: 110, y: 20 });
  });
});

describe("jitterLightningPolyline leftover branches", () => {
  it("still builds a polyline when the endpoints coincide", () => {
    const pts = jitterLightningPolyline(4, 8, 4, 8, 3, 2, () => 0.5);
    expect(pts[0]).toEqual({ x: 4, y: 8 });
    expect(pts.at(-1)).toEqual({ x: 4, y: 8 });
    expect(pts).toHaveLength(4);
  });
});
