import { defenseObstacles } from "../config/defense";
import { defenseObstaclePlacements } from "../config/defense";
import type Phaser from "phaser";
import { describe, expect, it, vi } from "vitest";
import {
  defenseObstacleColliderFromPlacement,
  type DefenseObstacleRect,
} from "../config/defense";
import { WORLD_PIXEL_SCALE_REGISTRY_KEY } from "../config/worldScale";
import {
  circleRectOverlapDepth,
  circleRectSurfaceGap,
  correctPlayerObstacleBlockerOverlap,
  defenseObstacleBlockerAabb,
  defenseObstacleBlockerRects,
  readArcadeStaticBodyWorldAabb,
  separateCircleFromBlockerAabb,
} from "./defenseObstacleBlocker";

const BLOCKER: DefenseObstacleRect = {
  x: 0,
  y: 0,
  w: 40,
  h: 32,
  textureKey: "obstacle_tall_rock",
};

function fakeRegistry(
  store: Record<string, unknown> = {},
): Phaser.Data.DataManager {
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
    expect(rects.length).toBe(defenseObstaclePlacements().length);
    for (let i = 0; i < rects.length; i++) {
      const base = defenseObstacleColliderFromPlacement(
        defenseObstaclePlacements()[i]!,
      );
      const rect = rects[i]!;
      expect(rect.x).toBeCloseTo(base.x, 5);
      expect(rect.y).toBeCloseTo(base.y, 5);
      expect(rect.w).toBeCloseTo(base.w, 5);
      expect(rect.h).toBeCloseTo(base.h, 5);
      expect(rect.textureKey).toBe(base.textureKey);
    }
    for (let i = 0; i < defenseObstacles().length; i++) {
      expect(rects[i]!.x).toBeCloseTo(defenseObstacles()[i]!.x, 5);
      expect(rects[i]!.w).toBeCloseTo(defenseObstacles()[i]!.w, 5);
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

describe("readArcadeStaticBodyWorldAabb", () => {
  it("reads the live static body bounds and center", () => {
    const body = {
      width: 40,
      height: 32,
      getBounds(out: {
        x: number;
        y: number;
        right: number;
        bottom: number;
      }): void {
        out.x = 10;
        out.y = 20;
        out.right = 50;
        out.bottom = 52;
      },
    } as unknown as Phaser.Physics.Arcade.StaticBody;

    expect(readArcadeStaticBodyWorldAabb(body)).toEqual({
      left: 10,
      top: 20,
      right: 50,
      bottom: 52,
      w: 40,
      h: 32,
      cx: 30,
      cy: 36,
    });
  });
});

describe("separateCircleFromBlockerAabb with the center inside the rect", () => {
  // 100×100 rect centered on the origin: edges at -50 / +50 on both axes.
  const aabb = defenseObstacleBlockerAabb({ x: 0, y: 0, w: 100, h: 100 });

  it("escapes through the top edge when it is nearest", () => {
    expect(separateCircleFromBlockerAabb(0, -45, 10, aabb)).toEqual({
      cx: 0,
      cy: -60,
      depth: 10,
    });
  });

  it("escapes through the bottom edge when it is nearest", () => {
    expect(separateCircleFromBlockerAabb(0, 45, 10, aabb)).toEqual({
      cx: 0,
      cy: 60,
      depth: 10,
    });
  });

  it("escapes through the left edge when it is nearest", () => {
    expect(separateCircleFromBlockerAabb(-45, 0, 10, aabb)).toEqual({
      cx: -60,
      cy: 0,
      depth: 10,
    });
  });

  it("escapes through the right edge when it is nearest", () => {
    expect(separateCircleFromBlockerAabb(45, 0, 10, aabb)).toEqual({
      cx: 60,
      cy: 0,
      depth: 10,
    });
  });
});

describe("correctPlayerObstacleBlockerOverlap", () => {
  function fakeSprite(
    centerX: number,
    centerY: number,
    halfWidth: number,
  ): {
    sprite: Phaser.Physics.Arcade.Sprite;
    setPosition: ReturnType<typeof vi.fn>;
    reset: ReturnType<typeof vi.fn>;
    updateCenter: ReturnType<typeof vi.fn>;
  } {
    const setPosition = vi.fn();
    const reset = vi.fn();
    const updateCenter = vi.fn();
    const sprite = {
      x: 100,
      y: 200,
      body: {
        center: { x: centerX, y: centerY },
        halfWidth,
        reset,
        updateCenter,
      },
      /** Mirrors Phaser: the sprite's own position moves with the correction. */
      setPosition(x: number, y: number): void {
        setPosition(x, y);
        this.x = x;
        this.y = y;
      },
    };
    return {
      sprite: sprite as unknown as Phaser.Physics.Arcade.Sprite,
      setPosition,
      reset,
      updateCenter,
    };
  }

  it("does nothing for a sprite without an Arcade body", () => {
    const setPosition = vi.fn();
    const sprite = {
      x: 0,
      y: 0,
      setPosition,
      body: null,
    } as unknown as Phaser.Physics.Arcade.Sprite;
    correctPlayerObstacleBlockerOverlap(sprite, [BLOCKER]);
    expect(setPosition).not.toHaveBeenCalled();
  });

  it("leaves a sprite that is already clear of every blocker", () => {
    const { sprite, setPosition, reset } = fakeSprite(0, 400, 17);
    correctPlayerObstacleBlockerOverlap(sprite, [BLOCKER]);
    expect(setPosition).not.toHaveBeenCalled();
    expect(reset).not.toHaveBeenCalled();
  });

  it("pushes a tunnelled sprite out of the blocker and resyncs its body", () => {
    const { sprite, setPosition, reset, updateCenter } = fakeSprite(0, 10, 17);
    correctPlayerObstacleBlockerOverlap(sprite, [BLOCKER]);
    // Circle center is pushed south to the blocker edge (16) plus its radius (17).
    expect(setPosition).toHaveBeenCalledWith(100, 223);
    expect(reset).toHaveBeenCalledWith(100, 223);
    expect(updateCenter).toHaveBeenCalled();
  });
});
