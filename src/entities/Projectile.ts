import Phaser from "phaser";
import type { Damageable } from "../combat/DamageSystem";
import { applyDamage } from "../combat/DamageSystem";

export type PlayerProjectile = {
  id: string;
  sprite: Phaser.Physics.Arcade.Sprite;
  damage: number;
  maxTravel: number;
  traveled: number;
  hitIds: Set<string>;
};

export function spawnPlayerProjectile(
  scene: Phaser.Scene,
  x: number,
  y: number,
  angleRad: number,
  speed: number,
  damage: number,
  maxTravel: number,
  id: string,
): PlayerProjectile {
  const sprite = scene.physics.add.sprite(x, y, "projectile");
  sprite.setCircle(4);
  sprite.setDepth(8);
  const vx = Math.cos(angleRad) * speed;
  const vy = Math.sin(angleRad) * speed;
  sprite.setVelocity(vx, vy);
  return {
    id,
    sprite,
    damage,
    maxTravel,
    traveled: 0,
    hitIds: new Set(),
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
  }>,
): boolean {
  if (!projectile.sprite.active) return false;
  const body = projectile.sprite.body as Phaser.Physics.Arcade.Body;
  const dist = Math.hypot(body.velocity.x, body.velocity.y) * (deltaMs / 1000);
  projectile.traveled += dist;
  if (projectile.traveled >= projectile.maxTravel) {
    projectile.sprite.destroy();
    return false;
  }

  for (const e of enemies) {
    if (!e.damageable.alive || projectile.hitIds.has(e.id)) continue;
    const d = Phaser.Math.Distance.Between(
      projectile.sprite.x,
      projectile.sprite.y,
      e.x,
      e.y,
    );
    if (d <= e.radius + 6) {
      projectile.hitIds.add(e.id);
      applyDamage(e.damageable, projectile.damage);
    }
  }

  return true;
}