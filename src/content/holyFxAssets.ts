import type Phaser from "phaser";

/** Holy VFX pack 01/02 — Peter-approved combat FX under `public/assets/combat/fx/holy/`. */

export const HOLY_FX_ROOT = "assets/combat/fx/holy";

export const HOLY_FX_ASSETS = [
  {
    key: "fx_holy_impact",
    file: "holy-vfx-01-impact.png",
    frameWidth: 32,
    frameHeight: 32,
  },
  {
    key: "fx_holy_channel",
    file: "holy-vfx-02-loop.png",
    frameWidth: 48,
    frameHeight: 48,
  },
] as const;

export const HOLY_FX_TEXTURE = {
  impact: "fx_holy_impact",
  channel: "fx_holy_channel",
} as const;

export const HOLY_FX_ANIM = {
  flashImpact: "holy_flash_impact",
  channelLoop: "holy_channel_loop",
} as const;

/** World-pixel display size for holy pack 01 flash (subtle, not a full beam). */
export const HOLY_FX_FLASH_DISPLAY_PX = 68;
/** Peak ADD alpha for holy flash sprite overlay. */
export const HOLY_FX_FLASH_ALPHA = 0.48;

/** Channel loop sprite diameter = beacon radius × this (still smaller than v1 wired 3.1×). */
export const HOLY_FX_CHANNEL_SPRITE_SCALE = 1.65;
export const HOLY_FX_CHANNEL_ALPHA = 0.42;

/** Frames: Holy VFX 01 Impact strip (7×32px); Holy VFX 02 loop strip (16×48px). */
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
  if (
    scene.textures.exists(HOLY_FX_TEXTURE.channel) &&
    !scene.anims.exists(HOLY_FX_ANIM.channelLoop)
  ) {
    scene.anims.create({
      key: HOLY_FX_ANIM.channelLoop,
      frames: scene.anims.generateFrameNumbers(HOLY_FX_TEXTURE.channel, {
        start: 0,
        end: 15,
      }),
      frameRate: 12,
      repeat: -1,
    });
  }
}
