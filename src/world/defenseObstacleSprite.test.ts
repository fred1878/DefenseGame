import { describe, expect, it } from "vitest";
import {
  DEFENSE_OBSTACLE_ASSETS,
  OBSTACLE_BLOCKER_FOOTPRINT,
  OBSTACLE_SOURCE_FRAME,
  OBSTACLE_SPRITE_CROP,
} from "../content/assets";
import {
  DEFENSE_OBSTACLES,
  defenseTileCenter,
  obstacleColliderSize,
  obstacleDisplaySize,
} from "../config/defense";
import { DEFENSE_FIELD_TILES } from "../config/defense";

describe("defense obstacle art vs colliders", () => {
  it("keeps crop rects inside each texture frame", () => {
    for (const { key } of DEFENSE_OBSTACLE_ASSETS) {
      const frame = OBSTACLE_SOURCE_FRAME[key as keyof typeof OBSTACLE_SOURCE_FRAME];
      const crop = OBSTACLE_SPRITE_CROP[key as keyof typeof OBSTACLE_SPRITE_CROP];
      expect(crop.x + crop.w).toBeLessThanOrEqual(frame.w);
      expect(crop.y + crop.h).toBeLessThanOrEqual(frame.h);
    }
  });

  it("uses tight blockers inside sprite crop bounds", () => {
    for (const obs of DEFENSE_OBSTACLES) {
      const size = obstacleColliderSize(obs.textureKey);
      const disp = obstacleDisplaySize(obs.textureKey);
      const block =
        OBSTACLE_BLOCKER_FOOTPRINT[
          obs.textureKey as keyof typeof OBSTACLE_BLOCKER_FOOTPRINT
        ];
      expect(obs.w).toBe(size.w);
      expect(obs.h).toBe(size.h);
      expect(obs.w).toBeLessThanOrEqual(block.w);
      expect(obs.h).toBeLessThanOrEqual(block.h);
      expect(obs.w).toBeLessThanOrEqual(disp.w);
      expect(obs.h).toBeLessThanOrEqual(disp.h);
    }
  });

  it("places obstacles on ground tile centers inside the field", () => {
    const maxTx = DEFENSE_FIELD_TILES.cols;
    const maxTy = DEFENSE_FIELD_TILES.rows;
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