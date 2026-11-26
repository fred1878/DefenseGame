import type Phaser from "phaser";

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
  {
    key: "fx_pvfx_crit_hit",
    file: "impacts-crit-hit.png",
    frameWidth: 96,
    frameHeight: 80,
    frameCount: 10,
    frameRate: 1000 / 70,
  },
  {
    key: "fx_pvfx_holy_cast",
    file: "holy-holy-cast.png",
    frameWidth: 64,
    frameHeight: 64,
    frameCount: 15,
    frameRate: 1000 / 60,
  },
  {
    key: "fx_pvfx_shadow_cast",
    file: "shadow-shadow-cast.png",
    frameWidth: 64,
    frameHeight: 64,
    frameCount: 12,
    frameRate: 1000 / 70,
  },
  {
    key: "fx_pvfx_flame_ring",
    file: "fire-flame-ring.png",
    frameWidth: 112,
    frameHeight: 80,
    frameCount: 16,
    frameRate: 1000 / 70,
  },
  {
    key: "fx_pvfx_incinerate",
    file: "fire-incinerate.png",
    frameWidth: 64,
    frameHeight: 64,
    frameCount: 18,
    frameRate: 1000 / 70,
  },
  {
    key: "fx_pvfx_fire_pillar",
    file: "fire-fire-pillar.png",
    frameWidth: 64,
    frameHeight: 112,
    frameCount: 24,
    frameRate: 1000 / 70,
  },
  {
    key: "fx_pvfx_ground_flames",
    file: "fire-ground-flames.png",
    frameWidth: 64,
    frameHeight: 40,
    frameCount: 16,
    frameRate: 1000 / 75,
  },
  {
    key: "fx_pvfx_regen_aura",
    file: "holy-regen-aura.png",
    frameWidth: 48,
    frameHeight: 64,
    frameCount: 16,
    frameRate: 1000 / 80,
  },
] as const;

export const PVFX_TEXTURE = {
  meteorStrike: "fx_pvfx_meteor_strike",
  iceShatter: "fx_pvfx_ice_shatter",
  arrowFlight: "fx_pvfx_arrow_flight",
  fireballFlight: "fx_pvfx_fireball_flight",
  lightningFlight: "fx_pvfx_lightning_flight",
  critHit: "fx_pvfx_crit_hit",
  holyCast: "fx_pvfx_holy_cast",
  shadowCast: "fx_pvfx_shadow_cast",
  flameRing: "fx_pvfx_flame_ring",
  incinerate: "fx_pvfx_incinerate",
  firePillar: "fx_pvfx_fire_pillar",
  groundFlames: "fx_pvfx_ground_flames",
  regenAura: "fx_pvfx_regen_aura",
} as const;

export const PVFX_ANIM = {
  meteorStrike: "pvfx_meteor_strike",
  iceShatterStunLoop: "pvfx_ice_shatter_stun_loop",
  iceShatterRelease: "pvfx_ice_shatter_release",
  arrowFlight: "pvfx_arrow_flight",
  fireballFlight: "pvfx_fireball_flight",
  lightningFlight: "pvfx_lightning_flight",
  critHit: "pvfx_crit_hit",
  holyCast: "pvfx_holy_cast",
  shadowCast: "pvfx_shadow_cast",
  flameRing: "pvfx_flame_ring",
  incinerate: "pvfx_incinerate",
  firePillar: "pvfx_fire_pillar",
  groundFlamesLoop: "pvfx_ground_flames_loop",
  regenAuraLoop: "pvfx_regen_aura_loop",
} as const;

export const PVFX_ICE_SHATTER_STUN_LOOP_FRAMES = 3;

