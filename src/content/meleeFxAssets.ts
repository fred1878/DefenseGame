import type Phaser from "phaser";

/** Per-enemy melee swipe sheets under `public/assets/combat/fx/melee/`. */

export const MELEE_FX_ROOT = "assets/combat/fx/melee";

/** Sprite sheet default strike direction at rotation 0. */
export type MeleeAnimFacing = "slashArcV2" | "eastAtZero" | "slashTopBiasRight";

const MELEE_ANIM_FACING_OFFSET: Record<
  Exclude<MeleeAnimFacing, "slashTopBiasRight">,
  number
> = {
  /** `slash-arc-v2` bisector points west at rot 0; add π to align +X attack. */
  slashArcV2: Math.PI,
  /** PVFX / smear sheets authored facing +X (east) at rot 0. */
  eastAtZero: 0,
};

/**
 * `slash-128x128-s3-c1` — strike reads toward the **top of the frame** in source art,
 * with a slight rightward bias (tune `GRUNT_SLASH_128_S3_C1_TOP_RIGHT_BIAS_RAD`, not a fixed °).
 */
export const GRUNT_SLASH_128_S3_C1_TOP_RIGHT_BIAS_RAD = Math.atan2(1, 14);

/** World-space strike bearing when the sprite rotation is 0. */
export function slashTopBiasRightStrikeAtRot0(biasRad: number): number {
  return -Math.PI / 2 + biasRad;
}

/** Per-clip facing; all enemy PVFX smears use eastAtZero. */
export const MELEE_FX_ANIM_FACING: Record<
  keyof typeof MELEE_FX_ANIM,
  MeleeAnimFacing
> = {
  grunt: "slashTopBiasRight",
  skirmisher: "eastAtZero",
  bruiser: "eastAtZero",
  slow_siege: "eastAtZero",
  charger: "eastAtZero",
  ward: "eastAtZero",
  fast_sapper: "eastAtZero",
  reaver: "eastAtZero",
};

export function rotationOffsetRadForAnimFacing(
  facing: MeleeAnimFacing,
): number {
  if (facing === "slashTopBiasRight") {
    return -slashTopBiasRightStrikeAtRot0(
      GRUNT_SLASH_128_S3_C1_TOP_RIGHT_BIAS_RAD,
    );
  }
  return MELEE_ANIM_FACING_OFFSET[facing];
}

export const MELEE_FX_ASSETS = [
  {
    key: "fx_melee_grunt",
    file: "grunt-slash-128x128-s3-c1.png",
    frameWidth: 128,
    frameHeight: 128,
    frameCount: 9,
    frameRate: 12,
  },
  {
    key: "fx_melee_skirmisher",
    file: "enemy-melee-skirmisher-spear-thrust.png",
    frameWidth: 72,
    frameHeight: 32,
    frameCount: 10,
    frameRate: 1000 / 60,
  },
  {
    key: "fx_melee_bruiser",
    file: "enemy-melee-bruiser-axe-smear.png",
    frameWidth: 128,
    frameHeight: 104,
    frameCount: 9,
    frameRate: 12.5,
  },
  {
    key: "fx_melee_slow_siege",
    file: "enemy-melee-slow-siege-hammer-smash.png",
    frameWidth: 84,
    frameHeight: 56,
    frameCount: 15,
    frameRate: 1000 / 60,
  },
  {
    key: "fx_melee_charger",
    file: "enemy-melee-charger-spin-slash.png",
    frameWidth: 120,
    frameHeight: 72,
    frameCount: 14,
    frameRate: 1000 / 60,
  },
  {
    key: "fx_melee_ward",
    file: "enemy-melee-ward-shield-bash.png",
    frameWidth: 72,
    frameHeight: 52,
    frameCount: 16,
    frameRate: 1000 / 60,
  },
  {
    key: "fx_melee_fast_sapper",
    file: "fast-sapper-smear-horizontal-1.png",
    frameWidth: 48,
    frameHeight: 48,
    frameCount: 5,
    frameRate: 12,
  },
  {
    key: "fx_melee_reaver",
    file: "enemy-melee-reaver-scythe-reap.png",
    frameWidth: 96,
    frameHeight: 92,
    frameCount: 16,
    frameRate: 1000 / 70,
  },
] as const;

export const MELEE_FX_ANIM = {
  grunt: "melee_fx_grunt",
  skirmisher: "melee_fx_skirmisher",
  bruiser: "melee_fx_bruiser",
  slow_siege: "melee_fx_slow_siege",
  charger: "melee_fx_charger",
  ward: "melee_fx_ward",
  fast_sapper: "melee_fx_fast_sapper",
  reaver: "melee_fx_reaver",
} as const;

/** On-screen display size (art px) before world display scaling. */
export const MELEE_FX_DISPLAY = {
  grunt: { w: 112, h: 112 },
  skirmisher: { w: 54, h: 24 },
  bruiser: { w: 72, h: 58 },
  slow_siege: { w: 50, h: 34 },
  charger: { w: 60, h: 36 },
  ward: { w: 44, h: 32 },
  fast_sapper: { w: 48, h: 48 },
  reaver: { w: 52, h: 50 },
} as const;

/** World-unit offset from attacker center toward facing (matches legacy 32px grunt arc). */
export const MELEE_FX_OFFSET_WU = {
  grunt: 21,
  skirmisher: 14,
  bruiser: 27,
  slow_siege: 16,
  charger: 19,
  ward: 16,
  fast_sapper: 18,
  reaver: 17,
} as const;

