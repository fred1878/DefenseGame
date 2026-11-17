import Phaser from "phaser";
import {
  OBSTACLE_SPRITE_CROP,
  type ObstacleTextureKey,
} from "../content/assets";
import {
  obstacleDisplaySize,
  obstaclePhysicsLayout,
  type ObstaclePhysicsLayout,
} from "../config/defense";

/** StaticBody offset from sprite top-left (feet origin); see {@link syncDefenseObstacleStaticBody}. */
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
    y: displayH + offY - halfH,
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
  rock.setOrigin(0.5, 1);

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
  syncDefenseObstacleStaticBody(rock);
}

/**
 * Arcade StaticBody.reset uses getTopLeft() in local space. World-layer parenting needs world coords
 * or colliders drift south of cropped sprites (DefenseScene dual-camera rig, #142).
 */
export function syncDefenseObstacleStaticBody(
  rock: Phaser.Physics.Arcade.Image,
): void {
  const body = rock.body as Phaser.Physics.Arcade.StaticBody;
  const world = body.world;
  const tree = world.staticTree as unknown as {
    remove(b: Phaser.Physics.Arcade.StaticBody): void;
    insert(b: Phaser.Physics.Arcade.StaticBody): void;
  };
  tree.remove(body);
  const topLeft = new Phaser.Math.Vector2();
  rock.getTopLeft(topLeft, true);
  body.position.x = topLeft.x + body.offset.x;
  body.position.y = topLeft.y + body.offset.y;
  body.updateCenter();
  tree.insert(body);
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