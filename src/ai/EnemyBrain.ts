import { DEFENSE_MAP } from "../config";
import { worldUnit } from "../core/worldPixelScale";
import type { NavGrid, NavPeerAgent } from "../pathfinding/grid";
import type { EnemyInstance } from "../entities/Enemy";
import { getEnemyBehavior } from "./behaviors";
import type { EnemyPeerAlly } from "./behaviors/types";
import {
  type EnemyNavState,
  type EnemyObjectiveMode,
  type EnemyTargetKind,
  noteEnemyPathProgress,
} from "./brainShared";

/**
 * Per-frame enemy brain entry point. Shared helpers that behaviours use live
 * in `brainShared.ts`, so `behaviors/*` never import this module (no cycle).
 */
export function updateEnemyBrain(
  enemy: EnemyInstance,
  nav: EnemyNavState,
  grid: NavGrid,
  playerX: number,
  playerY: number,
  deltaMs: number,
  peerAgents?: readonly NavPeerAgent[],
  peerAllies?: readonly EnemyPeerAlly[],
  objective: EnemyObjectiveMode = "defendWall",
): { targetX: number; targetY: number; targetKind: EnemyTargetKind } {
  const reg = enemy.sprite.scene.registry;
  noteEnemyPathProgress(
    nav,
    enemy.sprite.x,
    enemy.sprite.y,
    deltaMs,
    worldUnit(DEFENSE_MAP.pathWaypointRadius, reg),
    DEFENSE_MAP.pathStallMs,
    worldUnit(3, reg),
  );
  const behavior = getEnemyBehavior(enemy.behavior);
  return behavior({
    enemy,
    nav,
    grid,
    playerX,
    playerY,
    deltaMs,
    peerAgents,
    peerAllies,
    objective,
  });
}
