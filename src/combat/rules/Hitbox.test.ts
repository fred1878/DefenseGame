import { describe, expect, it } from "vitest";
import {
  arcHitboxHitsTarget,
  circlesOverlap,
  segmentFirstCircleHitT,
} from "./Hitbox";

describe("circlesOverlap", () => {
  it("detects overlapping circles", () => {
    expect(
      circlesOverlap(
        { x: 0, y: 0, radius: 10, team: "player", damage: 1 },
        { x: 15, y: 0, radius: 10 },
      ),
    ).toBe(true);
  });

  it("rejects separated circles", () => {
    expect(
      circlesOverlap(
        { x: 0, y: 0, radius: 10, team: "player", damage: 1 },
        { x: 30, y: 0, radius: 10 },
      ),
    ).toBe(false);
  });
});

describe("arcHitboxHitsTarget", () => {
  it("hits a target inside the arc and range", () => {
    const hit = arcHitboxHitsTarget(0, 0, 0, 80, Math.PI / 3, 60, 0, 12);
    expect(hit).toBe(true);
  });

  it("misses when target is behind the attacker", () => {
    const hit = arcHitboxHitsTarget(0, 0, 0, 80, Math.PI / 4, -60, 0, 12);
    expect(hit).toBe(false);
  });

  it("misses when beyond range", () => {
    const hit = arcHitboxHitsTarget(0, 0, 0, 40, Math.PI / 2, 200, 0, 12);
    expect(hit).toBe(false);
  });
});

describe("segmentFirstCircleHitT", () => {
  it("treats a zero-length segment as a point test", () => {
    expect(segmentFirstCircleHitT(0, 0, 0, 0, 0, 0, 10)).toBe(0);
    expect(segmentFirstCircleHitT(20, 0, 20, 0, 0, 0, 10)).toBeNull();
  });
});
