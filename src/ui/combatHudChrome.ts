import Phaser from "phaser";
import {
  defensePlayAreaLayout,
  hudBandHeight,
  type SafeInsets,
} from "./screenLayout";

export type CombatHudChrome = {
  roots: Phaser.GameObjects.GameObject[];
  setVisible: (visible: boolean) => void;
};

const PANEL_FILL = 0xffffff;
const PANEL_ALPHA = 0.38;
const BORDER = 0xffffff;

/** Top/bottom screen bands behind HUD; world draws only in the middle play area. */
export function createCombatHudChrome(
  scene: Phaser.Scene,
  safe: SafeInsets,
  depth = 40,
): CombatHudChrome {
  const play = defensePlayAreaLayout(scene, safe);
  const w = scene.scale.width;
  const h = scene.scale.height;
  const topH = hudBandHeight(safe.top);
  const bottomY = play.bottomBandTop;
  const bottomH = Math.max(0, h - bottomY);

  const topPanel = scene.add
    .rectangle(w / 2, topH / 2, w, topH, PANEL_FILL, PANEL_ALPHA)
    .setScrollFactor(0)
    .setDepth(depth);

  const bottomPanel = scene.add
    .rectangle(w / 2, bottomY + bottomH / 2, w, bottomH, PANEL_FILL, PANEL_ALPHA)
    .setScrollFactor(0)
    .setDepth(depth);

  const border = scene.add.graphics().setScrollFactor(0).setDepth(depth + 1);
  border.lineStyle(2, BORDER, 1);
  if (topH > 1) {
    border.strokeRect(0.5, 0.5, w - 1, topH - 1);
  }
  if (bottomH > 1) {
    border.strokeRect(0.5, bottomY + 0.5, w - 1, bottomH - 1);
  }
  if (bottomY > 0) {
    border.beginPath();
    border.moveTo(0, bottomY + 0.5);
    border.lineTo(w, bottomY + 0.5);
    border.strokePath();
  }

  const roots = [topPanel, bottomPanel, border];
  return {
    roots,
    setVisible: (visible) => {
      for (const root of roots) root.setVisible(visible);
    },
  };
}