import { DEFENSE_MAP, PLAYER_AGGRO_RADIUS } from "../../config";
import { worldUnit } from "../../core/worldPixelScale";
import {
  pathingPeerAgents,
  replanEnemyPath,
  resolveEnemyTarget,
} from "../EnemyBrain";
import type { EnemyBehavior, EnemyPeerAlly } from "./types";
import { applyChaseVelocity } from "./movement";

const RANGED_PROTECT_BEHAVIORS = new Set([
  "arrowRainArcher",
  "stationaryRanged",
  "javelineer",
]);

export function pickWardProtectee(
  allies: readonly EnemyPeerAlly[] | undefined,
  ex: number,
  ey: number,
  protectRadius: number,
): EnemyPeerAlly | undefined {
  if (!allies?.length) return undefined;
  let best: EnemyPeerAlly | undefined;
  let bestDist = protectRadius;
  for (const ally of allies) {
    if (!RANGED_PROTECT_BEHAVIORS.has(ally.behavior)) continue;
    const d = Math.hypot(ally.x - ex, ally.y - ey);
    if (d < bestDist) {
      bestDist = d;
      best = ally;
    }
  }
  return best;
}

export function wardScreenPoint(
  px: number,
  py: number,
  ax: number,
  ay: number,
  blend: number,
): { x: number; y: number } {
  const t = Math.min(1, Math.max(0, blend));
  return {
    x: ax + (px - ax) * t,
    y: ay + (py - ay) * t,
  };
}

export const wardBehavior: EnemyBehavior = (ctx) => {
  const { enemy, nav, grid, playerX, playerY, deltaMs, peerAgents, peerAllies } =
    ctx;
  const ex = enemy.sprite.x;
  const ey = enemy.sprite.y;
  const reg = enemy.sprite.scene.registry;
  const ward = enemy.combatTuning.ward;
  const waypointRadius = worldUnit(DEFENSE_MAP.pathWaypointRadius, reg);
  const aggro = ward?.playerAggroRadius ?? PLAYER_AGGRO_RADIUS;

  const protectee = pickWardProtectee(
    peerAllies,
    ex,
    ey,
    worldUnit(ward?.protectRadius ?? 220, reg),
  );

  let goalX: number;
  let goalY: number;
  let targetKind: "player" | "wall" = "wall";

  if (protectee) {
    const screen = wardScreenPoint(
      playerX,
      playerY,
      protectee.x,
      protectee.y,
      ward?.screenBlend ?? 0.42,
    );
    goalX = screen.x;
    goalY = screen.y;
    const distPlayer = Math.hypot(playerX - ex, playerY - ey);
    if (distPlayer <= worldUnit(aggro, reg)) {
      targetKind = "player";
    }
  } else {
    const resolved = resolveEnemyTarget(
      nav,
      grid,
      ex,
      ey,
      playerX,
      playerY,
      deltaMs,
      worldUnit(aggro, reg),
      ctx.objective ?? "defendWall",
    );
    goalX = resolved.goalX;
    goalY = resolved.goalY;
    targetKind = resolved.targetKind;
    nav.targetKind = resolved.targetKind;
  }

  nav.replanMs = Math.max(0, nav.replanMs - deltaMs);

  if (nav.replanMs <= 0 || nav.path.length === 0) {
    replanEnemyPath(
      nav,
      grid,
      ex,
      ey,
      goalX,
      goalY,
      waypointRadius,
      pathingPeerAgents(peerAgents, targetKind, playerX, playerY),
      enemy,
    );
    nav.replanMs = DEFENSE_MAP.pathReplanMs;
  }

  let moveX = goalX;
  let moveY = goalY;
  if (nav.path.length > 0 && nav.pathIndex < nav.path.length) {
    const wp = nav.path[nav.pathIndex]!;
    const d = Math.hypot(wp.x - ex, wp.y - ey);
    if (d <= waypointRadius) {
      nav.pathIndex += 1;
    }
    const nextWp = nav.path[nav.pathIndex];
    if (nextWp) {
      moveX = nextWp.x;
      moveY = nextWp.y;
    }
  }

  applyChaseVelocity(enemy, moveX, moveY, 0.82, { nav, deltaMs });

  return { targetX: goalX, targetY: goalY, targetKind };
};