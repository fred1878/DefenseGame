import Phaser from "phaser";
import { setShowEnemyPaths } from "../../debug/DebugState";
import { defenseWorldToScreen } from "../../world/defenseCamera";
import {
  circleRectOverlapDepth,
  circleRectSurfaceGap,
  correctPlayerObstacleBlockerOverlap,
  defenseObstacleBlockerAabb,
  type DefenseObstacleBlockerAabb,
  readArcadeStaticBodyWorldAabb,
} from "../../world/defenseObstacleBlocker";
import type {
  DefenseObstacleBumpCardinal,
  DefenseObstacleBumpProbe,
  DefenseSceneE2eDelegate,
} from "./DefenseSceneE2ETypes";

/** E2E hooks: player placement, obstacle blockers/bump probes, camera, world→screen. */

export function defenseSceneE2eSetPlayerPosition(
  scene: DefenseSceneE2eDelegate,
  x: number,
  y: number,
): void {
  const body = scene.player.sprite.body as Phaser.Physics.Arcade.Body | null;
  if (body) {
    const ddx = x - body.center.x;
    const ddy = y - body.center.y;
    scene.player.sprite.setPosition(
      scene.player.sprite.x + ddx,
      scene.player.sprite.y + ddy,
    );
    body.reset(scene.player.sprite.x, scene.player.sprite.y);
    body.setVelocity(0, 0);
    body.updateCenter();
  } else {
    scene.player.sprite.setPosition(x, y);
  }
  scene.physics.world.collide(scene.player.sprite, scene.obstacleGroup);
  // E2E teleports skip follow lerp — tests assert scroll vs position, not easing.
  const cx = body?.center.x ?? scene.player.sprite.x;
  const cy = body?.center.y ?? scene.player.sprite.y;
  scene.cameras.main.centerOn(cx, cy);
}

export function defenseSceneE2eObstacleBlockerAabb(
  scene: DefenseSceneE2eDelegate,
  index: number,
): DefenseObstacleBlockerAabb {
  const blocker = scene.obstacleBlockers[index];
  if (!blocker) {
    throw new Error(`obstacle blocker index ${index} out of range`);
  }
  return defenseObstacleBlockerAabb(blocker);
}

export function defenseSceneE2eObstacleArcadeBodyAabb(
  scene: DefenseSceneE2eDelegate,
  index: number,
): DefenseObstacleBlockerAabb {
  const child = scene.obstacleGroup.getChildren()[index] as
    | Phaser.GameObjects.Rectangle
    | undefined;
  const body = child?.body as Phaser.Physics.Arcade.StaticBody | null | undefined;
  if (!body) {
    throw new Error(`obstacle arcade body index ${index} missing`);
  }
  return readArcadeStaticBodyWorldAabb(body);
}

export function defenseSceneE2ePlayerBodyRadius(
  scene: DefenseSceneE2eDelegate,
): number {
  const body = scene.player.sprite.body as Phaser.Physics.Arcade.Body | null;
  return body?.halfWidth ?? 0;
}

export function defenseSceneE2eMaxPlayerObstacleOverlapPx(
  scene: DefenseSceneE2eDelegate,
  obstacleIndex?: number,
): number {
  const body = scene.player.sprite.body as Phaser.Physics.Arcade.Body | null;
  if (!body) return 0;
  const cx = body.center.x;
  const cy = body.center.y;
  const r = body.halfWidth;
  const blockers =
    obstacleIndex === undefined
      ? scene.obstacleBlockers
      : [scene.obstacleBlockers[obstacleIndex]!].filter(Boolean);
  let max = 0;
  for (const obs of blockers) {
    if (!obs) continue;
    max = Math.max(
      max,
      circleRectOverlapDepth(cx, cy, r, defenseObstacleBlockerAabb(obs)),
    );
  }
  return max;
}

export function defenseSceneE2eCenterCameraOn(
  scene: DefenseSceneE2eDelegate,
  worldX: number,
  worldY: number,
): void {
  scene.cameras.main.centerOn(worldX, worldY);
}

export function defenseSceneE2eObstacleBumpProbe(
  scene: DefenseSceneE2eDelegate,
  obstacleIndex: number,
  approach: DefenseObstacleBumpCardinal,
): DefenseObstacleBumpProbe {
  const blocker = scene.obstacleBlockers[obstacleIndex];
  if (!blocker) {
    throw new Error(`obstacle blocker index ${obstacleIndex} out of range`);
  }
  const body = scene.player.sprite.body as Phaser.Physics.Arcade.Body;
  const cx = body.center.x;
  const cy = body.center.y;
  const r = body.halfWidth;
  const aabb = defenseObstacleBlockerAabb(blocker);
  const surfaceGapPx = circleRectSurfaceGap(cx, cy, r, aabb);
  const penetrationPx = circleRectOverlapDepth(cx, cy, r, aabb);
  let edgeErrPx = surfaceGapPx;
  if (approach === "north" || approach === "south") {
    edgeErrPx = cy - r - aabb.bottom;
    if (approach === "south") {
      edgeErrPx = aabb.top - (cy + r);
    }
  } else if (approach === "east") {
    edgeErrPx = aabb.left - (cx + r);
  } else if (approach === "west") {
    edgeErrPx = cx - r - aabb.right;
  }
  const pastCenter =
    approach === "north"
      ? cy < aabb.cy
      : approach === "south"
        ? cy > aabb.cy
        : approach === "east"
          ? cx < aabb.cx
          : cx > aabb.cx;
  return {
    player: { x: cx, y: cy },
    surfaceGapPx,
    penetrationPx,
    edgeErrPx,
    pastCenter,
  };
}

export function defenseSceneE2eResolvePlayerObstacleOverlap(
  scene: DefenseSceneE2eDelegate,
): void {
  correctPlayerObstacleBlockerOverlap(scene.player.sprite, scene.obstacleBlockers);
  scene.physics.world.collide(scene.player.sprite, scene.obstacleGroup);
  correctPlayerObstacleBlockerOverlap(scene.player.sprite, scene.obstacleBlockers);
}

export function defenseSceneE2eFlushTangentPosition(
  scene: DefenseSceneE2eDelegate,
  obstacleIndex: number,
  approach: DefenseObstacleBumpCardinal,
  beyondPx: number,
): { x: number; y: number } {
  const aabb = defenseSceneE2eObstacleBlockerAabb(scene, obstacleIndex);
  const r = defenseSceneE2ePlayerBodyRadius(scene);
  switch (approach) {
    case "north":
      return { x: aabb.cx, y: aabb.bottom + r + beyondPx };
    case "south":
      return { x: aabb.cx, y: aabb.top - r - beyondPx };
    case "east":
      return { x: aabb.left - r - beyondPx, y: aabb.cy };
    case "west":
      return { x: aabb.right + r + beyondPx, y: aabb.cy };
  }
}

export function defenseSceneE2eGetDefenseCameraScroll(
  scene: DefenseSceneE2eDelegate,
): { x: number; y: number } {
  return {
    x: scene.cameras.main.scrollX,
    y: scene.cameras.main.scrollY,
  };
}

export function defenseSceneE2eSetShowEnemyPaths(
  scene: DefenseSceneE2eDelegate,
  on: boolean,
): void {
  setShowEnemyPaths(scene.registry, on);
}

export function defenseSceneE2eWorldPointToScreen(
  scene: DefenseSceneE2eDelegate,
  worldX: number,
  worldY: number,
): { x: number; y: number } {
  return defenseWorldToScreen(scene.cameras.main, worldX, worldY);
}
