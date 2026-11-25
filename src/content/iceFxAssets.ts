import type Phaser from "phaser";

/** Ice Effect 01 — Peter-approved combat FX under `public/assets/combat/fx/ice/`. */

export const ICE_FX_ROOT = "assets/combat/fx/ice";

export const ICE_FX_ASSETS = [
  {
    key: "fx_ice_vfx1_start",
    file: "ice-vfx-1-start.png",
    frameWidth: 48,
    frameHeight: 32,
  },
  {
    key: "fx_ice_vfx1_repeatable",
    file: "ice-vfx-1-repeatable.png",
    frameWidth: 48,
    frameHeight: 32,
  },
  {
    key: "fx_ice_vfx1_hit",
    file: "ice-vfx-1-hit.png",
    frameWidth: 48,
    frameHeight: 32,
  },
  {
    key: "fx_ice_vfx2_start",
    file: "ice-vfx-2-start.png",
    frameWidth: 32,
    frameHeight: 32,
  },
  {
    key: "fx_ice_vfx2_active",
    file: "ice-vfx-2-active.png",
    frameWidth: 32,
    frameHeight: 32,
  },
  {
    key: "fx_ice_vfx2_ending",
    file: "ice-vfx-2-ending.png",
    frameWidth: 32,
    frameHeight: 32,
  },
] as const;

export const ICE_FX_TEXTURE = {
  boltStart: "fx_ice_vfx1_start",
  boltRepeat: "fx_ice_vfx1_repeatable",
  boltHit: "fx_ice_vfx1_hit",
  castStart: "fx_ice_vfx2_start",
  rootActive: "fx_ice_vfx2_active",
  rootEnding: "fx_ice_vfx2_ending",
} as const;

export const ICE_FX_ANIM = {
  boltStart: "ice_bolt_vfx1_start",
  boltRepeat: "ice_bolt_vfx1_repeat",
  boltHit: "ice_bolt_vfx1_hit",
  castStart: "ice_vfx2_cast_start",
  rootActive: "ice_vfx2_root_active",
  rootEnding: "ice_vfx2_root_ending",
  /** Ice wall segment despawn — skips first 5 frames of the 18f ending strip. */
  wallEnding: "ice_vfx2_wall_ending",
} as const;

export const ICE_FX_BOLT_DISPLAY_W_PX = 48;
export const ICE_FX_BOLT_DISPLAY_H_PX = 32;
export const ICE_FX_BOLT_ALPHA = 0.95;
export const ICE_FX_CAST_START_DISPLAY_PX = 56;
export const ICE_FX_CAST_START_ALPHA = 0.72;
export const ICE_FX_ROOT_DISPLAY_PX = 52;
export const ICE_FX_ROOT_ALPHA = 0.88;

const BOLT_START_FRAMES = 3;
const BOLT_REPEAT_FRAMES = 10;
const BOLT_HIT_FRAMES = 8;
const CAST_START_FRAMES = 9;
const ROOT_ACTIVE_FRAMES = 8;
const ROOT_ENDING_FRAMES = 18;
/** Peter pick: wall timeout starts at frame index 5. */
const WALL_ENDING_FIRST_FRAME = 5;

export function iceFxPackLoaded(scene: Phaser.Scene): boolean {
  return ICE_FX_ASSETS.every((a) => scene.textures.exists(a.key));
}

function iceFxAnimsReady(scene: Phaser.Scene): boolean {
  return Object.values(ICE_FX_ANIM).every(
    (key) => scene.anims?.exists(key) ?? false,
  );
}

/** Require full ice pack + registered anims — no MobileRPG spell-slice fallback. */
export function assertIceCombatFxReady(
  scene: Phaser.Scene,
  context: string,
): void {
  const missingTextures = ICE_FX_ASSETS.filter(
    (a) => !scene.textures.exists(a.key),
  ).map((a) => a.key);
  const missingAnims = Object.values(ICE_FX_ANIM).filter(
    (key) => !(scene.anims?.exists(key) ?? false),
  );
  if (missingTextures.length === 0 && missingAnims.length === 0) return;
  throw new Error(
    `Ice combat FX not ready (${context}): missing textures [${missingTextures.join(", ")}]; missing anims [${missingAnims.join(", ")}]`,
  );
}

export function registerIceFxAnimations(scene: Phaser.Scene): void {
  const createOnce = (
    key: string,
    texture: string,
    start: number,
    end: number,
    frameRate: number,
    repeat: number,
  ) => {
    if (!scene.textures.exists(texture) || scene.anims.exists(key)) return;
    scene.anims.create({
      key,
      frames: scene.anims.generateFrameNumbers(texture, { start, end }),
      frameRate,
      repeat,
    });
  };

  createOnce(
    ICE_FX_ANIM.boltStart,
    ICE_FX_TEXTURE.boltStart,
    0,
    BOLT_START_FRAMES - 1,
    13,
    0,
  );
  createOnce(
    ICE_FX_ANIM.boltRepeat,
    ICE_FX_TEXTURE.boltRepeat,
    0,
    BOLT_REPEAT_FRAMES - 1,
    12,
    -1,
  );
  createOnce(
    ICE_FX_ANIM.boltHit,
    ICE_FX_TEXTURE.boltHit,
    0,
    BOLT_HIT_FRAMES - 1,
    14,
    0,
  );
  createOnce(
    ICE_FX_ANIM.castStart,
    ICE_FX_TEXTURE.castStart,
    0,
    CAST_START_FRAMES - 1,
    12,
    0,
  );
  createOnce(
    ICE_FX_ANIM.rootActive,
    ICE_FX_TEXTURE.rootActive,
    0,
    ROOT_ACTIVE_FRAMES - 1,
    12,
    0,
  );
  createOnce(
    ICE_FX_ANIM.rootEnding,
    ICE_FX_TEXTURE.rootEnding,
    0,
    ROOT_ENDING_FRAMES - 1,
    12,
    0,
  );
  createOnce(
    ICE_FX_ANIM.wallEnding,
    ICE_FX_TEXTURE.rootEnding,
    WALL_ENDING_FIRST_FRAME,
    ROOT_ENDING_FRAMES - 1,
    12,
    0,
  );

  if (iceFxPackLoaded(scene) && !iceFxAnimsReady(scene)) {
    throw new Error(
      "Ice FX textures loaded but Phaser animations were not registered",
    );
  }
}