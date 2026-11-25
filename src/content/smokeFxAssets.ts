import Phaser from "phaser";

/** Smoke Effect 01 — Peter-approved combat FX under `public/assets/combat/fx/smoke/`. */

export const SMOKE_FX_ROOT = "assets/combat/fx/smoke";

export const SMOKE_FX_ASSETS = [
  {
    key: "fx_smoke_vfx_a",
    file: "smoke-vfx-a.png",
    frameWidth: 48,
    frameHeight: 32,
  },
] as const;

export const SMOKE_FX_TEXTURE = {
  smokeA: "fx_smoke_vfx_a",
} as const;

export const SMOKE_FX_ANIM = {
  /** Smoke A one-shot (9×48×32) — authored facing +X (charge right). */
  chargeStart: "smoke_vfx_a_charge",
} as const;

export const SMOKE_FX_A_FRAME_COUNT = 9;
export const SMOKE_FX_A_FRAME_RATE = 10;
export const SMOKE_FX_A_DISPLAY_W_PX = 48;
export const SMOKE_FX_A_DISPLAY_H_PX = 32;
export const SMOKE_FX_A_ALPHA = 0.92;

export function smokeFxPackLoaded(scene: Phaser.Scene): boolean {
  return SMOKE_FX_ASSETS.every((a) => scene.textures.exists(a.key));
}

export function registerSmokeFxAnimations(scene: Phaser.Scene): void {
  const { smokeA } = SMOKE_FX_TEXTURE;
  const { chargeStart } = SMOKE_FX_ANIM;
  if (!scene.textures.exists(smokeA) || scene.anims.exists(chargeStart)) return;
  scene.anims.create({
    key: chargeStart,
    frames: scene.anims.generateFrameNumbers(smokeA, {
      start: 0,
      end: SMOKE_FX_A_FRAME_COUNT - 1,
    }),
    frameRate: SMOKE_FX_A_FRAME_RATE,
    repeat: 0,
  });
}