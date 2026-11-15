import Phaser from "phaser";
import { PLAYER_TUNING } from "../config";
import type { SpellDefinition } from "../content/spells";
import { COMBAT_FX_TEXTURE } from "../content/assets";
import { applyDamage } from "./DamageSystem";
import type { Damageable } from "./DamageSystem";
import {
  spawnPlayerProjectile,
  type PlayerProjectile,
} from "../entities/Projectile";

export function applyNova(
  playerX: number,
  playerY: number,
  def: SpellDefinition,
  enemies: Array<{
    id: string;
    x: number;
    y: number;
    radius: number;
    damageable: Damageable;
  }>,
  damageMult: number,
): void {
  const radius = def.novaRadius ?? 80;
  const damage = (def.novaDamage ?? 20) * damageMult;
  for (const e of enemies) {
    if (!e.damageable.alive) continue;
    const d = Phaser.Math.Distance.Between(playerX, playerY, e.x, e.y);
    if (d <= radius + e.radius) {
      applyDamage(e.damageable, damage);
    }
  }
}

export function spawnChanneledFireball(
  scene: Phaser.Scene,
  playerX: number,
  playerY: number,
  angleRad: number,
  def: SpellDefinition,
  damageMult: number,
  id: string,
): PlayerProjectile {
  const damage = (def.fireballDamage ?? 24) * damageMult;
  return spawnPlayerProjectile(
    scene,
    playerX,
    playerY,
    angleRad,
    PLAYER_TUNING.projectileSpeed * 1.05,
    damage,
    PLAYER_TUNING.rangedMaxRange,
    id,
    COMBAT_FX_TEXTURE.fireBolt,
    "fire",
  );
}

export function applyChanneledHeal(
  damageable: Damageable,
  def: SpellDefinition,
): void {
  const amount = def.healAmount ?? 20;
  damageable.hp = Math.min(damageable.maxHp, damageable.hp + amount);
  damageable.alive = damageable.hp > 0;
}