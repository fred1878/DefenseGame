import Phaser from "phaser";
import { DEFENSE_RENDER_DEPTH } from "../config";
import { COMBAT_FX_TEXTURE, SPRITE_DISPLAY } from "../content/assets";
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
): void {
  spawnSlashFade(
    scene,
    x,
    y,
    facingRad,
    worldUnit(PLAYER_SLASH_OFFSET, scene.registry),
    COMBAT_FX_TEXTURE.playerMelee,
    worldDisplayPx(SPRITE_DISPLAY.playerMeleeSlash, scene.registry),
    activeMs,
    PLAYER_MELEE_FX_DEPTH,
  );
}

export function meleeSwipeRotation(facingRad: number): number {
  return facingRad + SLASH_ARC_V2_ROT_OFFSET;
}

export function showGruntMeleeSwipe(
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
    activeMs,
    DEFENSE_RENDER_DEPTH.enemyCombatFx,
  );
}

function spawnSlashFade(
  scene: Phaser.Scene,
  x: number,
  y: number,
  facingRad: number,
  offset: number,
  textureKey: string,
  displaySize: number,
  holdMs: number,
  depth: number,
): void {
  const ox = x + Math.cos(facingRad) * offset;
  const oy = y + Math.sin(facingRad) * offset;
  const img = scene.add.image(ox, oy, textureKey);
  img.setDisplaySize(displaySize, displaySize);
  img.setOrigin(0.5, 0.5);
  img.setRotation(meleeSwipeRotation(facingRad));
  img.setDepth(depth);
  img.setAlpha(0.92);
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