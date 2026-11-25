import Phaser from "phaser";
import { DEFENSE_RENDER_DEPTH } from "../config";
import { COMBAT_FX_TEXTURE, SPRITE_DISPLAY } from "../content/assets";
import {
  enemyMeleeFxSpec,
  meleeFxPackLoaded,
  type EnemyMeleeFxSpec,
} from "../content/meleeFxAssets";
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
  activeMs: number,
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
    activeMs,
    PLAYER_MELEE_FX_DEPTH,
    registerWorldDraw,
  );
}

export function meleeSwipeRotation(facingRad: number): number {
  return facingRad + SLASH_ARC_V2_ROT_OFFSET;
}

export function showEnemyMeleeSwipe(
  scene: Phaser.Scene,
  enemyDefId: string,
  x: number,
  y: number,
  facingRad: number,
  activeMs: number,
): void {
  const spec = enemyMeleeFxSpec(enemyDefId);
  if (
    spec &&
    meleeFxPackLoaded(scene) &&
    scene.textures.exists(spec.textureKey) &&
    scene.anims.exists(spec.animKey)
  ) {
    spawnEnemyMeleeAnim(scene, spec, x, y, facingRad, activeMs, enemyDefId);
    return;
  }
  spawnGruntMeleeFallback(scene, x, y, facingRad, activeMs);
  publishEnemyMeleeFxE2E(enemyDefId);
}

function publishEnemyMeleeFxE2E(enemyDefId: string): void {
  if (!isE2EEnabled()) return;
  publishE2E({
    flags: {
      enemyMeleeFxSpawned: 1,
      lastEnemyMeleeFxDef: enemyDefId,
    },
  });
}

function spawnGruntMeleeFallback(
  scene: Phaser.Scene,
  x: number,
  y: number,
  facingRad: number,
  activeMs: number,
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
    activeMs,
    DEFENSE_RENDER_DEPTH.enemyCombatFx,
  );
}

function spawnEnemyMeleeAnim(
  scene: Phaser.Scene,
  spec: EnemyMeleeFxSpec,
  x: number,
  y: number,
  facingRad: number,
  _activeMs: number,
  enemyDefId: string,
): void {
  const offset = worldUnit(spec.offsetWu, scene.registry);
  const ox = x + Math.cos(facingRad) * offset;
  const oy = y + Math.sin(facingRad) * offset;
  const sprite = scene.add.sprite(ox, oy, spec.textureKey);
  const reg = scene.registry;
  sprite.setDisplaySize(
    worldDisplayPx(spec.displayW, reg),
    worldDisplayPx(spec.displayH, reg),
  );
  sprite.setOrigin(0.5, 0.5);
  sprite.setRotation(meleeSwipeRotation(facingRad));
  sprite.setDepth(DEFENSE_RENDER_DEPTH.enemyCombatFx);
  sprite.setAlpha(0.92);
  sprite.play(spec.animKey);
  if (isE2EEnabled()) {
    publishE2E({
      flags: {
        enemyMeleeFxSpawned: 1,
        lastEnemyMeleeFxDef: enemyDefId,
      },
    });
  }
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
  holdMs: number,
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
  const fadeMs = Math.max(80, holdMs - 40);
  scene.tweens.add({
    targets: img,
    alpha: 0,
    duration: fadeMs,
    delay: Math.min(40, holdMs * 0.25),
    ease: "Quad.easeOut",
    onComplete: () => img.destroy(),
  });
}