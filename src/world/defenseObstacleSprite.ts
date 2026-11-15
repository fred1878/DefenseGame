import type Phaser from "phaser";
import {
  OBSTACLE_SPRITE_CROP,
  type ObstacleTextureKey,
} from "../content/assets";

/** Crop transparent margins, then 1:1 display/collider size (same pattern as ground decor). */
export function configureDefenseObstacleSprite(
  rock: Phaser.Physics.Arcade.Image,
  textureKey: ObstacleTextureKey,
  w: number,
  h: number,
): void {
  const crop = OBSTACLE_SPRITE_CROP[textureKey];
  rock.setCrop(crop.x, crop.y, crop.w, crop.h);
  rock.setDisplaySize(w, h);
  rock.setOrigin(0.5);
  rock.refreshBody();
}