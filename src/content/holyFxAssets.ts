import type Phaser from "phaser";

/** Holy VFX pack 01 — Peter-approved combat FX under `public/assets/combat/fx/holy/`. */

export const HOLY_FX_ROOT = "assets/combat/fx/holy";

export const HOLY_FX_ASSETS = [
  {
    key: "fx_holy_impact",
    file: "holy-vfx-01-impact.png",
    frameWidth: 32,
    frameHeight: 32,
  },
] as const;

export const HOLY_FX_TEXTURE = {
  impact: "fx_holy_impact",
} as const;

export const HOLY_FX_ANIM = {
  flashImpact: "holy_flash_impact",
} as const;

/** World-pixel display size for holy pack 01 flash (subtle, not a full beam). */
export const HOLY_FX_FLASH_DISPLAY_PX = 68;
/** Peak ADD alpha for holy flash sprite overlay. */
export const HOLY_FX_FLASH_ALPHA = 0.48;

/** Frames: Holy VFX 01 Impact strip (7×32px). Heal channel uses PVFX `holy/regen-aura`. */
export function registerHolyFxAnimations(scene: Phaser.Scene): void {
  if (
    scene.textures.exists(HOLY_FX_TEXTURE.impact) &&
    !scene.anims.exists(HOLY_FX_ANIM.flashImpact)
  ) {
    scene.anims.create({
      key: HOLY_FX_ANIM.flashImpact,
      frames: scene.anims.generateFrameNumbers(HOLY_FX_TEXTURE.impact, {
        start: 0,
        end: 6,
      }),
      frameRate: 14,
      repeat: 0,
    });
  }
}
