import type Phaser from "phaser";
import {
  OBSTACLE_SPRITE_CROP,
  type ObstacleTextureKey,
} from "../content/assets";
import {
  obstacleDisplaySize,
  obstaclePhysicsLayout,
  type ObstaclePhysicsLayout,
} from "../config/defense";

/** StaticBody offset from sprite top-left; paired with {@link Phaser.Physics.Arcade.StaticBody#reset}. */
export function obstacleArcadeBodyOffset(
  layout: ObstaclePhysicsLayout,
  displayW: number,
  displayH: number,
  blockW: number,
  blockH: number,
): { x: number; y: number } {
  const sizeScale = blockW / layout.bodyW;
  const halfW = Math.floor(blockW / 2);
  const halfH = Math.floor(blockH / 2);
  const offX = layout.bodyCenterOffsetX * sizeScale;
  const offY = layout.bodyCenterOffsetY * sizeScale;
  return {
    x: displayW / 2 - halfW + offX,
    y: displayH / 2 - halfH + offY,
  };
}

/** Crop art for display; Arcade body matches nav blocker (feet-aligned, may be smaller than sprite). */
export function configureDefenseObstacleSprite(
  rock: Phaser.Physics.Arcade.Image,
  textureKey: ObstacleTextureKey,
  blockW: number,
  blockH: number,
): void {
  const crop = OBSTACLE_SPRITE_CROP[textureKey];
  const disp = obstacleDisplaySize(textureKey);
  const layout = obstaclePhysicsLayout(textureKey);

  rock.setCrop(crop.x, crop.y, crop.w, crop.h);
  rock.setDisplaySize(disp.w, disp.h);
  rock.setOrigin(0.5);

  const body = rock.body as Phaser.Physics.Arcade.StaticBody;
  body.setSize(blockW, blockH, false);
  const offset = obstacleArcadeBodyOffset(
    layout,
    rock.displayWidth,
    rock.displayHeight,
    blockW,
    blockH,
  );
  body.setOffset(offset.x, offset.y);
  body.reset(rock.x, rock.y);
}

/** Expected Arcade body center for a sprite at the given anchor (unit-test / debug). */
export function obstacleBodyCenterAtAnchor(
  textureKey: ObstacleTextureKey,
  anchorX: number,
  anchorY: number,
  blockW?: number,
  blockH?: number,
): { x: number; y: number; w: number; h: number } {
  const layout = obstaclePhysicsLayout(textureKey);
  const w = blockW ?? layout.bodyW;
  const h = blockH ?? layout.bodyH;
  const sizeScale = w / layout.bodyW;
  return {
    x: anchorX + layout.bodyCenterOffsetX * sizeScale,
    y: anchorY + layout.bodyCenterOffsetY * sizeScale,
    w,
    h,
  };
}