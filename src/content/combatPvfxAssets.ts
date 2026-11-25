import Phaser from "phaser";

/** PVFX Foundry (CC0) combat sheets under `public/assets/combat/fx/pvfx/`. */

export const PVFX_FX_ROOT = "assets/combat/fx/pvfx";

/** Right-facing flight sprites use travel angle only (IMPORTING.md). */
export const PVFX_RIGHT_FACING_ROT_OFFSET = 0;

export const PVFX_FX_ASSETS = [
  {
    key: "fx_pvfx_meteor_strike",
    file: "fire-meteor-strike.png",
    frameWidth: 96,
    frameHeight: 96,
    frameCount: 26,
    frameRate: 1000 / 60,
  },
  {
    key: "fx_pvfx_ice_shatter",
    file: "ice-ice-shatter.png",
    frameWidth: 100,
    frameHeight: 64,
    frameCount: 23,
    frameRate: 1000 / 70,
  },
  {
    key: "fx_pvfx_arrow_flight",
    file: "projectiles-arrow-flight.png",
    frameWidth: 51,
    frameHeight: 15,
    frameCount: 8,
    frameRate: 1000 / 60,
  },
  {
    key: "fx_pvfx_fireball_flight",
    file: "projectiles-fireball-flight.png",
    frameWidth: 72,
    frameHeight: 32,
    frameCount: 6,
    frameRate: 1000 / 70,
  },
  {
    key: "fx_pvfx_lightning_flight",
    file: "projectiles-lightning-bolt-flight.png",
    frameWidth: 72,
    frameHeight: 32,
    frameCount: 10,
    frameRate: 1000 / 60,
  },
] as const;

export const PVFX_TEXTURE = {
  meteorStrike: "fx_pvfx_meteor_strike",
  iceShatter: "fx_pvfx_ice_shatter",
  arrowFlight: "fx_pvfx_arrow_flight",
  fireballFlight: "fx_pvfx_fireball_flight",
  lightningFlight: "fx_pvfx_lightning_flight",
} as const;

export const PVFX_ANIM = {
  meteorStrike: "pvfx_meteor_strike",
  iceShatterStunLoop: "pvfx_ice_shatter_stun_loop",
  iceShatterRelease: "pvfx_ice_shatter_release",
  arrowFlight: "pvfx_arrow_flight",
  fireballFlight: "pvfx_fireball_flight",
  lightningFlight: "pvfx_lightning_flight",
} as const;

export const PVFX_ICE_SHATTER_STUN_LOOP_FRAMES = 3;

const PVFX_RIGHT_FACING_TEXTURES = new Set<string>([
  PVFX_TEXTURE.arrowFlight,
  PVFX_TEXTURE.fireballFlight,
  PVFX_TEXTURE.lightningFlight,
]);

const SPELL_PVFX_PROJECTILE_TEXTURE: Partial<Record<string, string>> = {
  fire_bolt: PVFX_TEXTURE.fireballFlight,
  lightning_bolt: PVFX_TEXTURE.lightningFlight,
  chain_lightning: PVFX_TEXTURE.lightningFlight,
};

const ENEMY_PVFX_PROJECTILE_TEXTURE: Partial<Record<string, string>> = {
  sentry_archer: PVFX_TEXTURE.arrowFlight,
};

export function pvfxPackLoaded(scene: Phaser.Scene): boolean {
  return PVFX_FX_ASSETS.every((a) => scene.textures.exists(a.key));
}

export function projectileTextureRotationOffset(textureKey: string): number | undefined {
  if (PVFX_RIGHT_FACING_TEXTURES.has(textureKey)) return PVFX_RIGHT_FACING_ROT_OFFSET;
  return undefined;
}

export function spellProjectileTextureKey(
  scene: Phaser.Scene,
  spellId: string,
  fallbackTextureKey: string,
): string {
  if (!pvfxPackLoaded(scene)) return fallbackTextureKey;
  const prefer = SPELL_PVFX_PROJECTILE_TEXTURE[spellId];
  if (prefer && scene.textures.exists(prefer)) return prefer;
  return fallbackTextureKey;
}

export function enemyProjectileTextureKey(
  scene: Phaser.Scene,
  enemyDefId: string,
  fallbackTextureKey: string,
): string {
  if (!pvfxPackLoaded(scene)) return fallbackTextureKey;
  const prefer = ENEMY_PVFX_PROJECTILE_TEXTURE[enemyDefId];
  if (prefer && scene.textures.exists(prefer)) return prefer;
  return fallbackTextureKey;
}

export function registerCombatPvfxAnimations(scene: Phaser.Scene): void {
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

  const meteor = PVFX_FX_ASSETS.find((a) => a.key === PVFX_TEXTURE.meteorStrike)!;
  createOnce(
    PVFX_ANIM.meteorStrike,
    PVFX_TEXTURE.meteorStrike,
    0,
    meteor.frameCount - 1,
    meteor.frameRate,
    0,
  );

  const shatter = PVFX_FX_ASSETS.find((a) => a.key === PVFX_TEXTURE.iceShatter)!;
  createOnce(
    PVFX_ANIM.iceShatterStunLoop,
    PVFX_TEXTURE.iceShatter,
    0,
    PVFX_ICE_SHATTER_STUN_LOOP_FRAMES - 1,
    shatter.frameRate,
    -1,
  );
  createOnce(
    PVFX_ANIM.iceShatterRelease,
    PVFX_TEXTURE.iceShatter,
    PVFX_ICE_SHATTER_STUN_LOOP_FRAMES,
    shatter.frameCount - 1,
    shatter.frameRate,
    0,
  );

  for (const flightKey of [
    PVFX_TEXTURE.arrowFlight,
    PVFX_TEXTURE.fireballFlight,
    PVFX_TEXTURE.lightningFlight,
  ] as const) {
    const entry = PVFX_FX_ASSETS.find((a) => a.key === flightKey)!;
    const animKey =
      flightKey === PVFX_TEXTURE.arrowFlight
        ? PVFX_ANIM.arrowFlight
        : flightKey === PVFX_TEXTURE.fireballFlight
          ? PVFX_ANIM.fireballFlight
          : PVFX_ANIM.lightningFlight;
    createOnce(animKey, flightKey, 0, entry.frameCount - 1, entry.frameRate, -1);
  }
}