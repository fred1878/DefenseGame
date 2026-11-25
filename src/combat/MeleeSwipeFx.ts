import Phaser from "phaser";
import { DEFENSE_RENDER_DEPTH } from "../config";
import { COMBAT_FX_TEXTURE, SPRITE_DISPLAY } from "../content/assets";
import {
  enemyMeleeFxSpec,
  enemyMeleeFxTransform,
  meleeFxAnimDurationMs,
  type EnemyMeleeFxSpec,
} from "../content/meleeFxAssets";
import type { EnemyMeleeCombat } from "../core/enemyTuning";
import { meleeFxPlaybackTimeScale } from "./meleeFxTiming";
import { worldDisplayPx, worldUnit } from "../core/worldPixelScale";
import { publishE2E } from "../e2e/e2eGlobal";
import { isE2EEnabled } from "../e2e/e2eMode";

/** At rotation 0, `slash-arc-v2` strike bisector points west; combat facing is attack direction (+X = east). */
const SLASH_ARC_V2_ROT_OFFSET = Math.PI;

/** Peter pick: v1 `slash-arc-v2` at 48px source, scaled for on-screen melee read. */
const PLAYER_SLASH_OFFSET = 24;

/** Above entity sprites; below enemy nameplates (see `DEFENSE_RENDER_DEPTH`). */
const PLAYER_MELEE_FX_DEPTH = DEFENSE_RENDER_DEPTH.playerCombatFx;

/** Locked grunt v2 mirror at 32px source. */
const GRUNT_SLASH_OFFSET = 12;

export function showPlayerMeleeSwipe(
  scene: Phaser.Scene,
  x: number,
  y: number,
  facingRad: number,
  fxDurationMs: number | undefined,
  naturalFadeMs: number,
  registerWorldDraw?: (go: Phaser.GameObjects.GameObject) => void,
): void {
  spawnSlashFade(
    scene,
    x,
    y,
    facingRad,
    worldUnit(PLAYER_SLASH_OFFSET, scene.registry),
    COMBAT_FX_TEXTURE.playerMelee,
    worldDisplayPx(SPRITE_DISPLAY.playerMeleeSlash, scene.registry),
    worldDisplayPx(SPRITE_DISPLAY.playerMeleeSlash, scene.registry),
    fxDurationMs,
    naturalFadeMs,
    PLAYER_MELEE_FX_DEPTH,
    registerWorldDraw,
  );
}

export function meleeSwipeRotation(facingRad: number): number {
  return facingRad + SLASH_ARC_V2_ROT_OFFSET;
}

export type EnemyMeleeVfxSizing = Pick<
  EnemyMeleeCombat,
  "vfxDisplayW" | "vfxDisplayH" | "vfxOffsetWu"
>;

export function showEnemyMeleeSwipe(
  scene: Phaser.Scene,
  enemyDefId: string,
  x: number,
  y: number,
  facingRad: number,
  fxDurationMs: number | undefined,
  fallbackNaturalMs: number,
  vfxSize: EnemyMeleeVfxSizing,
): void {
  const spec = enemyMeleeFxSpec(enemyDefId);
  if (spec) {
    if (!scene.textures.exists(spec.textureKey)) {
      throw new Error(
        `Missing melee FX texture ${spec.textureKey} (${enemyDefId})`,
      );
    }
    if (!scene.anims.exists(spec.animKey)) {
      throw new Error(
        `Missing melee FX animation ${spec.animKey} (${enemyDefId})`,
      );
    }
    spawnEnemyMeleeAnim(scene, spec, vfxSize, x, y, facingRad, fxDurationMs);
  } else {
    spawnGruntMeleeFallback(
      scene,
      x,
      y,
      facingRad,
      fxDurationMs,
      fallbackNaturalMs,
    );
  }
  publishEnemyMeleeFxE2E(enemyDefId, facingRad);
}

