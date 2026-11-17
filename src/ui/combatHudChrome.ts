import Phaser from "phaser";
import {
  defensePlayAreaLayout,
  type SafeInsets,
} from "./screenLayout";

export type CombatHudChrome = {
  roots: Phaser.GameObjects.GameObject[];
  setVisible: (visible: boolean) => void;
};

const PANEL_FILL = 0x0c0c0e;
const PANEL_ALPHA = 0.94;
const BORDER = 0xffffff;

/** Top/bottom UI bands (status + spell row) with white borders; world draws between them. */
/** Behind HUD controls (status, minimap, spell row, combat buttons) — layout unchanged. */
export function createCombatHudChrome(
  scene: Phaser.Scene,
  safe: SafeInsets,
  depth = 1,
): CombatHudChrome {
  const play = defensePlayAreaLayout(scene, safe);
  const w = scene.scale.width;
  const h = scene.scale.height;
  const g = scene.add.graphics().setScrollFactor(0).setDepth(depth);

  g.fillStyle(PANEL_FILL, PANEL_ALPHA);
  g.fillRect(0, 0, w, play.topBandBottom);
  const bottomH = h - play.bottomBandTop;
  g.fillRect(0, play.bottomBandTop, w, bottomH);

  g.lineStyle(2, BORDER, 1);
  if (play.topBandBottom > 1) {
    g.strokeRect(0.5, 0.5, w - 1, play.topBandBottom - 1);
  }
  if (bottomH > 1) {
    g.strokeRect(0.5, play.bottomBandTop + 0.5, w - 1, bottomH - 1);
  }
  g.beginPath();
  g.moveTo(0, play.bottomBandTop + 0.5);
  g.lineTo(w, play.bottomBandTop + 0.5);
  g.strokePath();

  return {
    roots: [g],
    setVisible: (visible) => {
      g.setVisible(visible);
    },
  };
}