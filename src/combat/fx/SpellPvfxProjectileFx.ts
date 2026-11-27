import Phaser from "phaser";
import { DEFENSE_RENDER_DEPTH } from "../../config";
import {
  projectileTextureRotationOffset,
  PVFX_ANIM,
  PVFX_FX_ASSETS,
  registerCombatPvfxAnimations,
} from "../../content/combatPvfxAssets";
import type { PlayerProjectile } from "../../entities/Projectile";

const DEPTH = DEFENSE_RENDER_DEPTH.projectile;

const FLIGHT_ANIM_BY_TEXTURE = new Map<string, string>([
  ["fx_pvfx_arrow_flight", PVFX_ANIM.arrowFlight],
  ["fx_pvfx_fireball_flight", PVFX_ANIM.fireballFlight],
  ["fx_pvfx_lightning_flight", PVFX_ANIM.lightningFlight],
]);

export type PvfxProjectileFxState = {
  sprite: Phaser.GameObjects.Sprite;
};

function flightAngle(projectile: PlayerProjectile): number {
  const body = projectile.sprite.body as Phaser.Physics.Arcade.Body;
  return Math.atan2(body.velocity.y, body.velocity.x);
}

function displaySizeForTexture(textureKey: string): { w: number; h: number } {
  const entry = PVFX_FX_ASSETS.find((a) => a.key === textureKey);
  if (!entry) return { w: 48, h: 32 };
  const scale = textureKey === "fx_pvfx_arrow_flight" ? 2.1 : 1.85;
  return {
    w: entry.frameWidth * scale,
    h: entry.frameHeight * scale,
  };
}

/** Animated PVFX flight loop on a projectile (hides static slice when active). */
export function attachPvfxProjectileFx(
  scene: Phaser.Scene,
  projectile: PlayerProjectile,
  textureKey: string,
  registerWorldDraw?: (go: Phaser.GameObjects.GameObject) => void,
): void {
  const animKey = FLIGHT_ANIM_BY_TEXTURE.get(textureKey);
  if (!animKey) return;
  registerCombatPvfxAnimations(scene);
  if (!(scene.anims?.exists(animKey) ?? false)) return;
  const { w, h } = displaySizeForTexture(textureKey);
  const { sprite: body } = projectile;
  const overlay = scene.add
    .sprite(body.x, body.y, textureKey)
    .setDepth(DEPTH + 0.15)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setAlpha(0.92)
    .setDisplaySize(w, h)
    .setRotation(
      flightAngle(projectile) +
        (projectileTextureRotationOffset(textureKey) ?? 0),
    )
    .play(animKey);
  registerWorldDraw?.(overlay);
  projectile.pvfxFlightFx = { sprite: overlay };
  body.setAlpha(0);
}

export function syncPvfxProjectileFx(projectile: PlayerProjectile): void {
  const fx = projectile.pvfxFlightFx;
  if (!fx?.sprite.active || !projectile.sprite.active) return;
  const offset = projectileTextureRotationOffset(fx.sprite.texture.key) ?? 0;
  fx.sprite.setPosition(projectile.sprite.x, projectile.sprite.y);
  fx.sprite.setRotation(flightAngle(projectile) + offset);
}

export function destroyPvfxProjectileFx(projectile: PlayerProjectile): void {
  if (!projectile.pvfxFlightFx) return;
  projectile.pvfxFlightFx.sprite.destroy();
  projectile.pvfxFlightFx = undefined;
}
