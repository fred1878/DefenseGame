import Phaser from "phaser";
import { UI_NINE_SLICE, UI_TEXTURE } from "../config/assets";
import { readSafeInsets, bottomHudStripLayout } from "./screenLayout";

export type CombatHudChrome = {
  roots: Phaser.GameObjects.GameObject[];
  setVisible: (visible: boolean) => void;
};

/** Gothic bottom HUD — same tall panel art as Town, cropped to strip geometry. */
export function createCombatHudChrome(
  scene: Phaser.Scene,
  depth = 45,
): CombatHudChrome {
  const safe = readSafeInsets();
  const w = scene.scale.width;
  const { stripH, stripCenterY } = bottomHudStripLayout(scene, safe);
  const slice = UI_NINE_SLICE.panelTallBottomBar;

  const bottomPanel = scene.add.nineslice(
    w / 2,
    stripCenterY,
    UI_TEXTURE.panelTall,
    undefined,
    w,
    stripH,
    slice.left,
    slice.right,
    slice.top,
    slice.bottom,
  );
  bottomPanel.setScrollFactor(0).setDepth(depth);

  return {
    roots: [bottomPanel],
    setVisible: (visible) => {
      bottomPanel.setVisible(visible);
    },
  };
}