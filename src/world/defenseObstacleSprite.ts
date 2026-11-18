import Phaser from "phaser";
import {
  OBSTACLE_SPRITE_CROP,
  type ObstacleTextureKey,
} from "../content/assets";
import {
  type DefenseObstacleRect,
  obstacleDisplaySize,
  obstaclePhysicsLayout,
  type ObstaclePhysicsLayout,
} from "../config/defense";

export type ArcadeWorldAabb = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  cx: number;
  cy: number;
  w: number;
  h: number;
};

/** World-space Arcade StaticBody AABB (what collision + `getBounds()` use). */
export function readArcadeStaticBodyWorldAabb(
  body: Phaser.Physics.Arcade.StaticBody,
): ArcadeWorldAabb {
  const b = { x: 0, y: 0, right: 0, bottom: 0 };
  body.getBounds(b);
  return {
    left: b.x,
    top: b.y,
    right: b.right,
    bottom: b.bottom,
    w: body.width,
    h: body.height,
    cx: b.x + body.width / 2,
    cy: b.y + body.height / 2,
  };
}

/** Config / nav blocker rect as world AABB (center x,y — same as PathDebugDraw). */
export function defenseObstacleConfigAabb(collider: {
  x: number;
  y: number;
  w: number;
  h: number;
}): ArcadeWorldAabb {
  const halfW = collider.w / 2;
  const halfH = collider.h / 2;
  return {
    left: collider.x - halfW,
    top: collider.y - halfH,
    right: collider.x + halfW,
    bottom: collider.y + halfH,
    w: collider.w,
    h: collider.h,
    cx: collider.x,
    cy: collider.y,
  };
}

/** StaticBody offset from sprite top-left (center origin); unit tests only. */
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

/**
 * Gameplay blocker center from the live sprite transform (world top-left).
 * Authoritative after `registerWorld` / layer parenting — anchor math alone can
 * drift one nav cell on device vs Arcade `getBounds()`.
 */
export function defenseObstacleBlockerFromSprite(
  rock: Phaser.Physics.Arcade.Image,
  textureKey: ObstacleTextureKey,
  blockW: number,
  blockH: number,
): Pick<DefenseObstacleRect, "x" | "y" | "w" | "h"> {
  const layout = obstaclePhysicsLayout(textureKey);
  const sizeScale = blockW / layout.bodyW;
  const topLeft = new Phaser.Math.Vector2();
  rock.getTopLeft(topLeft, true);
  return {
    x: topLeft.x + rock.displayWidth / 2 + layout.bodyCenterOffsetX * sizeScale,
    y: topLeft.y + rock.displayHeight / 2 + layout.bodyCenterOffsetY * sizeScale,
    w: blockW,
    h: blockH,
  };
}

/**
 * Forces Arcade tree bounds to match the nav/debug collider (authoritative gameplay rect).
 */
export function seatDefenseObstacleStaticBodyFromCollider(
  rock: Phaser.Physics.Arcade.Image,
  collider: { x: number; y: number; w: number; h: number },
): void {
  const body = rock.body as Phaser.Physics.Arcade.StaticBody;
  const tree = body.world.staticTree as unknown as {
    remove(b: Phaser.Physics.Arcade.StaticBody): void;
    insert(b: Phaser.Physics.Arcade.StaticBody): void;
  };
  tree.remove(body);
  const left = collider.x - collider.w / 2;
  const top = collider.y - collider.h / 2;
  body.position.set(left, top);
  body.width = collider.w;
  body.height = collider.h;
  body.halfWidth = Math.floor(collider.w / 2);
  body.halfHeight = Math.floor(collider.h / 2);
  body.offset.set(0, 0);
  body.updateCenter();
  tree.insert(body);
}

/** Visual crop only; call {@link defenseObstacleBlockerFromSprite} then seat after world-layer adopt. */
export function configureDefenseObstacleSprite(
  rock: Phaser.Physics.Arcade.Image,
  textureKey: ObstacleTextureKey,
  blockW: number,
  blockH: number,
): void {
  const crop = OBSTACLE_SPRITE_CROP[textureKey];
  const disp = obstacleDisplaySize(textureKey);

  rock.setCrop(crop.x, crop.y, crop.w, crop.h);
  rock.setDisplaySize(disp.w, disp.h);
  rock.setOrigin(0.5);

  const body = rock.body as Phaser.Physics.Arcade.StaticBody;
  body.setSize(blockW, blockH, false);
  body.offset.set(0, 0);
}

/** After visual setup + layer adopt: seat body and return gameplay rect for nav/debug. */
export function finalizeDefenseObstacleSprite(
  rock: Phaser.Physics.Arcade.Image,
  textureKey: ObstacleTextureKey,
  blockW: number,
  blockH: number,
): DefenseObstacleRect {
  const blocker = defenseObstacleBlockerFromSprite(rock, textureKey, blockW, blockH);
  seatDefenseObstacleStaticBodyFromCollider(rock, blocker);
  const aabb = readArcadeStaticBodyWorldAabb(rock.body as Phaser.Physics.Arcade.StaticBody);
  return {
    x: aabb.cx,
    y: aabb.cy,
    w: aabb.w,
    h: aabb.h,
    textureKey,
  };
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