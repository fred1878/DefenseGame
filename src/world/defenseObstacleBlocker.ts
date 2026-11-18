import Phaser from "phaser";
import {
  DEFENSE_OBSTACLE_PLACEMENTS,
  type DefenseObstacleRect,
  defenseObstacleColliderFromPlacement,
  obstaclePhysicsLayout,
} from "../config/defense";
import { worldScaleFactor } from "../core/worldPixelScale";
import {
  obstacleArcadeBodyOffset,
  readArcadeStaticBodyWorldAabb,
} from "./defenseObstacleSprite";

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

/** Authoritative gameplay rects for this run (nav, debug overlays, physics). */
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

function writeStaticBodyWorldAabb(
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
  body.updateCenter();
  tree.insert(body);
}

/** Seats Arcade tree AABB to the blocker; keeps body offset from {@link obstacleArcadeBodyOffset}. */
export function applyDefenseObstacleBlockerToBody(
  rock: Phaser.Physics.Arcade.Image,
  blocker: DefenseObstacleRect,
): void {
  const layout = obstaclePhysicsLayout(blocker.textureKey);
  const offset = obstacleArcadeBodyOffset(
    layout,
    rock.displayWidth,
    rock.displayHeight,
    blocker.w,
    blocker.h,
  );
  const body = rock.body as Phaser.Physics.Arcade.StaticBody;
  body.setSize(blocker.w, blocker.h, false);
  body.setOffset(offset.x, offset.y);
  const { left, top, w, h } = defenseObstacleBlockerAabb(blocker);
  writeStaticBodyWorldAabb(body, left, top, w, h);
}

/** One-time install + lock Phaser sync hooks to the stored blocker rect. */
export function installDefenseObstacleStaticBody(
  rock: Phaser.Physics.Arcade.Image,
  blocker: DefenseObstacleRect,
): void {
  applyDefenseObstacleBlockerToBody(rock, blocker);
  rock.setData(DEFENSE_OBSTACLE_BLOCKER_DATA_KEY, blocker);
  const body = rock.body as Phaser.Physics.Arcade.StaticBody;
  const resync = (): Phaser.Physics.Arcade.StaticBody => {
    const stored = rock.getData(DEFENSE_OBSTACLE_BLOCKER_DATA_KEY) as DefenseObstacleRect;
    applyDefenseObstacleBlockerToBody(rock, stored);
    return body;
  };
  body.updateFromGameObject = resync;
  body.reset = resync as typeof body.reset;
}

export function arcadeBodyMatchesBlocker(
  body: Phaser.Physics.Arcade.StaticBody,
  blocker: DefenseObstacleRect,
  tolPx = 1,
): boolean {
  const live = readArcadeStaticBodyWorldAabb(body);
  const cfg = defenseObstacleBlockerAabb(blocker);
  return (
    Math.abs(live.left - cfg.left) <= tolPx &&
    Math.abs(live.top - cfg.top) <= tolPx &&
    Math.abs(live.right - cfg.right) <= tolPx &&
    Math.abs(live.bottom - cfg.bottom) <= tolPx
  );
}