import type Phaser from "phaser";
import {
  OBSTACLE_SPRITE_CROP,
  type ObstacleTextureKey,
} from "../content/assets";
import { obstacleDisplaySize } from "../config/defense";

/** Cosmetic crop + display; no Arcade body (v2 blockers are separate rectangles). */
export function configureDefenseObstacleArt(
  image: Phaser.GameObjects.Image,
  textureKey: ObstacleTextureKey,
  registry?: Phaser.Data.DataManager,
): void {
  const crop = OBSTACLE_SPRITE_CROP[textureKey];
  const disp = obstacleDisplaySize(textureKey, registry);

  image.setCrop(crop.x, crop.y, crop.w, crop.h);
  image.setDisplaySize(disp.w, disp.h);
  image.setOrigin(0.5);
}
