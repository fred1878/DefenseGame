import type Phaser from "phaser";
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

/** 1px dark outline for small labels over world art (#381 / mockup). */
const PLATE_STROKE = "#0b0806";

export function createEnemyNameplate(
  scene: Phaser.Scene,
  x: number,
  y: number,
  displayName: string,
  spriteDisplaySide: number,
): EnemyNameplate {
  const barW = scaleUiX(60);
  const barH = Math.max(12, scaleUiY(10));
  const gap = scaleUiY(2);
  const nameStyle = uiTextStyle(scene, {
    fontSize: `${scaleUiX(10)}px`,
    color: "#f4ead8",
    align: "center",
    stroke: PLATE_STROKE,
    strokeThickness: 3,
    shadow: uiSmallLabelShadow(),
  });
  const hpStyle = uiTextStyle(scene, {
    fontSize: "12px",
    color: "#fdf6e3",
    align: "center",
    stroke: PLATE_STROKE,
    strokeThickness: 3,
  });

  const nameText = scene.add
    .text(0, 0, displayName, nameStyle)
    .setOrigin(0.5, 1);
  const barY = gap;
  // HP digits sit inside the bar, WoW nameplate style.
  const hpText = scene.add
    .text(0, barY + barH / 2, "", hpStyle)
    .setOrigin(0.5, 0.5);
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

/** Dark Ages-style bar: dark trough, red fill with a lit top row, gold rim and end caps. */
function drawHpBar(plate: EnemyNameplate, ratio: number): void {
  const { barGfx, barW, barH, barY } = plate;
  barGfx.clear();
  const x0 = Math.round(-barW / 2);
  const y0 = barY;
  barGfx.fillStyle(0x1c0d0b, 0.95);
  barGfx.fillRect(x0, y0, barW, barH);
  const fillW = Math.round(Math.max(0, Math.min(1, ratio)) * (barW - 4));
  if (fillW > 0) {
    barGfx.fillStyle(0x9f1d1d, 1);
    barGfx.fillRect(x0 + 2, y0 + 2, fillW, barH - 4);
    barGfx.fillStyle(0xe0483e, 1);
    barGfx.fillRect(x0 + 2, y0 + 2, fillW, 2);
  }
  barGfx.lineStyle(1, 0x0b0806, 1);
  barGfx.strokeRect(x0 - 1.5, y0 - 1.5, barW + 3, barH + 3);
  barGfx.lineStyle(1, 0xb08a4a, 1);
  barGfx.strokeRect(x0 + 0.5, y0 + 0.5, barW - 1, barH - 1);
  // Gold end caps (diamond-ish studs) like the Dark Ages bar frame.
  barGfx.lineStyle(2, 0xd8b45c, 1);
  barGfx.strokeRect(x0 - 3, y0 + barH / 2 - 2, 3, 4);
  barGfx.strokeRect(x0 + barW, y0 + barH / 2 - 2, 3, 4);
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
