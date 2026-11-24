import Phaser from "phaser";
import { describe, expect, it } from "vitest";
import {
  DEFENSE_OBSTACLE_PLACEMENTS,
  DEFENSE_OBSTACLES,
  defenseObstacleColliderFromPlacement,
} from "../config/defense";
import { WORLD_PIXEL_SCALE_REGISTRY_KEY } from "../core/worldPixelScale";
import {
  circleRectOverlapDepth,
  circleRectSurfaceGap,
  defenseObstacleBlockerAabb,
  defenseObstacleBlockerRects,
  separateCircleFromBlockerAabb,
} from "./defenseObstacleBlocker";

function fakeRegistry(store: Record<string, unknown> = {}): Phaser.Data.DataManager {
  return {
    get: (key: string) => store[key],
    set: (key: string, value: unknown) => {
      store[key] = value;
    },
  } as Phaser.Data.DataManager;
}

describe("defenseObstacleBlockerRects", () => {
  it("matches placement colliders at default world scale factor (baseline 2×)", () => {
    const rects = defenseObstacleBlockerRects(fakeRegistry());
    expect(rects.length).toBe(DEFENSE_OBSTACLE_PLACEMENTS.length);
    for (let i = 0; i < rects.length; i++) {
      const base = defenseObstacleColliderFromPlacement(DEFENSE_OBSTACLE_PLACEMENTS[i]!);
      const rect = rects[i]!;
      expect(rect.x).toBeCloseTo(base.x, 5);
      expect(rect.y).toBeCloseTo(base.y, 5);
      expect(rect.w).toBeCloseTo(base.w, 5);
      expect(rect.h).toBeCloseTo(base.h, 5);
      expect(rect.textureKey).toBe(base.textureKey);
    }
    for (let i = 0; i < DEFENSE_OBSTACLES.length; i++) {
      expect(rects[i]!.x).toBeCloseTo(DEFENSE_OBSTACLES[i]!.x, 5);
      expect(rects[i]!.w).toBeCloseTo(DEFENSE_OBSTACLES[i]!.w, 5);
    }
  });

  it("scales blocker w/h with registry world pixel scale", () => {
    const full = defenseObstacleBlockerRects(
      fakeRegistry({ [WORLD_PIXEL_SCALE_REGISTRY_KEY]: 2 }),
    );
    const half = defenseObstacleBlockerRects(
      fakeRegistry({ [WORLD_PIXEL_SCALE_REGISTRY_KEY]: 1 }),
    );
    expect(half[0]!.w).toBeCloseTo(full[0]!.w * 0.5, 5);
    expect(half[0]!.h).toBeCloseTo(full[0]!.h * 0.5, 5);
    expect(half[0]!.x).toBeCloseTo(full[0]!.x * 0.5, 5);
    expect(half[0]!.y).toBeCloseTo(full[0]!.y * 0.5, 5);
  });

  it("measures circle–rect penetration depth for bump asserts", () => {
    const aabb = defenseObstacleBlockerAabb({ x: 0, y: 0, w: 40, h: 32 });
    expect(circleRectOverlapDepth(0, 34, 17, aabb)).toBe(0);
    expect(circleRectOverlapDepth(0, 10, 17, aabb)).toBeGreaterThan(0);
    expect(circleRectSurfaceGap(0, 34, 17, aabb)).toBeGreaterThan(0);
  });

  it("separates a circle center out of an overlapping rect", () => {
    const aabb = defenseObstacleBlockerAabb({ x: 0, y: 0, w: 40, h: 32 });
    const sep = separateCircleFromBlockerAabb(0, 10, 17, aabb);
    expect(sep.depth).toBeGreaterThan(0);
    expect(circleRectOverlapDepth(sep.cx, sep.cy, 17, aabb)).toBe(0);
  });

  it("maps center rects to axis-aligned edges for nav and debug", () => {
    const rects = defenseObstacleBlockerRects(fakeRegistry());
    for (const rect of rects) {
      const aabb = defenseObstacleBlockerAabb(rect);
      expect(aabb.cx).toBe(rect.x);
      expect(aabb.cy).toBe(rect.y);
      expect(aabb.left).toBeCloseTo(rect.x - rect.w / 2, 5);
      expect(aabb.right).toBeCloseTo(rect.x + rect.w / 2, 5);
      expect(aabb.top).toBeCloseTo(rect.y - rect.h / 2, 5);
      expect(aabb.bottom).toBeCloseTo(rect.y + rect.h / 2, 5);
    }
  });
});