/** PVFX `holy/regen-aura` lit cell + gameplay pivot (manifest `pivot`). */
export const PVFX_REGEN_AURA_SOURCE_W = 48;
export const PVFX_REGEN_AURA_SOURCE_H = 64;
export const PVFX_REGEN_AURA_ORIGIN_X = 24 / PVFX_REGEN_AURA_SOURCE_W;
export const PVFX_REGEN_AURA_ORIGIN_Y = 57 / PVFX_REGEN_AURA_SOURCE_H;
/** Sprite display width = beacon radius × this (height keeps 48:64 aspect). */
export const PVFX_REGEN_AURA_CHANNEL_SPRITE_SCALE = 1.65;
export const PVFX_REGEN_AURA_CHANNEL_ALPHA = 0.42;

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

/** Require texture + registered anim — no MobileRPG fallback. */
export function assertPvfxClipReady(
  scene: Phaser.Scene,
  textureKey: string,
  animKey: string,
  context: string,
): void {
  if (!scene.textures.exists(textureKey)) {
    throw new Error(`PVFX texture missing (${context}): ${textureKey}`);
  }
  registerCombatPvfxAnimations(scene);
  if (!(scene.anims?.exists(animKey) ?? false)) {
    throw new Error(`PVFX animation missing (${context}): ${animKey}`);
  }
}

export function projectileTextureRotationOffset(
  textureKey: string,
): number | undefined {
  if (PVFX_RIGHT_FACING_TEXTURES.has(textureKey))
    return PVFX_RIGHT_FACING_ROT_OFFSET;
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

  const meteor = PVFX_FX_ASSETS.find(
    (a) => a.key === PVFX_TEXTURE.meteorStrike,
  )!;
  createOnce(
    PVFX_ANIM.meteorStrike,
    PVFX_TEXTURE.meteorStrike,
    0,
    meteor.frameCount - 1,
    meteor.frameRate,
    0,
  );

  const shatter = PVFX_FX_ASSETS.find(
    (a) => a.key === PVFX_TEXTURE.iceShatter,
  )!;
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

  const regenAura = PVFX_FX_ASSETS.find(
    (a) => a.key === PVFX_TEXTURE.regenAura,
  )!;
  createOnce(
    PVFX_ANIM.regenAuraLoop,
    PVFX_TEXTURE.regenAura,
    0,
    regenAura.frameCount - 1,
    regenAura.frameRate,
    -1,
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
    createOnce(
      animKey,
      flightKey,
      0,
      entry.frameCount - 1,
      entry.frameRate,
      -1,
    );
  }

  for (const oneShot of [
    {
      anim: PVFX_ANIM.critHit,
      texture: PVFX_TEXTURE.critHit,
      key: PVFX_TEXTURE.critHit,
    },
    {
      anim: PVFX_ANIM.holyCast,
      texture: PVFX_TEXTURE.holyCast,
      key: PVFX_TEXTURE.holyCast,
    },
    {
      anim: PVFX_ANIM.shadowCast,
      texture: PVFX_TEXTURE.shadowCast,
      key: PVFX_TEXTURE.shadowCast,
    },
    {
      anim: PVFX_ANIM.flameRing,
      texture: PVFX_TEXTURE.flameRing,
      key: PVFX_TEXTURE.flameRing,
    },
    {
      anim: PVFX_ANIM.incinerate,
      texture: PVFX_TEXTURE.incinerate,
      key: PVFX_TEXTURE.incinerate,
    },
    {
      anim: PVFX_ANIM.firePillar,
      texture: PVFX_TEXTURE.firePillar,
      key: PVFX_TEXTURE.firePillar,
    },
  ] as const) {
    const entry = PVFX_FX_ASSETS.find((a) => a.key === oneShot.key)!;
    createOnce(
      oneShot.anim,
      oneShot.texture,
      0,
      entry.frameCount - 1,
      entry.frameRate,
      0,
    );
  }

  const groundFlames = PVFX_FX_ASSETS.find(
    (a) => a.key === PVFX_TEXTURE.groundFlames,
  )!;
  createOnce(
    PVFX_ANIM.groundFlamesLoop,
    PVFX_TEXTURE.groundFlames,
    0,
    groundFlames.frameCount - 1,
    groundFlames.frameRate,
    -1,
  );
}
