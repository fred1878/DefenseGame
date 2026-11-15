import Phaser from "phaser";
import {
  DEFENSE_FIELD_TILES,
  defenseHalfHeight,
  defenseHalfWidth,
} from "../config";
import { scaleUiX, scaleUiY } from "../core/displayScale";
import type { EnemyInstance } from "../entities/Enemy";
import type { SafeInsets, ScreenRect } from "./screenLayout";
import { hudTextPosition } from "./screenLayout";

const BORDER_COLOR = 0xffffff;
const PLAYER_DOT = 0xffffff;
const ENEMY_DOT = 0xef4444;
const MINIMAP_DEPTH = 205;

export type DefenseMinimapLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Top-right minimap frame — below the multi-line HUD copy, inset from safe area. */
export function defenseMinimapLayout(
  scene: Phaser.Scene,
  safe: SafeInsets,
): DefenseMinimapLayout {
  const margin = scaleUiX(12);
  const width = scaleUiX(76);
  const height = Math.round(
    width * (DEFENSE_FIELD_TILES.rows / DEFENSE_FIELD_TILES.cols),
  );
  const textTop = hudTextPosition(safe);
  const textBlockH = scaleUiY(78);
  return {
    x: scene.scale.width - margin - safe.right - width,
    y: textTop.y + textBlockH + scaleUiY(4),
    width,
    height,
  };
}

export function defenseMinimapScreenRect(
  scene: Phaser.Scene,
  safe: SafeInsets,
): ScreenRect {
  const layout = defenseMinimapLayout(scene, safe);
  return {
    x: layout.x,
    y: layout.y,
    width: layout.width,
    height: layout.height,
  };
}

export function worldToMinimapPoint(
  worldX: number,
  worldY: number,
  layout: DefenseMinimapLayout,
): { x: number; y: number } {
  const halfW = defenseHalfWidth();
  const halfH = defenseHalfHeight();
  const fieldW = halfW * 2;
  const fieldH = halfH * 2;
  const inset = scaleUiX(4);
  const innerW = Math.max(1, layout.width - inset * 2);
  const innerH = Math.max(1, layout.height - inset * 2);
  const nx = Math.min(1, Math.max(0, (worldX + halfW) / fieldW));
  const ny = Math.min(1, Math.max(0, (worldY + halfH) / fieldH));
  return {
    x: layout.x + inset + nx * innerW,
    y: layout.y + inset + ny * innerH,
  };
}

export class DefenseMinimap {
  private readonly g: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.g = scene.add
      .graphics()
      .setScrollFactor(0)
      .setDepth(MINIMAP_DEPTH);
  }

  clear(): void {
    this.g.clear();
  }

  destroy(): void {
    this.g.destroy();
  }

  setVisible(visible: boolean): void {
    this.g.setVisible(visible);
  }

  draw(
    layout: DefenseMinimapLayout,
    playerX: number,
    playerY: number,
    enemies: readonly EnemyInstance[],
  ): void {
    this.g.clear();
    this.g.lineStyle(1.5, BORDER_COLOR, 1);
    this.g.strokeRect(layout.x, layout.y, layout.width, layout.height);

    const playerDotR = Math.max(2, scaleUiX(2.5));
    const enemyDotR = Math.max(2, scaleUiX(2));

    const pp = worldToMinimapPoint(playerX, playerY, layout);
    this.g.fillStyle(PLAYER_DOT, 1);
    this.g.fillCircle(pp.x, pp.y, playerDotR);

    this.g.fillStyle(ENEMY_DOT, 1);
    for (const e of enemies) {
      if (!e.damageable.alive) continue;
      const pt = worldToMinimapPoint(e.sprite.x, e.sprite.y, layout);
      this.g.fillCircle(pt.x, pt.y, enemyDotR);
    }
  }
}