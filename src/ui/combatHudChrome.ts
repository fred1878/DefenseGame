import type Phaser from "phaser";
import {
  defensePlayAreaLayout,
  defenseTopChromeHeight,
  type SafeInsets,
} from "./screenLayout";
import { addUiFrame } from "./uiFrame";

export type CombatHudChrome = {
  roots: Phaser.GameObjects.GameObject[];
  setVisible: (visible: boolean) => void;
};

const PANEL_FILL = 0x15110f;
const PANEL_ALPHA = 0.96;
const BORDER = 0x6b5532;

/** Top/bottom screen bands behind HUD; world draws only in the middle play area. */
export function createCombatHudChrome(
  scene: Phaser.Scene,
  safe: SafeInsets,
  depth = 40,
): CombatHudChrome {
  const play = defensePlayAreaLayout(scene, safe);
  const w = scene.scale.width;
  const h = scene.scale.height;
  const topH = defenseTopChromeHeight(safe.top);
  const bottomY = play.bottomBandTop;
  const bottomH = Math.max(0, h - bottomY);

  const topPanel = scene.add
    .rectangle(w / 2, topH / 2, w, topH, PANEL_FILL, PANEL_ALPHA)
    .setScrollFactor(0)
    .setDepth(depth);

  const bottomPanel = scene.add
    .rectangle(
      w / 2,
      bottomY + bottomH / 2,
      w,
      bottomH,
      PANEL_FILL,
      PANEL_ALPHA,
    )
    .setScrollFactor(0)
    .setDepth(depth);

  const border = scene.add
    .graphics()
    .setScrollFactor(0)
    .setDepth(depth + 1);
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

  const roots: Phaser.GameObjects.GameObject[] = [
    topPanel,
    bottomPanel,
    border,
  ];
  // Dark Ages frames over the vector bands (no-op without the textures, e.g. unit tests).
  const frames = [
    topH > 1 ? addUiFrame(scene, "ornate", 0, 0, w, topH) : null,
    bottomH > 1 ? addUiFrame(scene, "dark", 0, bottomY, w, bottomH) : null,
  ];
  for (const f of frames) {
    if (!f) continue;
    f.setScrollFactor(0).setDepth(depth + 1);
    roots.push(f);
  }
  return {
    roots,
    setVisible: (visible) => {
      for (const root of roots) {
        (
          root as Phaser.GameObjects.GameObject & {
            setVisible: (v: boolean) => unknown;
          }
        ).setVisible(visible);
      }
    },
  };
}
