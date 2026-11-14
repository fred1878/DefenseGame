import Phaser from "phaser";
import { UI_NINE_SLICE, UI_TEXTURE } from "../config/assets";
import { scaleUiX, scaleUiY } from "../core/displayScale";
import { SPELL_BAR } from "../config/spells";
import { readSafeInsets, spellBarCenterY } from "./screenLayout";

export type CombatHudChrome = {
  roots: Phaser.GameObjects.GameObject[];
  setVisible: (visible: boolean) => void;
};

/** Decorative medieval HUD backing — below interactive controls (depth < 200). */
export function createCombatHudChrome(
  scene: Phaser.Scene,
  depth = 45,
): CombatHudChrome {
  const safe = readSafeInsets();
  const w = scene.scale.width;
  const h = scene.scale.height;
  const strip = UI_NINE_SLICE.bottomStrip;
  const stripH = scaleUiY(140);
  const bottomY = h - safe.bottom - stripH / 2;

  const bottomStrip = scene.add.nineslice(
    w / 2,
    bottomY,
    UI_TEXTURE.bottomStrip,
    undefined,
    w,
    stripH,
    strip.left,
    strip.right,
    strip.top,
    strip.bottom,
  );
  bottomStrip.setScrollFactor(0).setDepth(depth);

  const spellY = spellBarCenterY(scene, safe, SPELL_BAR.slotSizePx);
  const slotCount = SPELL_BAR.slotCount;
  const barW =
    slotCount * SPELL_BAR.slotSizePx + (slotCount - 1) * SPELL_BAR.slotGapPx;
  const compact = UI_NINE_SLICE.panelCompact;
  const barPadX = scaleUiX(28);
  const barPadY = scaleUiY(16);
  const spellPanel = scene.add.nineslice(
    w / 2,
    spellY,
    UI_TEXTURE.panelCompact,
    undefined,
    barW + barPadX,
    SPELL_BAR.slotSizePx + barPadY,
    compact.left,
    compact.right,
    compact.top,
    compact.bottom,
  );
  spellPanel.setScrollFactor(0).setDepth(depth + 1);

  const roots = [bottomStrip, spellPanel];
  return {
    roots,
    setVisible: (visible) => {
      for (const r of roots) r.setVisible(visible);
    },
  };
}
