import Phaser from "phaser";
import { DEFENSE_RENDER_DEPTH } from "../config";
import { COMBAT_FX_TEXTURE, SPRITE_DISPLAY } from "../content/assets";
import { worldDisplayPx } from "../core/worldPixelScale";
import type { Damageable, DamageFlavor } from "../combat/DamageSystem";
import { applyDamage } from "../combat/DamageSystem";
import { segmentFirstCircleHitT } from "../combat/Hitbox";
import { applyKnockbackFrom } from "../combat/Knockback";

/** Source art faces upper-right at rotation 0. */
const FIRE_BOLT_ROT_OFFSET = Math.PI / 4;
const STONE_THROW_ROT_OFFSET = 0;

export type SpellProjectileBehavior =
  | "default"
  | "pierce"
  | "aoe_on_hit"
  | "tracking";

export type PlayerProjectile = {
  id: string;
  sprite: Phaser.Physics.Arcade.Sprite;
  damage: number;
  damageFlavor: DamageFlavor;
  maxTravel: number;
  traveled: number;
  prevX: number;
  prevY: number;
  spellBehavior?: SpellProjectileBehavior;
  /** World-units blast on detonate (arc bomb). */
  blastRadiusWu?: number;
  pierceRemaining?: number;
  trackEnemyId?: string | null;
  damagedEnemyIds?: Set<string>;
  spellId?: string;
  pendingDetonation?: ProjectileDetonation;
};

export type ProjectileDetonation = {
  x: number;
  y: number;
  radiusWu: number;
  damage: number;
  flavor: DamageFlavor;
};

/** MobileRPG atlas projectile slices only (never `fx_fire_bolt`). */
const SPELL_BOLT_TEXTURES = new Set<string>([
  COMBAT_FX_TEXTURE.spellFireBolt,
  COMBAT_FX_TEXTURE.spellIceBolt,
  COMBAT_FX_TEXTURE.spellLightningBolt,
  COMBAT_FX_TEXTURE.spellWaterBolt,
  COMBAT_FX_TEXTURE.spellArcBomb,
]);

function projectileRotOffset(textureKey: string): number {
  return SPELL_BOLT_TEXTURES.has(textureKey)
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
  const base = SPELL_BOLT_TEXTURES.has(textureKey)
    ? SPRITE_DISPLAY.fireBolt
    : SPRITE_DISPLAY.stoneThrow;
  const display = worldDisplayPx(base, scene.registry);
  sprite.setDisplaySize(display, display);
  sprite.setCircle(worldDisplayPx(4, scene.registry) / 2);
  sprite.setDepth(DEFENSE_RENDER_DEPTH.projectile);
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
    spellBehavior: "default",
    damagedEnemyIds: new Set<string>(),
  };
}

function steerProjectileToward(
  projectile: PlayerProjectile,
  tx: number,
  ty: number,
  speed: number,
): void {
  const sprite = projectile.sprite;
  const angle = Math.atan2(ty - sprite.y, tx - sprite.x);
  const body = sprite.body as Phaser.Physics.Arcade.Body;
  body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
  sprite.setRotation(angle + projectileRotOffset(sprite.texture.key));
}

export type ProjectileHitUpdate = {
  alive: boolean;
  hitEnemyId?: string;
};

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
): ProjectileHitUpdate {
  if (!projectile.sprite.active) return { alive: false };

  const x0 = projectile.prevX;
  const y0 = projectile.prevY;
  const x1 = projectile.sprite.x;
  const y1 = projectile.sprite.y;

  aimProjectileSprite(projectile.sprite, projectile.sprite.texture.key);

  let firstT: number | null = null;
  let firstTarget:
    | (typeof enemies)[number]
    | undefined;

  const skipIds = projectile.damagedEnemyIds;
  for (const e of enemies) {
    if (!e.damageable.alive) continue;
    if (skipIds?.has(e.id)) continue;
    const hitR = e.radius + 6;
    const t = segmentFirstCircleHitT(x0, y0, x1, y1, e.x, e.y, hitR);
    if (t === null) continue;
    if (firstT === null || t < firstT) {
      firstT = t;
      firstTarget = e;
    }
  }

  if (firstTarget && firstT !== null) {
    const behavior = projectile.spellBehavior ?? "default";
    const damaged = projectile.damagedEnemyIds ?? new Set<string>();
    let hitEnemyId: string | undefined;
    if (!damaged.has(firstTarget.id)) {
      damaged.add(firstTarget.id);
      hitEnemyId = firstTarget.id;
      applyDamage(
        firstTarget.damageable,
        projectile.damage,
        projectile.damageFlavor,
      );
      applyKnockbackFrom(
        firstTarget.sprite,
        projectile.sprite.x,
        projectile.sprite.y,
        knockback,
      );
    }
    projectile.damagedEnemyIds = damaged;
    if (behavior === "pierce") {
      if (projectile.pierceRemaining !== undefined) {
        if (projectile.pierceRemaining <= 0) {
          projectile.sprite.destroy();
          return { alive: false, hitEnemyId };
        }
        projectile.pierceRemaining -= 1;
      }
      projectile.prevX = x1;
      projectile.prevY = y1;
      return { alive: true, hitEnemyId };
    }
    if (behavior === "aoe_on_hit" && projectile.blastRadiusWu) {
      const detonation: ProjectileDetonation = {
        x: projectile.sprite.x,
        y: projectile.sprite.y,
        radiusWu: projectile.blastRadiusWu,
        damage: projectile.damage,
        flavor: projectile.damageFlavor,
      };
      projectile.pendingDetonation = detonation;
      projectile.sprite.destroy();
      return { alive: false, hitEnemyId };
    }
    projectile.sprite.destroy();
    return { alive: false, hitEnemyId };
  }

  const body = projectile.sprite.body as Phaser.Physics.Arcade.Body;
  const dist = Math.hypot(body.velocity.x, body.velocity.y) * (deltaMs / 1000);
  projectile.traveled += dist;
  projectile.prevX = x1;
  projectile.prevY = y1;

  if (projectile.traveled >= projectile.maxTravel) {
    if (
      projectile.spellBehavior === "aoe_on_hit" &&
      projectile.blastRadiusWu
    ) {
      const detonation: ProjectileDetonation = {
        x: projectile.sprite.x,
        y: projectile.sprite.y,
        radiusWu: projectile.blastRadiusWu,
        damage: projectile.damage,
        flavor: projectile.damageFlavor,
      };
      projectile.pendingDetonation = detonation;
    }
    projectile.sprite.destroy();
    return { alive: false };
  }

  return { alive: true };
}