const ENEMY_MELEE_FX_CLIP: Partial<
  Record<string, keyof typeof MELEE_FX_ANIM>
> = {
  grunt: "grunt",
  skirmisher: "skirmisher",
  bruiser: "bruiser",
  slow_siege: "slow_siege",
  charger: "charger",
  ward: "ward",
  fast_sapper: "fast_sapper",
  reaver: "reaver",
};

export type MeleeFxClipId = keyof typeof MELEE_FX_ANIM;

export type EnemyMeleeFxSpec = {
  clipId: MeleeFxClipId;
  textureKey: string;
  animKey: string;
  displayW: number;
  displayH: number;
  offsetWu: number;
  animFacing: MeleeAnimFacing;
  rotationOffsetRad: number;
};

export function enemyMeleeFxClipId(
  enemyDefId: string,
): MeleeFxClipId | undefined {
  return ENEMY_MELEE_FX_CLIP[enemyDefId];
}

export function enemyMeleeFxSpec(
  enemyDefId: string,
): EnemyMeleeFxSpec | undefined {
  const clipId = enemyMeleeFxClipId(enemyDefId);
  if (!clipId) return undefined;
  const asset = MELEE_FX_ASSETS.find(
    (a) => a.key === `fx_melee_${clipId}`,
  );
  if (!asset) return undefined;
  const display = MELEE_FX_DISPLAY[clipId];
  const animFacing = MELEE_FX_ANIM_FACING[clipId];
  return {
    clipId,
    textureKey: asset.key,
    animKey: MELEE_FX_ANIM[clipId],
    displayW: display.w,
    displayH: display.h,
    offsetWu: MELEE_FX_OFFSET_WU[clipId],
    animFacing,
    rotationOffsetRad: rotationOffsetRadForAnimFacing(animFacing),
  };
}

export type EnemyMeleeFxTransform = {
  rotation: number;
  flipX: boolean;
};

/**
 * PVFX/smears are authored facing +X at rotation 0. West-half attacks (cos < 0)
 * mirror on X and use rotation `facing − π` so flip + angle match body aim.
 * `slashArcV2` (static fallback) keeps rotation-only + π offset — no flip.
 * `slashTopBiasRight` (`slash-128x128-s3-c1`): top-of-frame strike + slight right bias at rot 0;
 * rotation aligns that bearing to `facingRad`, flipX on the west half.
 */
export function enemyMeleeFxTransform(
  facingRad: number,
  spec: EnemyMeleeFxSpec,
): EnemyMeleeFxTransform {
  if (spec.animFacing === "slashArcV2") {
    return {
      rotation: facingRad + spec.rotationOffsetRad,
      flipX: false,
    };
  }
  if (spec.animFacing === "slashTopBiasRight") {
    const strike0 = slashTopBiasRightStrikeAtRot0(
      GRUNT_SLASH_128_S3_C1_TOP_RIGHT_BIAS_RAD,
    );
    const flipX = Math.cos(facingRad) < 0;
    return {
      flipX,
      rotation: flipX ? facingRad - Math.PI - strike0 : facingRad - strike0,
    };
  }
  const flipX = Math.cos(facingRad) < 0;
  return {
    flipX,
    rotation: flipX ? facingRad - Math.PI : facingRad + spec.rotationOffsetRad,
  };
}

/** Strike bearing in world space after rotation + flip (for tests and E2E). */
export function enemyMeleeFxStrikeAim(
  facingRad: number,
  spec: EnemyMeleeFxSpec,
): number {
  const { rotation, flipX } = enemyMeleeFxTransform(facingRad, spec);
  if (spec.animFacing === "slashTopBiasRight") {
    const strike0 = slashTopBiasRightStrikeAtRot0(
      GRUNT_SLASH_128_S3_C1_TOP_RIGHT_BIAS_RAD,
    );
    const localAim = rotation + strike0;
    return flipX ? Math.PI - localAim : localAim;
  }
  if (spec.animFacing === "eastAtZero") {
    return flipX ? Math.PI : rotation;
  }
  return rotation + spec.rotationOffsetRad;
}

export function enemyMeleeFxRotation(
  facingRad: number,
  spec: EnemyMeleeFxSpec,
): number {
  return enemyMeleeFxTransform(facingRad, spec).rotation;
}

export function enemyMeleeFxFlipX(
  facingRad: number,
  spec: EnemyMeleeFxSpec,
): boolean {
  return enemyMeleeFxTransform(facingRad, spec).flipX;
}

/** Phaser anim play time in ms (`frameCount / frameRate`). */
export function meleeFxAnimDurationMs(clipId: MeleeFxClipId): number {
  const asset = MELEE_FX_ASSETS.find((a) => a.key === `fx_melee_${clipId}`);
  if (!asset || asset.frameRate <= 0) return 0;
  return (asset.frameCount / asset.frameRate) * 1000;
}

export function registerMeleeFxAnimations(scene: Phaser.Scene): void {
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

  for (const asset of MELEE_FX_ASSETS) {
    const clipId = asset.key.replace("fx_melee_", "") as MeleeFxClipId;
    if (!MELEE_FX_ANIM[clipId]) continue;
    createOnce(
      MELEE_FX_ANIM[clipId],
      asset.key,
      0,
      asset.frameCount - 1,
      asset.frameRate,
    );
  }
}