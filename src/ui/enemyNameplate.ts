import Phaser from "phaser";
import { DEFENSE_RENDER_DEPTH } from "../config";
import { scaleUiX, scaleUiY } from "../core/displayScale";
import type { Damageable } from "../combat/DamageSystem";
import { uiSmallLabelShadow, uiTextStyle } from "./uiTextStyle";

export type EnemyNameplate = {
  container: Phaser.GameObjects.Container;
  nameText: Phaser.GameObjects.Text;
  hpText: Phaser.GameObjects.Text;
  barGfx: Phaser.GameObjects.Graphics;
  barW: number;
  barH: number;
  barY: number;
  dying: boolean;
};

function plateOffsetY(spriteDisplaySide: number): number {
  return -spriteDisplaySide * 0.55 - scaleUiY(10);
}

export function createEnemyNameplate(
  scene: Phaser.Scene,
  x: number,
  y: number,
  displayName: string,
  spriteDisplaySide: number,
): EnemyNameplate {
  const barW = scaleUiX(52);
  const barH = Math.max(3, scaleUiY(4));
  const gap = scaleUiY(3);
  const nameStyle = uiTextStyle(scene, {
    fontSize: `${scaleUiX(11)}px`,
    color: "#f4f4f5",
    align: "center",
    shadow: uiSmallLabelShadow(),
  });
  const hpStyle = uiTextStyle(scene, {
    fontSize: `${scaleUiX(10)}px`,
    color: "#d4d4d8",
    align: "center",
    shadow: uiSmallLabelShadow(),
  });

  const nameText = scene.add.text(0, 0, displayName, nameStyle).setOrigin(0.5, 1);
  const barY = gap;
  const hpY = barY + barH + gap;
  const hpText = scene.add.text(0, hpY, "", hpStyle).setOrigin(0.5, 0);
  const barGfx = scene.add.graphics();

  const oy = plateOffsetY(spriteDisplaySide);
  const container = scene.add
    .container(x, y + oy, [nameText, barGfx, hpText])
    .setDepth(DEFENSE_RENDER_DEPTH.enemyNameplate);

  return {
    container,
    nameText,
    hpText,
    barGfx,
    barW,
    barH,
    barY,
    dying: false,
  };
}

function drawHpBar(plate: EnemyNameplate, ratio: number): void {
  const { barGfx, barW, barH, barY } = plate;
  barGfx.clear();
  const x0 = -barW / 2;
  const y0 = barY;
  barGfx.fillStyle(0x27272a, 0.92);
  barGfx.fillRect(x0, y0, barW, barH);
  const fillW = Math.max(0, Math.min(1, ratio)) * barW;
  if (fillW > 0) {
    barGfx.fillStyle(0xef4444, 1);
    barGfx.fillRect(x0, y0, fillW, barH);
    barGfx.fillStyle(0x4ade80, 1);
    barGfx.fillRect(x0, y0, fillW * Math.min(1, ratio + 0.05), barH);
  }
  barGfx.lineStyle(1, 0x52525b, 1);
  barGfx.strokeRect(x0, y0, barW, barH);
}

export function updateEnemyNameplate(
  plate: EnemyNameplate,
  x: number,
  y: number,
  spriteDisplaySide: number,
  damageable: Damageable,
  alpha = 1,
): void {
  if (plate.dying) return;
  const oy = plateOffsetY(spriteDisplaySide);
  plate.container.setPosition(x, y + oy);
  plate.container.setAlpha(alpha);
  const hp = Math.max(0, Math.floor(damageable.hp));
  const maxHp = Math.max(1, Math.floor(damageable.maxHp));
  plate.hpText.setText(`${hp}/${maxHp}`);
  drawHpBar(plate, hp / maxHp);
}

/** Fade nameplate on death, then stash hidden for the inactive pool (PR12). */
export function recycleEnemyNameplateAfterDeath(
  plate: EnemyNameplate | undefined,
  scene: Phaser.Scene,
  onComplete: () => void,
): void {
  if (!plate || plate.dying) {
    onComplete();
    return;
  }
  plate.dying = true;
  scene.tweens.killTweensOf(plate.container);
  scene.tweens.add({
    targets: plate.container,
    alpha: 0,
    duration: 160,
    ease: "Quad.Out",
    onComplete: () => {
      stashEnemyNameplateForPool(plate, scene);
      onComplete();
    },
  });
}

/** Kill death tweens and hide until the shell respawns from the pool. */
export function stashEnemyNameplateForPool(
  plate: EnemyNameplate,
  scene: Phaser.Scene,
): void {
  scene.tweens.killTweensOf(plate.container);
  plate.dying = false;
  plate.container.setAlpha(0);
  plate.container.setVisible(false);
}

/** Call when reconfiguring a pooled enemy so nameplate sync cannot be skipped. */
export function prepareEnemyNameplateForRespawn(
  plate: EnemyNameplate,
  scene: Phaser.Scene,
): void {
  stashEnemyNameplateForPool(plate, scene);
  plate.container.setVisible(true);
  plate.container.setAlpha(1);
}

export function destroyEnemyNameplate(plate: EnemyNameplate | undefined): void {
  if (!plate) return;
  plate.container.destroy(true);
}