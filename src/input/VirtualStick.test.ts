import { describe, expect, it } from "vitest";
import { pointInScreenRects } from "./VirtualStick";

describe("pointInScreenRects", () => {
  const rects = [
    { x: 0, y: 0, width: 100, height: 50 },
    { x: 400, y: 1000, width: 140, height: 200 },
  ];

  it("blocks points inside HUD band", () => {
    expect(pointInScreenRects(12, 24, rects)).toBe(true);
  });

  it("blocks right cluster", () => {
    expect(pointInScreenRects(450, 1100, rects)).toBe(true);
  });

  it("allows open playfield", () => {
    expect(pointInScreenRects(200, 600, rects)).toBe(false);
  });
});