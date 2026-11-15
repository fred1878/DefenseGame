import Phaser from "phaser";
import { COMBAT_FX_TEXTURE, SPRITE_DISPLAY } from "../content/assets";
import { worldDisplayPx } from "../core/worldPixelScale";
import type { Damageable, DamageFlavor } from "../combat/DamageSystem";
import { applyDamage } from "../combat/DamageSystem";
import { segmentFirstCircleHitT } from "../combat/Hitbox";
import { applyKnockbackFrom } from "../combat/Knockback";

/** Source art faces upper-right at rotation 0. */
const FIRE_BOLT_ROT_OFFSET = Math.PI / 4;
const STONE_THROW_ROT_OFFSET = 0;

export type PlayerProjectile = {
  id: string;
  sprite: Phaser.Physics.Arcade.Sprite;
  damage: number;
  damageFlavor: DamageFlavor;
  maxTravel: number;
  traveled: number;
  prevX: number;
  prevY: number;
};

function projectileRotOffset(textureKey: string): number {
  return textureKey === COMBAT_FX_TEXTURE.fireBolt
    ? FIRE_BOLT_ROT_OFFSET
    : STONE_THROW_ROT_OFFSET;
}

function aimProjectileSprite(sprite: Phaser.Physics.Arcade.Sprite, textureKey: string): void {
  const body = sprite.body as Phaser.Physics.Arcade.Body;
  const angle = Math.atan2(body.velocity.y, body.velocity.x);
  sprite.setRotation(angle + projectileRotOffset(textureKey));
}

export function spawnPlayerProjectile(
  scene: Phaser.Scene,
  x: number,
  y: number,
  angleRad: number,
  speed: number,
  damage: number,
  maxTravel: number,
  id: string,
  textureKey: string = COMBAT_FX_TEXTURE.stoneThrow,
  damageFlavor: DamageFlavor = "default",
): PlayerProjectile {
  const sprite = scene.physics.add.sprite(x, y, textureKey);
  const base =
    textureKey === COMBAT_FX_TEXTURE.fireBolt
      ? SPRITE_DISPLAY.fireBolt
      : SPRITE_DISPLAY.stoneThrow;
  const display = worldDisplayPx(base, scene.registry);
  sprite.setDisplaySize(display, display);
  sprite.setCircle(worldDisplayPx(4, scene.registry) / 2);
  sprite.setDepth(8);
  const vx = Math.cos(angleRad) * speed;
  const vy = Math.sin(angleRad) * speed;
  sprite.setVelocity(vx, vy);
  sprite.setRotation(angleRad + projectileRotOffset(textureKey));
  return {
    id,
    sprite,
    damage,
    damageFlavor,
    maxTravel,
    traveled: 0,
    prevX: x,
    prevY: y,
  };
}

export function updateProjectile(
  projectile: PlayerProjectile,
  deltaMs: number,
  enemies: Array<{
    id: string;
    x: number;
    y: number;
    radius: number;
    damageable: Damageable;
    sprite: Phaser.Physics.Arcade.Sprite;
  }>,
  knockback: number,
): boolean {
  if (!projectile.sprite.active) return false;

  const x0 = projectile.prevX;
  const y0 = projectile.prevY;
  const x1 = projectile.sprite.x;
  const y1 = projectile.sprite.y;

  aimProjectileSprite(projectile.sprite, projectile.sprite.texture.key);

  let firstT: number | null = null;
  let firstTarget:
    | (typeof enemies)[number]
    | undefined;

  for (const e of enemies) {
    if (!e.damageable.alive) continue;
    const hitR = e.radius + 6;
    const t = segmentFirstCircleHitT(x0, y0, x1, y1, e.x, e.y, hitR);
    if (t === null) continue;
    if (firstT === null || t < firstT) {
      firstT = t;
      firstTarget = e;
    }
  }

  if (firstTarget && firstT !== null) {
    applyDamage(firstTarget.damageable, projectile.damage, projectile.damageFlavor);
    applyKnockbackFrom(
      firstTarget.sprite,
      projectile.sprite.x,
      projectile.sprite.y,
      knockback,
    );
    projectile.sprite.destroy();
    return false;
  }

  const body = projectile.sprite.body as Phaser.Physics.Arcade.Body;
  const dist = Math.hypot(body.velocity.x, body.velocity.y) * (deltaMs / 1000);
  projectile.traveled += dist;
  projectile.prevX = x1;
  projectile.prevY = y1;

  if (projectile.traveled >= projectile.maxTravel) {
    projectile.sprite.destroy();
    return false;
  }

  return true;
}

export type EnemyProjectile = PlayerProjectile;

export function spawnEnemyProjectile(
  scene: Phaser.Scene,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  speed: number,
  damage: number,
  maxTravel: number,
  id: string,
  textureKey: string = COMBAT_FX_TEXTURE.stoneThrow,
): EnemyProjectile {
  const angle = Math.atan2(toY - fromY, toX - fromX);
  return spawnPlayerProjectile(
    scene,
    fromX,
    fromY,
    angle,
    speed,
    damage,
    maxTravel,
    id,
    textureKey,
    "default",
  );
}

export function updateEnemyProjectile(
  projectile: EnemyProjectile,
  deltaMs: number,
  player: {
    x: number;
    y: number;
    radius: number;
    damageable: Damageable;
    sprite: Phaser.Physics.Arcade.Sprite;
  },
  knockback: number,
): boolean {
  if (!projectile.sprite.active) return false;

  const x0 = projectile.prevX;
  const y0 = projectile.prevY;
  const x1 = projectile.sprite.x;
  const y1 = projectile.sprite.y;

  aimProjectileSprite(projectile.sprite, projectile.sprite.texture.key);

  const t = segmentFirstCircleHitT(
    x0,
    y0,
    x1,
    y1,
    player.x,
    player.y,
    player.radius + 6,
  );

  if (t !== null && player.damageable.alive) {
    applyDamage(player.damageable, projectile.damage, projectile.damageFlavor);
    applyKnockbackFrom(
      player.sprite,
      projectile.sprite.x,
      projectile.sprite.y,
      knockback,
    );
    projectile.sprite.destroy();
    return false;
  }

  const body = projectile.sprite.body as Phaser.Physics.Arcade.Body;
  const dist = Math.hypot(body.velocity.x, body.velocity.y) * (deltaMs / 1000);
  projectile.traveled += dist;
  projectile.prevX = x1;
  projectile.prevY = y1;

  if (projectile.traveled >= projectile.maxTravel) {
    projectile.sprite.destroy();
    return false;
  }

  return true;
}