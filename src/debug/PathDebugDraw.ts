import Phaser from "phaser";
import type { DefenseObstacleRect } from "../config";
import type { EnemyInstance } from "../entities/Enemy";
import type { EnemyTargetKind } from "../ai/EnemyBrain";
import type { NavGrid } from "../pathfinding/grid";

const PATH_COLOR = 0x38bdf8;
const WALL_TARGET = 0xf97316;
const PLAYER_TARGET = 0x22c55e;
const BLOCKED_CELL_FILL = 0x334155;
const BLOCKED_CELL_LINE = 0x64748b;
const OBSTACLE_RECT_LINE = 0x38bdf8;

export class PathDebugDraw {
  private readonly g: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(28);
  }

  clear(): void {
    this.g.clear();
  }

  destroy(): void {
    this.g.destroy();
  }

  /** Nav cells marked blocked by `buildNavGrid` plus obstacle collider rects. */
  drawObstacleZones(grid: NavGrid, obstacles: DefenseObstacleRect[]): void {
    const { cellSize, cols, rows, minX, minY, blocked } = grid;
    this.g.fillStyle(BLOCKED_CELL_FILL, 0.38);
    this.g.lineStyle(1, BLOCKED_CELL_LINE, 0.45);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (blocked[row * cols + col] !== 1) continue;
        const x = minX + col * cellSize;
        const y = minY + row * cellSize;
        this.g.fillRect(x, y, cellSize, cellSize);
        this.g.strokeRect(x + 0.5, y + 0.5, cellSize - 1, cellSize - 1);
      }
    }

    this.g.lineStyle(2, OBSTACLE_RECT_LINE, 0.65);
    for (const obs of obstacles) {
      const left = obs.x - obs.w / 2;
      const top = obs.y - obs.h / 2;
      this.g.strokeRect(left, top, obs.w, obs.h);
    }
  }

  drawEnemy(
    enemy: EnemyInstance,
    targetKind: EnemyTargetKind,
    targetX: number,
    targetY: number,
  ): void {
    const path = enemy.nav.path;
    if (path.length > 0) {
      this.g.lineStyle(2, PATH_COLOR, 0.75);
      this.g.beginPath();
      this.g.moveTo(enemy.sprite.x, enemy.sprite.y);
      for (let i = enemy.nav.pathIndex; i < path.length; i++) {
        const pt = path[i]!;
        this.g.lineTo(pt.x, pt.y);
      }
      this.g.strokePath();
    }

    const color = targetKind === "wall" ? WALL_TARGET : PLAYER_TARGET;
    this.g.fillStyle(color, 0.9);
    this.g.fillCircle(targetX, targetY, 6);
    this.g.lineStyle(1.5, color, 0.5);
    this.g.strokeCircle(targetX, targetY, 10);
  }
}