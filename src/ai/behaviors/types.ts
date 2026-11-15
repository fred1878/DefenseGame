import type { NavGrid } from "../../pathfinding/grid";
import type { EnemyInstance } from "../../entities/Enemy";
import type { EnemyNavState, EnemyTargetKind } from "../EnemyBrain";

export type BehaviorMoveResult = {
  targetX: number;
  targetY: number;
  targetKind: EnemyTargetKind;
};

export type EnemyBehaviorContext = {
  enemy: EnemyInstance;
  nav: EnemyNavState;
  grid: NavGrid;
  playerX: number;
  playerY: number;
  deltaMs: number;
  peerAgents?: readonly { x: number; y: number }[];
};

export type EnemyBehavior = (ctx: EnemyBehaviorContext) => BehaviorMoveResult;