function publishEnemyMeleeFxE2E(enemyDefId: string, facingRad: number): void {
  if (!isE2EEnabled()) return;
  const spec = enemyMeleeFxSpec(enemyDefId);
  const pose = spec
    ? enemyMeleeFxTransform(facingRad, spec)
    : { rotation: meleeSwipeRotation(facingRad), flipX: false };
  publishE2E({
    flags: {
      enemyMeleeFxSpawned: 1,
      lastEnemyMeleeFxDef: enemyDefId,
      lastEnemyMeleeFxFacing: facingRad,
      lastEnemyMeleeFxRot: pose.rotation,
      lastEnemyMeleeFxFlipX: pose.flipX ? 1 : 0,
    },
  });
}

function spawnGruntMeleeFallback(
  scene: Phaser.Scene,
  x: number,
  y: number,
  facingRad: number,
  fxDurationMs: number | undefined,
  naturalFadeMs: number,
): void {
  spawnSlashFade(
    scene,
    x,
    y,
    facingRad,
    worldUnit(GRUNT_SLASH_OFFSET, scene.registry),
    COMBAT_FX_TEXTURE.gruntMelee,
    worldDisplayPx(SPRITE_DISPLAY.gruntMeleeSlash, scene.registry),
    worldDisplayPx(SPRITE_DISPLAY.gruntMeleeSlash, scene.registry),
    fxDurationMs,
    naturalFadeMs,
    DEFENSE_RENDER_DEPTH.enemyCombatFx,
  );
}

function spawnEnemyMeleeAnim(
  scene: Phaser.Scene,
  spec: EnemyMeleeFxSpec,
  vfxSize: EnemyMeleeVfxSizing,
  x: number,
  y: number,
  facingRad: number,
  fxDurationMs: number | undefined,
): void {
  const offset = worldUnit(vfxSize.vfxOffsetWu, scene.registry);
  const ox = x + Math.cos(facingRad) * offset;
  const oy = y + Math.sin(facingRad) * offset;
  const sprite = scene.add.sprite(ox, oy, spec.textureKey);
  const reg = scene.registry;
  sprite.setDisplaySize(
    worldDisplayPx(vfxSize.vfxDisplayW, reg),
    worldDisplayPx(vfxSize.vfxDisplayH, reg),
  );
  sprite.setOrigin(0.5, 0.5);
  const { rotation, flipX } = enemyMeleeFxTransform(facingRad, spec);
  sprite.setFlipX(flipX);
  sprite.setRotation(rotation);
  sprite.setDepth(DEFENSE_RENDER_DEPTH.enemyCombatFx);
  sprite.setAlpha(0.92);
  const naturalMs = meleeFxAnimDurationMs(spec.clipId);
  sprite.anims.timeScale = meleeFxPlaybackTimeScale(naturalMs, fxDurationMs);
  sprite.play(spec.animKey);
  sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
    sprite.destroy();
  });
}

function spawnSlashFade(
  scene: Phaser.Scene,
  x: number,
  y: number,
  facingRad: number,
  offset: number,
  textureKey: string,
  displayW: number,
  displayH: number,
  targetDurationMs: number | undefined,
  naturalDurationMs: number,
  depth: number,
  registerWorldDraw?: (go: Phaser.GameObjects.GameObject) => void,
): void {
  const ox = x + Math.cos(facingRad) * offset;
  const oy = y + Math.sin(facingRad) * offset;
  const img = scene.add.image(ox, oy, textureKey);
  img.setDisplaySize(displayW, displayH);
  img.setOrigin(0.5, 0.5);
  img.setRotation(meleeSwipeRotation(facingRad));
  img.setDepth(depth);
  img.setAlpha(0.92);
  registerWorldDraw?.(img);
  if (isE2EEnabled() && textureKey === COMBAT_FX_TEXTURE.playerMelee) {
    publishE2E({ flags: { meleeFxSpawned: 1 } });
  }
  let fadeMs: number;
  let delayMs: number;
  if (targetDurationMs === undefined) {
    fadeMs = Math.max(80, naturalDurationMs - 40);
    delayMs = Math.min(40, naturalDurationMs * 0.25);
  } else {
    fadeMs = targetDurationMs;
    delayMs = 0;
  }
  scene.tweens.add({
    targets: img,
    alpha: 0,
    duration: fadeMs,
    delay: delayMs,
    ease: "Quad.easeOut",
    onComplete: () => img.destroy(),
  });
}
