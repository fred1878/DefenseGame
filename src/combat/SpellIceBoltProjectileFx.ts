import Phaser from "phaser";
import { DEFENSE_RENDER_DEPTH } from "../config";
import {
  ICE_FX_ANIM,
  ICE_FX_BOLT_ALPHA,
  ICE_FX_BOLT_DISPLAY_H_PX,
  ICE_FX_BOLT_DISPLAY_W_PX,
  ICE_FX_TEXTURE,
  assertIceCombatFxReady,
} from "../content/iceFxAssets";
import type { PlayerProjectile } from "../entities/Projectile";

const DEPTH = DEFENSE_RENDER_DEPTH.projectile;

function travelAngleRad(projectile: PlayerProjectile): number {
  const body = projectile.sprite.body as Phaser.Physics.Arcade.Body;
  return Math.atan2(body.velocity.y, body.velocity.x);
}

export type IceBoltProjectileFxState = {
  sprite: Phaser.GameObjects.Sprite;
  phase: "start" | "travel";
};

/** Attach Ice VFX 1 travel on `ice_bolt` (physics sprite stays invisible). */
export function attachIceBoltProjectileFx(
  scene: Phaser.Scene,
  projectile: PlayerProjectile,
  registerWorldDraw?: (go: Phaser.GameObjects.GameObject) => void,
): void {
  assertIceCombatFxReady(scene, "ice_bolt travel");
  const { sprite: body } = projectile;
  const overlay = scene.add
    .sprite(body.x, body.y, ICE_FX_TEXTURE.boltStart)
    .setDepth(DEPTH + 0.2)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setAlpha(ICE_FX_BOLT_ALPHA)
    .setDisplaySize(ICE_FX_BOLT_DISPLAY_W_PX, ICE_FX_BOLT_DISPLAY_H_PX)
    .setRotation(travelAngleRad(projectile));
  registerWorldDraw?.(overlay);
  const state: IceBoltProjectileFxState = { sprite: overlay, phase: "start" };
  projectile.iceBoltFx = state;
  body.setAlpha(0);
  overlay.play(ICE_FX_ANIM.boltStart);
  overlay.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
    if (projectile.iceBoltFx !== state) return;
    state.phase = "travel";
    overlay.play(ICE_FX_ANIM.boltRepeat);
  });
}

export function syncIceBoltProjectileFx(projectile: PlayerProjectile): void {
  const fx = projectile.iceBoltFx;
  if (!fx?.sprite.active || !projectile.sprite.active) return;
  fx.sprite.setPosition(projectile.sprite.x, projectile.sprite.y);
  fx.sprite.setRotation(travelAngleRad(projectile));
}

export function destroyIceBoltProjectileFx(projectile: PlayerProjectile): void {
  if (!projectile.iceBoltFx) return;
  projectile.iceBoltFx.sprite.destroy();
  projectile.iceBoltFx = undefined;
}

/** Impact Ice VFX 1 Hit at world position (projectile body may already be destroyed). */
export function playIceBoltHitFx(
  scene: Phaser.Scene,
  x: number,
  y: number,
  angleRad: number,
  registerWorldDraw?: (go: Phaser.GameObjects.GameObject) => void,
): void {
  assertIceCombatFxReady(scene, "ice_bolt impact");
  const hit = scene.add
    .sprite(x, y, ICE_FX_TEXTURE.boltHit)
    .setDepth(DEPTH + 0.3)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setAlpha(ICE_FX_BOLT_ALPHA)
    .setDisplaySize(ICE_FX_BOLT_DISPLAY_W_PX, ICE_FX_BOLT_DISPLAY_H_PX)
    .setRotation(angleRad)
    .play(ICE_FX_ANIM.boltHit);
  registerWorldDraw?.(hit);
  hit.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => hit.destroy());
}

export function finishIceBoltProjectileHit(
  scene: Phaser.Scene,
  projectile: PlayerProjectile,
  registerWorldDraw?: (go: Phaser.GameObjects.GameObject) => void,
): void {
  const x = projectile.iceBoltFx?.sprite.x ?? projectile.sprite.x;
  const y = projectile.iceBoltFx?.sprite.y ?? projectile.sprite.y;
  const rotation = travelAngleRad(projectile);
  destroyIceBoltProjectileFx(projectile);
  playIceBoltHitFx(scene, x, y, rotation, registerWorldDraw);
}