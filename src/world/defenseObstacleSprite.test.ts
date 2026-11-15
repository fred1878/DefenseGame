import { describe, expect, it } from "vitest";
import {
  DEFENSE_OBSTACLE_ASSETS,
  OBSTACLE_BLOCKER_FOOTPRINT,
  OBSTACLE_SOURCE_FRAME,
  OBSTACLE_SPRITE_CROP,
} from "../content/assets";
import {
  DEFENSE_OBSTACLE_PLACEMENTS,
  DEFENSE_OBSTACLES,
  DEFENSE_OBSTACLE_WORLD_SCALE,
  OBSTACLE_COLLIDER_SIZE_SCALE,
  defenseObstacleColliderFromPlacement,
  defenseObstacleSpriteAnchor,
  defenseTileCenter,
  obstacleColliderSize,
  obstacleDisplaySize,
  obstaclePhysicsLayout,
} from "../config/defense";
import { DEFENSE_FIELD_TILES } from "../config/defense";
import { obstacleBodyCenterAtAnchor } from "./defenseObstacleSprite";

describe("defense obstacle art vs colliders", () => {
  it("keeps crop rects inside each texture frame", () => {
    for (const { key } of DEFENSE_OBSTACLE_ASSETS) {
      const frame = OBSTACLE_SOURCE_FRAME[key as keyof typeof OBSTACLE_SOURCE_FRAME];
      const crop = OBSTACLE_SPRITE_CROP[key as keyof typeof OBSTACLE_SPRITE_CROP];
      expect(crop.x + crop.w).toBeLessThanOrEqual(frame.w);
      expect(crop.y + crop.h).toBeLessThanOrEqual(frame.h);
    }
  });

  it("uses tight blockers inside sprite crop bounds at world scale", () => {
    const s = DEFENSE_OBSTACLE_WORLD_SCALE;
    for (const obs of DEFENSE_OBSTACLES) {
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
      expect(obs.w).toBeCloseTo(Math.min(block.w, crop.w) * s * OBSTACLE_COLLIDER_SIZE_SCALE);
      expect(obs.h).toBeCloseTo(Math.min(block.h, crop.h) * s * OBSTACLE_COLLIDER_SIZE_SCALE);
      expect(obs.w).toBeLessThanOrEqual(disp.w);
      expect(obs.h).toBeLessThanOrEqual(disp.h);
    }
  });

  it("places sprite anchors on ground tile centers inside the field", () => {
    const maxTx = DEFENSE_FIELD_TILES.cols;
    const maxTy = DEFENSE_FIELD_TILES.rows;
    for (const placement of DEFENSE_OBSTACLE_PLACEMENTS) {
      expect(placement.tileX).toBeGreaterThanOrEqual(0);
      expect(placement.tileY).toBeGreaterThanOrEqual(0);
      expect(placement.tileX).toBeLessThan(maxTx);
      expect(placement.tileY).toBeLessThan(maxTy);
      const anchor = defenseObstacleSpriteAnchor(placement);
      const c = defenseTileCenter(placement.tileX, placement.tileY);
      expect(anchor.x).toBeCloseTo(c.x, 5);
      expect(anchor.y).toBeCloseTo(c.y, 5);
    }
  });

  /**
   * Convention: sprite origin 0.5 sits on tile center (crop center). Collider is
   * bottom-aligned inside the crop so opaque art feet share the crop baseline.
   */
  it("aligns collider AABB center with feet baseline under display bounds", () => {
    const tol = 0.01;
    for (const placement of DEFENSE_OBSTACLE_PLACEMENTS) {
      const anchor = defenseObstacleSpriteAnchor(placement);
      const layout = obstaclePhysicsLayout(placement.textureKey);
      const collider = defenseObstacleColliderFromPlacement(placement);
      const expected = obstacleBodyCenterAtAnchor(
        placement.textureKey,
        anchor.x,
        anchor.y,
      );

      expect(collider.x).toBeCloseTo(expected.x, 5);
      expect(collider.y).toBeCloseTo(expected.y, 5);

      const displayBottom = anchor.y + layout.displayH / 2;
      const bodyBottom = collider.y + collider.h / 2;
      expect(Math.abs(bodyBottom - displayBottom)).toBeLessThanOrEqual(tol);

      const displayLeft = anchor.x - layout.displayW / 2;
      const bodyLeft = collider.x - collider.w / 2;
      const bodyRight = collider.x + collider.w / 2;
      expect(bodyLeft).toBeGreaterThanOrEqual(displayLeft - tol);
      expect(bodyRight).toBeLessThanOrEqual(anchor.x + layout.displayW / 2 + tol);
    }
  });
});