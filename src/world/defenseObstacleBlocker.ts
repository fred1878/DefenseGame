import { defenseObstaclePlacements } from "../config/defense";
import type Phaser from "phaser";
import {
  type DefenseObstacleRect,
  defenseObstacleColliderFromPlacement,
} from "../config/defense";

export const DEFENSE_OBSTACLE_BLOCKER_DATA_KEY = "defenseBlocker";

export type DefenseObstacleBlockerAabb = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  cx: number;
  cy: number;
  w: number;
  h: number;
};

/** Authoritative gameplay rects for this run (nav, debug overlays, Arcade colliders). */
export function defenseObstacleBlockerRects(
  registry: Phaser.Data.DataManager,
): DefenseObstacleRect[] {
  return defenseObstaclePlacements().map((placement) =>
    defenseObstacleColliderFromPlacement(placement, registry),
  );
}

/** World AABB from center-sized blocker (PathDebug stroke, nav inflation). */
export function defenseObstacleBlockerAabb(
  rect: Pick<DefenseObstacleRect, "x" | "y" | "w" | "h">,
): DefenseObstacleBlockerAabb {
  const halfW = rect.w / 2;
  const halfH = rect.h / 2;
  return {
    left: rect.x - halfW,
    top: rect.y - halfH,
    right: rect.x + halfW,
    bottom: rect.y + halfH,
    w: rect.w,
    h: rect.h,
    cx: rect.x,
    cy: rect.y,
  };
}

export function readArcadeStaticBodyWorldAabb(
  body: Phaser.Physics.Arcade.StaticBody,
): DefenseObstacleBlockerAabb {
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

/** Authoritative tree AABB (matches {@link defenseObstacleBlockerAabb}). */
export function syncStaticBodyWorldAabb(
  body: Phaser.Physics.Arcade.StaticBody,
  left: number,
  top: number,
  w: number,
  h: number,
): void {
  const tree = body.world.staticTree as unknown as {
    remove(b: Phaser.Physics.Arcade.StaticBody): void;
    insert(b: Phaser.Physics.Arcade.StaticBody): void;
  };
  tree.remove(body);
  body.position.set(left, top);
  body.width = w;
  body.height = h;
  body.halfWidth = Math.floor(w / 2);
  body.halfHeight = Math.floor(h / 2);
  body.offset.set(0, 0);
  body.updateCenter();
  tree.insert(body);
}

function lockStaticBodyToBlocker(
  zone: Phaser.GameObjects.Rectangle,
  blocker: DefenseObstacleRect,
): void {
  zone.setData(DEFENSE_OBSTACLE_BLOCKER_DATA_KEY, blocker);
  const body = zone.body as Phaser.Physics.Arcade.StaticBody;
  const resync = (): Phaser.Physics.Arcade.StaticBody => {
    const stored = zone.getData(
      DEFENSE_OBSTACLE_BLOCKER_DATA_KEY,
    ) as DefenseObstacleRect;
    const { left, top, w, h } = defenseObstacleBlockerAabb(stored);
    syncStaticBodyWorldAabb(body, left, top, w, h);
    return body;
  };
  resync();
  body.updateFromGameObject = resync;
  body.reset = resync as typeof body.reset;
}

/**
 * Invisible static rectangle — gameplay collision only (art is separate Image).
 */
export function createDefenseObstacleCollider(
  scene: Phaser.Scene,
  blocker: DefenseObstacleRect,
  depth: number,
): Phaser.GameObjects.Rectangle {
  const zone = scene.add.rectangle(
    blocker.x,
    blocker.y,
    blocker.w,
    blocker.h,
    0x000000,
    0,
  );
  zone.setDepth(depth);
  zone.setVisible(false);
  scene.physics.add.existing(zone, true);
  lockStaticBodyToBlocker(zone, blocker);
  return zone;
}

/** Circle vs axis-aligned rect overlap depth (px); 0 = separated. */
export function circleRectOverlapDepth(
  cx: number,
  cy: number,
  radius: number,
  rect: DefenseObstacleBlockerAabb,
): number {
  const closestX = Math.max(rect.left, Math.min(cx, rect.right));
  const closestY = Math.max(rect.top, Math.min(cy, rect.bottom));
  const dx = cx - closestX;
  const dy = cy - closestY;
  const dist = Math.hypot(dx, dy);
  if (dist >= radius) return 0;
  return radius - dist;
}

/** Outside clearance: center-to-rect distance minus radius (positive = separated). */
export function circleRectSurfaceGap(
  cx: number,
  cy: number,
  radius: number,
  rect: DefenseObstacleBlockerAabb,
): number {
  const closestX = Math.max(rect.left, Math.min(cx, rect.right));
  const closestY = Math.max(rect.top, Math.min(cy, rect.bottom));
  return Math.hypot(cx - closestX, cy - closestY) - radius;
}

/**
 * Push a circle out of an axis-aligned rect along the shallowest escape axis.
 */
export function separateCircleFromBlockerAabb(
  cx: number,
  cy: number,
  radius: number,
  rect: DefenseObstacleBlockerAabb,
): { cx: number; cy: number; depth: number } {
  const depth = circleRectOverlapDepth(cx, cy, radius, rect);
  if (depth <= 0) {
    return { cx, cy, depth: 0 };
  }
  const closestX = Math.max(rect.left, Math.min(cx, rect.right));
  const closestY = Math.max(rect.top, Math.min(cy, rect.bottom));
  const dx = cx - closestX;
  const dy = cy - closestY;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-5) {
    const distTop = Math.abs(cy - rect.top);
    const distBottom = Math.abs(rect.bottom - cy);
    const distLeft = Math.abs(cx - rect.left);
    const distRight = Math.abs(rect.right - cx);
    const min = Math.min(distTop, distBottom, distLeft, distRight);
    if (min === distTop) {
      return { cx, cy: rect.top - radius, depth };
    }
    if (min === distBottom) {
      return { cx, cy: rect.bottom + radius, depth };
    }
    if (min === distLeft) {
      return { cx: rect.left - radius, cy, depth };
    }
    return { cx: rect.right + radius, cy, depth };
  }
  const nx = dx / dist;
  const ny = dy / dist;
  return { cx: cx + nx * depth, cy: cy + ny * depth, depth };
}

/** After Arcade stepping — removes circle–blocker penetration from discrete tunneling. */
export function correctPlayerObstacleBlockerOverlap(
  sprite: Phaser.Physics.Arcade.Sprite,
  blockers: DefenseObstacleRect[],
): void {
  const body = sprite.body as Phaser.Physics.Arcade.Body | null;
  if (!body) return;
  let cx = body.center.x;
  let cy = body.center.y;
  const r = body.halfWidth;
  const startCx = cx;
  const startCy = cy;
  for (let pass = 0; pass < blockers.length + 2; pass++) {
    let moved = false;
    for (const blocker of blockers) {
      const aabb = defenseObstacleBlockerAabb(blocker);
      const sep = separateCircleFromBlockerAabb(cx, cy, r, aabb);
      if (sep.depth > 0.001) {
        cx = sep.cx;
        cy = sep.cy;
        moved = true;
      }
    }
    if (!moved) break;
  }
  if (cx === startCx && cy === startCy) return;
  sprite.setPosition(sprite.x + (cx - startCx), sprite.y + (cy - startCy));
  body.reset(sprite.x, sprite.y);
  body.updateCenter();
}
