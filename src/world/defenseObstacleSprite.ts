import type Phaser from "phaser";
import {
  OBSTACLE_SPRITE_CROP,
  type ObstacleTextureKey,
} from "../config/assets";

/** Scale cropped art to the gameplay collider so sprite footprint matches blocking. */
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