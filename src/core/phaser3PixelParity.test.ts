import { describe, expect, it } from "vitest";
import { snapQuadLikePhaser3 } from "./phaser3PixelParity";

describe("snapQuadLikePhaser3", () => {
  it("snaps the top-left corner and keeps the quad size (Phaser 3 setQuad)", () => {
    // 85×24.5 quad whose top-left sits on a half pixel.
    const quad = [169.5, 247.5, 169.5, 272, 254.5, 272, 254.5, 247.5];
    snapQuadLikePhaser3(quad);
    expect(quad).toEqual([170, 248, 170, 272.5, 255, 272.5, 255, 248]);
  });

  it("leaves an already snapped quad alone", () => {
    const quad = [10, 20, 10, 44, 95, 44, 95, 20];
    snapQuadLikePhaser3(quad);
    expect(quad).toEqual([10, 20, 10, 44, 95, 44, 95, 20]);
  });
});
