import { describe, expect, it } from "vitest";
import {
  OBSTACLE_BLOCKER_FOOTPRINT,
  OBSTACLE_SOURCE_FRAME,
  OBSTACLE_SPRITE_CROP,
  DEFENSE_OBSTACLE_ASSETS,
} from "../content/assets";
import {
  DEFENSE_OBSTACLE_PLACEMENTS,
  DEFENSE_OBSTACLE_WORLD_SCALE,
  OBSTACLE_COLLIDER_SIZE_SCALE,
  DEFENSE_FIELD_TILES,
  defenseObstacleColliderFromPlacement,
  DEFENSE_OBSTACLE_SPRITE_VISUAL_Y_OFFSET,
  defenseObstacleSpriteAnchor,
  defenseObstacleSpriteDisplayPosition,
  defenseTileCenter,
  obstacleColliderSize,
  obstacleDisplaySize,
  obstaclePhysicsLayout,
} from "../config/defense";

describe("defense obstacle art", () => {
  it("keeps crop rects inside each texture frame", () => {
    for (const { key } of DEFENSE_OBSTACLE_ASSETS) {
      const frame =
        OBSTACLE_SOURCE_FRAME[key as keyof typeof OBSTACLE_SOURCE_FRAME];
      const crop =
        OBSTACLE_SPRITE_CROP[key as keyof typeof OBSTACLE_SPRITE_CROP];
      expect(crop.x + crop.w).toBeLessThanOrEqual(frame.w);
      expect(crop.y + crop.h).toBeLessThanOrEqual(frame.h);
    }
  });

  it("uses tight blockers inside sprite crop bounds at world scale", () => {
    const s = DEFENSE_OBSTACLE_WORLD_SCALE;
    for (const placement of DEFENSE_OBSTACLE_PLACEMENTS) {
      const obs = defenseObstacleColliderFromPlacement(placement);
      const size = obstacleColliderSize(obs.textureKey);
      const disp = obstacleDisplaySize(obs.textureKey);
      const crop =
        OBSTACLE_SPRITE_CROP[
          obs.textureKey as keyof typeof OBSTACLE_SPRITE_CROP
        ];
      const block =
        OBSTACLE_BLOCKER_FOOTPRINT[
          obs.textureKey as keyof typeof OBSTACLE_BLOCKER_FOOTPRINT
        ];
      expect(obs.w).toBe(size.w);
      expect(obs.h).toBe(size.h);
      expect(disp.w).toBe(crop.w * s);
      expect(disp.h).toBe(crop.h * s);
      expect(obs.w).toBeCloseTo(
        Math.min(block.w, crop.w) * s * OBSTACLE_COLLIDER_SIZE_SCALE,
      );
      expect(obs.h).toBeCloseTo(
        Math.min(block.h, crop.h) * s * OBSTACLE_COLLIDER_SIZE_SCALE,
      );
      expect(obs.w).toBeLessThanOrEqual(disp.w);
      expect(obs.h).toBeLessThanOrEqual(disp.h);
    }
  });

  it("places sprite feet on ground tile centers inside the field", () => {
    const maxTx = DEFENSE_FIELD_TILES.cols;
    const maxTy = DEFENSE_FIELD_TILES.rows;
    for (const placement of DEFENSE_OBSTACLE_PLACEMENTS) {
      expect(placement.tileX).toBeGreaterThanOrEqual(0);
      expect(placement.tileY).toBeGreaterThanOrEqual(0);
      expect(placement.tileX).toBeLessThan(maxTx);
      expect(placement.tileY).toBeLessThan(maxTy);
      const anchor = defenseObstacleSpriteAnchor(placement);
      const tile = defenseTileCenter(placement.tileX, placement.tileY);
      const layout = obstaclePhysicsLayout(placement.textureKey);
      expect(anchor.x).toBeCloseTo(tile.x, 5);
      expect(anchor.y + layout.displayH / 2).toBeCloseTo(tile.y, 5);
    }
  });
});

describe("defenseObstacleSpriteDisplayPosition", () => {
  it("offsets the sprite from its physics anchor", () => {
    const placement = DEFENSE_OBSTACLE_PLACEMENTS[0];
    if (!placement) throw new Error("expected a placement");
    const anchor = defenseObstacleSpriteAnchor(placement);
    const shown = defenseObstacleSpriteDisplayPosition(placement);
    expect(shown.x).toBe(anchor.x);
    expect(shown.y).toBe(anchor.y + DEFENSE_OBSTACLE_SPRITE_VISUAL_Y_OFFSET);
  });

  it("scales the visual offset when a registry is provided", () => {
    const placement = DEFENSE_OBSTACLE_PLACEMENTS[0];
    if (!placement) throw new Error("expected a placement");
    const registry = {
      get: () => undefined,
    } as unknown as Phaser.Data.DataManager;
    const shown = defenseObstacleSpriteDisplayPosition(placement, registry);
    const anchor = defenseObstacleSpriteAnchor(placement, registry);
    expect(shown.x).toBe(anchor.x);
    expect(shown.y).toBeGreaterThan(anchor.y);
  });
});
