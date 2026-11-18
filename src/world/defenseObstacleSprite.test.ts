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
  DEFENSE_MAP,
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
import {
  defenseObstacleConfigAabb,
  obstacleArcadeBodyOffset,
  obstacleBodyCenterAtAnchor,
} from "./defenseObstacleSprite";

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

  /**
   * Legacy offset math (documented); runtime bodies are seated from config, not offset sync.
   */
  it("derives Arcade offset for anchor-relative blocker center", () => {
    for (const placement of DEFENSE_OBSTACLE_PLACEMENTS) {
      const layout = obstaclePhysicsLayout(placement.textureKey);
      const collider = defenseObstacleColliderFromPlacement(placement);
      const offset = obstacleArcadeBodyOffset(
        layout,
        layout.displayW,
        layout.displayH,
        collider.w,
        collider.h,
      );
      const halfW = Math.floor(collider.w / 2);
      const halfH = Math.floor(collider.h / 2);
      const cx = -layout.displayW / 2 + offset.x + halfW;
      const cy = -layout.displayH / 2 + offset.y + halfH;
      const anchor = defenseObstacleSpriteAnchor(placement);
      expect(cx + anchor.x - DEFENSE_MAP.cellSize).toBeCloseTo(collider.x, 3);
      expect(cy + anchor.y - DEFENSE_MAP.cellSize).toBeCloseTo(collider.y, 3);
    }
  });

  it("maps config center rects to world AABB edges for debug / nav", () => {
    for (const obs of DEFENSE_OBSTACLES) {
      const aabb = defenseObstacleConfigAabb(obs);
      expect(aabb.cx).toBe(obs.x);
      expect(aabb.cy).toBe(obs.y);
      expect(aabb.left).toBeCloseTo(obs.x - obs.w / 2, 5);
      expect(aabb.right).toBeCloseTo(obs.x + obs.w / 2, 5);
      expect(aabb.top).toBeCloseTo(obs.y - obs.h / 2, 5);
      expect(aabb.bottom).toBeCloseTo(obs.y + obs.h / 2, 5);
    }
  });

  it("places collider feet on tile anchor under crop display", () => {
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

      const feetY = anchor.y + layout.displayH / 2;
      const bodyBottom = collider.y + collider.h / 2;
      expect(Math.abs(bodyBottom - (feetY - DEFENSE_MAP.cellSize))).toBeLessThanOrEqual(
        tol,
      );

      const displayLeft = anchor.x - layout.displayW / 2;
      const displayTop = anchor.y - layout.displayH / 2;
      const bodyLeft = collider.x - collider.w / 2;
      const bodyRight = collider.x + collider.w / 2;
      expect(bodyLeft).toBeGreaterThanOrEqual(displayLeft - DEFENSE_MAP.cellSize - tol);
      expect(bodyRight).toBeLessThanOrEqual(anchor.x + layout.displayW / 2 + tol);
      expect(bodyBottom).toBeLessThanOrEqual(feetY + tol);
      expect(collider.y - collider.h / 2).toBeGreaterThanOrEqual(displayTop - tol);
    }
  });
});