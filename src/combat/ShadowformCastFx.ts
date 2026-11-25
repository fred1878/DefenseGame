import Phaser from "phaser";
import { DEFENSE_RENDER_DEPTH } from "../config";
import {
  assertPvfxClipReady,
  PVFX_ANIM,
  PVFX_TEXTURE,
} from "../content/combatPvfxAssets";
import { worldDisplayPx } from "../core/worldPixelScale";

const DEPTH = DEFENSE_RENDER_DEPTH.playerCombatFx;

const SHADOW_CAST_DISPLAY_PX = 72;
const SHADOW_CAST_ALPHA = 0.92;

/** PVFX `shadow/shadow-cast` when the player enters shadowform. */
export function playShadowformCastFx(
  scene: Phaser.Scene,
  worldX: number,
  worldY: number,
  registerWorldDraw?: (go: Phaser.GameObjects.GameObject) => void,
): void {
  assertPvfxClipReady(
    scene,
    PVFX_TEXTURE.shadowCast,
    PVFX_ANIM.shadowCast,
    "shadowform buff start",
  );
  const reg = scene.registry;
  const display = worldDisplayPx(SHADOW_CAST_DISPLAY_PX, reg);
  const sprite = scene.add
    .sprite(worldX, worldY, PVFX_TEXTURE.shadowCast)
    .setDepth(DEPTH)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setAlpha(SHADOW_CAST_ALPHA)
    .setDisplaySize(display, display)
    .play(PVFX_ANIM.shadowCast);
  registerWorldDraw?.(sprite);
  sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
    sprite.destroy();
  });
}
