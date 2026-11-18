import Phaser from "phaser";
import {
  DEFENSE_OBSTACLE_PLACEMENTS,
  type DefenseObstacleRect,
  defenseObstacleColliderFromPlacement,
} from "../config/defense";
import { worldScaleFactor } from "../core/worldPixelScale";

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
  const f = worldScaleFactor(registry);
  return DEFENSE_OBSTACLE_PLACEMENTS.map((placement) => {
    const base = defenseObstacleColliderFromPlacement(placement);
    return {
      x: base.x,
      y: base.y,
      w: base.w * f,
      h: base.h * f,
      textureKey: base.textureKey,
    };
  });
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

/**
 * Invisible static rectangle centered on blocker world coords — gameplay collision only.
 * Art sprites are separate `Image` objects with no physics body.
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
  const body = zone.body as Phaser.Physics.Arcade.StaticBody;
  body.setSize(blocker.w, blocker.h, true);
  return zone;
}