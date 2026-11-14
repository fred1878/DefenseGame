import Phaser from "phaser";
import { UI_NINE_SLICE, UI_TEXTURE } from "../config/assets";
import { readSafeInsets, bottomHudStripLayout } from "./screenLayout";

export type CombatHudChrome = {
  roots: Phaser.GameObjects.GameObject[];
  setVisible: (visible: boolean) => void;
};

/** Horizontal Gothic bottom strip (defense) — not the tall town column asset. */
export function createCombatHudChrome(
  scene: Phaser.Scene,
  depth = 45,
): CombatHudChrome {
  const safe = readSafeInsets();
  const w = scene.scale.width;
  const { stripH, stripCenterY } = bottomHudStripLayout(scene, safe);
  const slice = UI_NINE_SLICE.bottomStrip;

  const bottomStrip = scene.add.nineslice(
    w / 2,
    stripCenterY,
    UI_TEXTURE.bottomStrip,
    undefined,
    w,
    stripH,
    slice.left,
    slice.right,
    slice.top,
    slice.bottom,
  );
  bottomStrip.setScrollFactor(0).setDepth(depth);

  return {
    roots: [bottomStrip],
    setVisible: (visible) => {
      bottomStrip.setVisible(visible);
    },
  };
}