export type SpellProjectileUpdateContext = {
  deltaMs: number;
  enemies: Array<{
    id: string;
    x: number;
    y: number;
    radius: number;
    damageable: Damageable;
    sprite: Phaser.Physics.Arcade.Sprite;
  }>;
  knockbackFor: (projectile: PlayerProjectile) => number;
  findEnemy: (id: string) =>
    | {
        id: string;
        x: number;
        y: number;
        damageable: Damageable;
        sprite: Phaser.Physics.Arcade.Sprite;
      }
    | undefined;
};

/** Tracking steer + default hit logic; returns optional ground detonation. */
export function updateSpellProjectile(
  projectile: PlayerProjectile,
  ctx: SpellProjectileUpdateContext,
): { alive: boolean; detonation?: ProjectileDetonation; hitEnemyId?: string } {
  if (projectile.spellBehavior === "tracking" && projectile.trackEnemyId) {
    const target = ctx.findEnemy(projectile.trackEnemyId);
    if (target?.damageable.alive) {
      const body = projectile.sprite.body as Phaser.Physics.Arcade.Body;
      const speed = Math.hypot(body.velocity.x, body.velocity.y) || 420;
      steerProjectileToward(projectile, target.x, target.y, speed);
    }
  }

  const hit = updateProjectile(
    projectile,
    ctx.deltaMs,
    ctx.enemies,
    ctx.knockbackFor(projectile),
  );
  const detonation = !hit.alive ? projectile.pendingDetonation : undefined;
  return { alive: hit.alive, detonation, hitEnemyId: hit.hitEnemyId };
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

/** Arcing lob that detonates on impact / max travel (ground AoE, not hitscan). */
export function spawnEnemyLobProjectile(
  scene: Phaser.Scene,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  speed: number,
  damage: number,
  blastRadiusWu: number,
  id: string,
  textureKey: string = COMBAT_FX_TEXTURE.stoneThrow,
): EnemyProjectile {
  const dist = Math.hypot(toX - fromX, toY - fromY);
  const angle = Math.atan2(toY - fromY, toX - fromX);
  const proj = spawnPlayerProjectile(
    scene,
    fromX,
    fromY,
    angle,
    speed,
    damage,
    Math.max(dist + 12, 80),
    id,
    textureKey,
    "default",
  );
  proj.spellBehavior = "aoe_on_hit";
  proj.blastRadiusWu = blastRadiusWu;
  return proj;
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
    if (
      projectile.spellBehavior === "aoe_on_hit" &&
      projectile.blastRadiusWu
    ) {
      projectile.pendingDetonation = {
        x: projectile.sprite.x,
        y: projectile.sprite.y,
        radiusWu: projectile.blastRadiusWu,
        damage: projectile.damage,
        flavor: projectile.damageFlavor,
      };
    } else {
      applyDamage(player.damageable, projectile.damage, projectile.damageFlavor);
      applyKnockbackFrom(
        player.sprite,
        projectile.sprite.x,
        projectile.sprite.y,
        knockback,
      );
    }
    projectile.sprite.destroy();
    return false;
  }

  const body = projectile.sprite.body as Phaser.Physics.Arcade.Body;
  const dist = Math.hypot(body.velocity.x, body.velocity.y) * (deltaMs / 1000);
  projectile.traveled += dist;
  projectile.prevX = x1;
  projectile.prevY = y1;

  if (projectile.traveled >= projectile.maxTravel) {
    if (
      projectile.spellBehavior === "aoe_on_hit" &&
      projectile.blastRadiusWu
    ) {
      projectile.pendingDetonation = {
        x: projectile.sprite.x,
        y: projectile.sprite.y,
        radiusWu: projectile.blastRadiusWu,
        damage: projectile.damage,
        flavor: projectile.damageFlavor,
      };
    }
    projectile.sprite.destroy();
    return false;
  }

  return true;
}