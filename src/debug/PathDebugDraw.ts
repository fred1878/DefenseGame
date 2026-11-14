import Phaser from "phaser";
import type { EnemyInstance } from "../entities/Enemy";
import type { EnemyTargetKind } from "../ai/EnemyBrain";

const PATH_COLOR = 0x38bdf8;
const WALL_TARGET = 0xf97316;
const PLAYER_TARGET = 0x22c55e;

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