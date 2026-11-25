import Phaser from "phaser";
import { DEFENSE_RENDER_DEPTH } from "../config";
import {
  assertPvfxClipReady,
  PVFX_ANIM,
  PVFX_TEXTURE,
} from "../content/combatPvfxAssets";
import { worldDisplayPx } from "../core/worldPixelScale";

const DEPTH = DEFENSE_RENDER_DEPTH.playerCombatFx;

const CRIT_HIT_DISPLAY_W_PX = 96;
const CRIT_HIT_DISPLAY_H_PX = 80;
const CRIT_HIT_ALPHA = 0.95;

/**
 * PVFX `impacts/crit-hit` when bruiser melee connects with the player.
 * TODO: reuse this clip when player melee can crit (feature not shipped).
 */
export function playBruiserMeleeCritHitOnPlayerFx(
  scene: Phaser.Scene,
  worldX: number,
  worldY: number,
  registerWorldDraw?: (go: Phaser.GameObjects.GameObject) => void,
): void {
  assertPvfxClipReady(
    scene,
    PVFX_TEXTURE.critHit,
    PVFX_ANIM.critHit,
    "bruiser melee crit on player",
  );
  const reg = scene.registry;
  const sprite = scene.add
    .sprite(worldX, worldY, PVFX_TEXTURE.critHit)
    .setDepth(DEPTH)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setAlpha(CRIT_HIT_ALPHA)
    .setDisplaySize(
      worldDisplayPx(CRIT_HIT_DISPLAY_W_PX, reg),
      worldDisplayPx(CRIT_HIT_DISPLAY_H_PX, reg),
    )
    .play(PVFX_ANIM.critHit);
  registerWorldDraw?.(sprite);
  sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
    sprite.destroy();
  });
}
