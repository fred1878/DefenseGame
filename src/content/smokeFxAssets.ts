import type Phaser from "phaser";

/** Smoke Effect 01 — Peter-approved combat FX under `public/assets/combat/fx/smoke/`. */

export const SMOKE_FX_ROOT = "assets/combat/fx/smoke";

export const SMOKE_FX_ASSETS = [
  {
    key: "fx_smoke_vfx_a",
    file: "smoke-vfx-a.png",
    frameWidth: 48,
    frameHeight: 32,
  },
  {
    key: "fx_smoke_vfx_b",
    file: "smoke-vfx-b.png",
    frameWidth: 64,
    frameHeight: 64,
  },
] as const;

export const SMOKE_FX_TEXTURE = {
  smokeA: "fx_smoke_vfx_a",
  smokeB: "fx_smoke_vfx_b",
} as const;

export const SMOKE_FX_ANIM = {
  /** Smoke A one-shot (9×48×32) — authored facing +X (charge right). */
  chargeStart: "smoke_vfx_a_charge",
  /** Smoke B one-shot (12×64×64) — lob / ground blast. */
  lobImpact: "smoke_vfx_b_lob_impact",
} as const;

export const SMOKE_FX_A_FRAME_COUNT = 9;
export const SMOKE_FX_A_FRAME_RATE = 10;
export const SMOKE_FX_A_DISPLAY_W_PX = 48;
export const SMOKE_FX_A_DISPLAY_H_PX = 32;
export const SMOKE_FX_A_ALPHA = 0.92;

export const SMOKE_FX_B_FRAME_COUNT = 12;
export const SMOKE_FX_B_FRAME_RATE = 10;
export const SMOKE_FX_B_DISPLAY_PX = 64;
export const SMOKE_FX_B_ALPHA = 0.9;

export function smokeFxPackLoaded(scene: Phaser.Scene): boolean {
  return SMOKE_FX_ASSETS.every((a) => scene.textures.exists(a.key));
}

export function registerSmokeFxAnimations(scene: Phaser.Scene): void {
  const createOnce = (
    key: string,
    texture: string,
    start: number,
    end: number,
    frameRate: number,
  ) => {
    if (!scene.textures.exists(texture) || scene.anims.exists(key)) return;
    scene.anims.create({
      key,
      frames: scene.anims.generateFrameNumbers(texture, { start, end }),
      frameRate,
      repeat: 0,
    });
  };

  createOnce(
    SMOKE_FX_ANIM.chargeStart,
    SMOKE_FX_TEXTURE.smokeA,
    0,
    SMOKE_FX_A_FRAME_COUNT - 1,
    SMOKE_FX_A_FRAME_RATE,
  );
  createOnce(
    SMOKE_FX_ANIM.lobImpact,
    SMOKE_FX_TEXTURE.smokeB,
    0,
    SMOKE_FX_B_FRAME_COUNT - 1,
    SMOKE_FX_B_FRAME_RATE,
  );
}