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
 * Arcade StaticBody: center origin + crop feet alignment via offset (survives `reset()` / group refresh).
 */
export function applyDefenseObstacleArcadeBody(
  rock: Phaser.Physics.Arcade.Image,
  textureKey: ObstacleTextureKey,
  collider: { x: number; y: number; w: number; h: number },
): void {
  const layout = obstaclePhysicsLayout(textureKey);
  const offset = obstacleArcadeBodyOffset(
    layout,
    rock.displayWidth,
    rock.displayHeight,
    collider.w,
    collider.h,
  );
  const body = rock.body as Phaser.Physics.Arcade.StaticBody;
  body.setSize(collider.w, collider.h, false);
  body.setOffset(offset.x, offset.y);
  seatDefenseObstacleStaticBodyFromCollider(rock, collider, { preserveOffset: true });
}

/** Writes live `getBounds()` centers into `out` (same order as group children). */
export function syncDefenseObstacleBlockersFromPhysics(
  group: Phaser.Physics.Arcade.StaticGroup,
  placements: ReadonlyArray<{ textureKey: ObstacleTextureKey }>,
  out: DefenseObstacleRect[],
): void {
  const children = group.getChildren() as Phaser.Physics.Arcade.Image[];
  for (let i = 0; i < children.length; i++) {
    const rock = children[i]!;
    const placement = placements[i]!;
    const aabb = readArcadeStaticBodyWorldAabb(rock.body as Phaser.Physics.Arcade.StaticBody);
    const next: DefenseObstacleRect = {
      x: aabb.cx,
      y: aabb.cy,
      w: aabb.w,
      h: aabb.h,
      textureKey: placement.textureKey,
    };
    if (out[i]) {
      out[i] = next;
    } else {
      out.push(next);
    }
  }
  out.length = children.length;
}

/** Placement colliders + offset; call each frame so `reset()` drift cannot desync overlays. */
export function maintainDefenseObstaclePhysics(
  group: Phaser.Physics.Arcade.StaticGroup,
  scaledColliders: DefenseObstacleRect[],
  obstacleBlockers: DefenseObstacleRect[],
): void {
  const children = group.getChildren() as Phaser.Physics.Arcade.Image[];
  for (let i = 0; i < children.length; i++) {
    const rock = children[i]!;
    const collider = scaledColliders[i]!;
    applyDefenseObstacleArcadeBody(rock, collider.textureKey, collider);
  }
  syncDefenseObstacleBlockersFromPhysics(group, scaledColliders, obstacleBlockers);
}

/**
 * Forces Arcade tree bounds to match the nav/debug collider (authoritative gameplay rect).
 */
export function seatDefenseObstacleStaticBodyFromCollider(
  rock: Phaser.Physics.Arcade.Image,
  collider: { x: number; y: number; w: number; h: number },
  options?: { preserveOffset?: boolean },
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
  if (!options?.preserveOffset) {
    body.offset.set(0, 0);
  }
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
}

/** After visual setup + layer adopt: seat from placement collider (not sprite-only math). */
export function finalizeDefenseObstacleSprite(
  rock: Phaser.Physics.Arcade.Image,
  textureKey: ObstacleTextureKey,
  collider: Pick<DefenseObstacleRect, "x" | "y" | "w" | "h">,
): DefenseObstacleRect {
  applyDefenseObstacleArcadeBody(rock, textureKey, collider);
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