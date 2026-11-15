import { describe, expect, it } from "vitest";
import {
  DEFENSE_OBSTACLE_ASSETS,
  OBSTACLE_SOURCE_FRAME,
  OBSTACLE_SPRITE_CROP,
} from "../content/assets";
import { DEFENSE_OBSTACLES } from "../config/defense";

describe("defense obstacle art vs colliders", () => {
  it("keeps crop rects inside each texture frame", () => {
    for (const { key } of DEFENSE_OBSTACLE_ASSETS) {
      const frame = OBSTACLE_SOURCE_FRAME[key as keyof typeof OBSTACLE_SOURCE_FRAME];
      const crop = OBSTACLE_SPRITE_CROP[key as keyof typeof OBSTACLE_SPRITE_CROP];
      expect(crop.x + crop.w).toBeLessThanOrEqual(frame.w);
      expect(crop.y + crop.h).toBeLessThanOrEqual(frame.h);
    }
  });

  it("matches collider size to native frames", () => {
    for (const obs of DEFENSE_OBSTACLES) {
      const frame =
        OBSTACLE_SOURCE_FRAME[
          obs.textureKey as keyof typeof OBSTACLE_SOURCE_FRAME
        ];
      expect(obs.w).toBe(frame.w);
      expect(obs.h).toBe(frame.h);
    }
  });
});