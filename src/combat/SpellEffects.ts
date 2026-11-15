import Phaser from "phaser";
import { PLAYER_TUNING } from "../config";
import type { SpellDefinition } from "../content/spells";
import { applyDamage, type Damageable, type DamageFlavor } from "./DamageSystem";
import {
  spawnPlayerProjectile,
  type PlayerProjectile,
} from "../entities/Projectile";
import { worldUnit } from "../core/worldPixelScale";

export function applyNova(
  scene: Phaser.Scene,
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
  const radius = worldUnit(def.blastRadius ?? 80, scene.registry);
  const damage = (def.baseDamage ?? 20) * damageMult;
  for (const e of enemies) {
    if (!e.damageable.alive) continue;
    const d = Phaser.Math.Distance.Between(playerX, playerY, e.x, e.y);
    if (d <= radius + e.radius) {
      applyDamage(e.damageable, damage, def.damageFlavor ?? "fire");
    }
  }
}

export function spawnSpellProjectile(
  scene: Phaser.Scene,
  playerX: number,
  playerY: number,
  angleRad: number,
  def: SpellDefinition,
  damageMult: number,
  id: string,
): PlayerProjectile {
  const textureKey = def.projectileTextureKey;
  if (!textureKey) {
    throw new Error(`spell ${def.id} has no MobileRPG projectileTextureKey`);
  }
  const speed =
    def.projectileSpeed ?? PLAYER_TUNING.projectileSpeed * 1.05;
  const damage = (def.baseDamage ?? 20) * damageMult;
  const flavor: DamageFlavor = def.damageFlavor ?? "default";
  return spawnPlayerProjectile(
    scene,
    playerX,
    playerY,
    angleRad,
    speed,
    damage,
    worldUnit(PLAYER_TUNING.rangedMaxRange, scene.registry),
    id,
    textureKey,
    flavor,
  );
}

/** @deprecated use spawnSpellProjectile */
export function spawnChanneledFireball(
  scene: Phaser.Scene,
  playerX: number,
  playerY: number,
  angleRad: number,
  def: SpellDefinition,
  damageMult: number,
  id: string,
): PlayerProjectile {
  return spawnSpellProjectile(
    scene,
    playerX,
    playerY,
    angleRad,
    def,
    damageMult,
    id,
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