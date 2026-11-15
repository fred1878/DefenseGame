import { describe, expect, it } from "vitest";
import {
  DEFENSE_OBSTACLE_ASSETS,
  GROUND_TILE_SIZE,
  OBSTACLE_SOURCE_FRAME,
  OBSTACLE_SPRITE_CROP,
} from "../content/assets";
import {
  DEFENSE_OBSTACLES,
  defenseTileCenter,
  obstacleColliderSize,
} from "../config/defense";
import { GAME } from "../config/game";

describe("defense obstacle art vs colliders", () => {
  it("keeps crop rects inside each texture frame", () => {
    for (const { key } of DEFENSE_OBSTACLE_ASSETS) {
      const frame = OBSTACLE_SOURCE_FRAME[key as keyof typeof OBSTACLE_SOURCE_FRAME];
      const crop = OBSTACLE_SPRITE_CROP[key as keyof typeof OBSTACLE_SPRITE_CROP];
      expect(crop.x + crop.w).toBeLessThanOrEqual(frame.w);
      expect(crop.y + crop.h).toBeLessThanOrEqual(frame.h);
    }
  });

  it("matches collider size to opaque crop footprints", () => {
    for (const obs of DEFENSE_OBSTACLES) {
      const size = obstacleColliderSize(obs.textureKey);
      expect(obs.w).toBe(size.w);
      expect(obs.h).toBe(size.h);
      const crop =
        OBSTACLE_SPRITE_CROP[
          obs.textureKey as keyof typeof OBSTACLE_SPRITE_CROP
        ];
      expect(obs.w).toBe(crop.w);
      expect(obs.h).toBe(crop.h);
    }
  });

  it("places obstacles on ground tile centers inside the field", () => {
    const maxTx = Math.ceil((GAME.worldHalfWidth * 2) / GROUND_TILE_SIZE);
    const maxTy = Math.ceil((GAME.worldHalfHeight * 2) / GROUND_TILE_SIZE);
    for (let i = 0; i < DEFENSE_OBSTACLES.length; i++) {
      const obs = DEFENSE_OBSTACLES[i]!;
      let matched = false;
      for (let ty = 0; ty < maxTy; ty++) {
        for (let tx = 0; tx < maxTx; tx++) {
          const c = defenseTileCenter(tx, ty);
          if (Math.hypot(c.x - obs.x, c.y - obs.y) < 0.01) {
            matched = true;
            break;
          }
        }
        if (matched) break;
      }
      expect(matched).toBe(true);
    }
  });
});