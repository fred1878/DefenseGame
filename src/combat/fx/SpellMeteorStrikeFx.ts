import Phaser from "phaser";
import { DEFENSE_RENDER_DEPTH } from "../../config";
import {
  PVFX_ANIM,
  PVFX_TEXTURE,
  registerCombatPvfxAnimations,
} from "../../content/combatPvfxAssets";

const DEPTH = DEFENSE_RENDER_DEPTH.playerCombatFx;

/** PVFX meteor art enters from the left; mirror when the caster is left of impact. */
export function meteorStrikeFxFlipX(playerX: number, impactX: number): boolean {
  return playerX < impactX;
}

/** Meteor impact — PVFX `fire/meteor-strike` at blast center. */
export function playMeteorStrikeFx(
  scene: Phaser.Scene,
  x: number,
  y: number,
  blastRadiusPx: number,
  flipX: boolean,
  registerWorldDraw?: (go: Phaser.GameObjects.GameObject) => void,
): void {
  if (!scene.textures.exists(PVFX_TEXTURE.meteorStrike)) return;
  registerCombatPvfxAnimations(scene);
  if (!(scene.anims?.exists(PVFX_ANIM.meteorStrike) ?? false)) return;
  const display = Math.max(blastRadiusPx * 2.4, 96);
  const sprite = scene.add
    .sprite(x, y, PVFX_TEXTURE.meteorStrike)
    .setDepth(DEPTH)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setAlpha(0.95)
    .setFlipX(flipX)
    .setDisplaySize(display, display)
    .play(PVFX_ANIM.meteorStrike);
  registerWorldDraw?.(sprite);
  sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () =>
    sprite.destroy(),
  );
}
