import type { NavGrid } from "../../pathfinding/grid";
import type { EnemyInstance } from "../../entities/Enemy";
import type {
  EnemyNavState,
  EnemyObjectiveMode,
  EnemyTargetKind,
} from "../EnemyBrain";

export type BehaviorMoveResult = {
  targetX: number;
  targetY: number;
  targetKind: EnemyTargetKind;
};

export type EnemyPeerAlly = {
  id: string;
  behavior: string;
  x: number;
  y: number;
};

export type EnemyBehaviorContext = {
  enemy: EnemyInstance;
  nav: EnemyNavState;
  grid: NavGrid;
  playerX: number;
  playerY: number;
  deltaMs: number;
  peerAgents?: readonly { x: number; y: number }[];
  peerAllies?: readonly EnemyPeerAlly[];
  objective?: EnemyObjectiveMode;
};

export type EnemyBehavior = (ctx: EnemyBehaviorContext) => BehaviorMoveResult;