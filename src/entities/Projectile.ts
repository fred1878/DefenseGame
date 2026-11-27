import type Phaser from "phaser";
import { DEFENSE_RENDER_DEPTH } from "../config";
import { COMBAT_FX_TEXTURE, SPRITE_DISPLAY } from "../content/assets";
import { worldDisplayPx } from "../config/worldScale";
import type { Damageable, DamageFlavor } from "../combat/rules/DamageSystem";
import { applyDamage } from "../combat/rules/DamageSystem";
import { segmentFirstCircleHitT } from "../combat/rules/Hitbox";
import { applyKnockbackFrom } from "../combat/rules/Knockback";
import {
  applyEnemyKnockbackFrom,
  type EnemyKnockbackCarrier,
} from "../combat/rules/enemyKnockback";
import type { IceBoltProjectileFxState } from "../combat/fx/SpellIceBoltProjectileFx";
import type { PvfxProjectileFxState } from "../combat/fx/SpellPvfxProjectileFx";
import { projectileTextureRotationOffset } from "../content/combatPvfxAssets";
import {
  acquireProjectileSprite,
  releaseProjectileSprite,
} from "./projectilePool";

export {
  destroyProjectilePool,
  releaseProjectileSprite,
} from "./projectilePool";

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
  /** Owning enemy when spawned from `DefenseEnemyTick`. */
  sourceEnemyId?: string;
  /** Ice Effect 01 travel overlay for `ice_bolt`. */
  iceBoltFx?: IceBoltProjectileFxState | undefined;
  /** PVFX Foundry seamless flight loop overlay. */
  pvfxFlightFx?: PvfxProjectileFxState | undefined;
  /** Committed lob landing (blast center) while in flight. */
  lobAimX?: number;
  lobAimY?: number;
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
  const pvfx = projectileTextureRotationOffset(textureKey);
  if (pvfx !== undefined) return pvfx;
  return SPELL_BOLT_TEXTURES.has(textureKey)
    ? FIRE_BOLT_ROT_OFFSET
    : STONE_THROW_ROT_OFFSET;
}

function aimProjectileSprite(
  sprite: Phaser.Physics.Arcade.Sprite,
  textureKey: string,
): void {
  const body = sprite.body as Phaser.Physics.Arcade.Body;
  const angle = Math.atan2(body.velocity.y, body.velocity.x);
  sprite.setRotation(angle + projectileRotOffset(textureKey));
}

function despawnProjectileSprite(sprite: Phaser.Physics.Arcade.Sprite): void {
  releaseProjectileSprite(sprite.scene, sprite);
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
  damageFlavor: DamageFlavor,
): PlayerProjectile {
  const base = SPELL_BOLT_TEXTURES.has(textureKey)
    ? SPRITE_DISPLAY.fireBolt
    : SPRITE_DISPLAY.stoneThrow;
  const display = worldDisplayPx(base, scene.registry);
  const circleR = worldDisplayPx(4, scene.registry) / 2;
  const sprite = acquireProjectileSprite(
    scene,
    x,
    y,
    textureKey,
    display,
    circleR,
    DEFENSE_RENDER_DEPTH.projectile,
  );
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
  hitEnemyId?: string | undefined;
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
    enemy: EnemyKnockbackCarrier;
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
  let firstTarget: (typeof enemies)[number] | undefined;

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
      if (behavior !== "aoe_on_hit") {
        // Push away from where the projectile struck, not from where it ended
        // the step (a fast shot can overshoot the target within one frame).
        applyEnemyKnockbackFrom(
          firstTarget.enemy,
          x0 + (x1 - x0) * firstT,
          y0 + (y1 - y0) * firstT,
          knockback,
        );
      }
    }
    projectile.damagedEnemyIds = damaged;
    if (behavior === "pierce") {
      if (projectile.pierceRemaining !== undefined) {
        if (projectile.pierceRemaining <= 0) {
          despawnProjectileSprite(projectile.sprite);
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
      despawnProjectileSprite(projectile.sprite);
      return { alive: false, hitEnemyId };
    }
    despawnProjectileSprite(projectile.sprite);
    return { alive: false, hitEnemyId };
  }

  const body = projectile.sprite.body as Phaser.Physics.Arcade.Body;
  const dist = Math.hypot(body.velocity.x, body.velocity.y) * (deltaMs / 1000);
  projectile.traveled += dist;
  projectile.prevX = x1;
  projectile.prevY = y1;

  if (projectile.traveled >= projectile.maxTravel) {
    if (projectile.spellBehavior === "aoe_on_hit" && projectile.blastRadiusWu) {
      const detonation: ProjectileDetonation = {
        x: projectile.sprite.x,
        y: projectile.sprite.y,
        radiusWu: projectile.blastRadiusWu,
        damage: projectile.damage,
        flavor: projectile.damageFlavor,
      };
      projectile.pendingDetonation = detonation;
    }
    despawnProjectileSprite(projectile.sprite);
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
    enemy: EnemyKnockbackCarrier;
  }>;
  knockbackFor: (projectile: PlayerProjectile) => number;
  findEnemy: (id: string) =>
    | {
        id: string;
        x: number;
        y: number;
        damageable: Damageable;
        sprite: Phaser.Physics.Arcade.Sprite;
        enemy: EnemyKnockbackCarrier;
      }
    | undefined;
};

/** Tracking steer + default hit logic; returns optional ground detonation. */
export function updateSpellProjectile(
  projectile: PlayerProjectile,
  ctx: SpellProjectileUpdateContext,
): {
  alive: boolean;
  detonation?: ProjectileDetonation | undefined;
  hitEnemyId?: string | undefined;
} {
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
    "physical",
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
    "physical",
  );
  proj.spellBehavior = "aoe_on_hit";
  proj.blastRadiusWu = blastRadiusWu;
  proj.lobAimX = toX;
  proj.lobAimY = toY;
  return proj;
}

/** Arcade circle radius for stone/bolt projectiles (matches `setCircle` in spawn). */
export function projectileArcadeRadiusPx(
  registry: Phaser.Data.DataManager,
): number {
  return worldDisplayPx(4, registry) / 2;
}

/** Segment-vs-player hit test uses player body radius + this slack. */
export const ENEMY_PROJECTILE_PLAYER_HIT_SLACK_PX = 6;

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
  incomingDamageMult = 1,
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
    player.radius + ENEMY_PROJECTILE_PLAYER_HIT_SLACK_PX,
  );

  if (t !== null && player.damageable.alive) {
    if (projectile.spellBehavior === "aoe_on_hit" && projectile.blastRadiusWu) {
      projectile.pendingDetonation = {
        x: projectile.sprite.x,
        y: projectile.sprite.y,
        radiusWu: projectile.blastRadiusWu,
        damage: projectile.damage,
        flavor: projectile.damageFlavor,
      };
    } else {
      applyDamage(
        player.damageable,
        projectile.damage * incomingDamageMult,
        projectile.damageFlavor,
      );
      // Push away from the impact point on this step's path (see enemy hits).
      applyKnockbackFrom(
        player.sprite,
        x0 + (x1 - x0) * t,
        y0 + (y1 - y0) * t,
        knockback,
      );
    }
    despawnProjectileSprite(projectile.sprite);
    return false;
  }

  const body = projectile.sprite.body as Phaser.Physics.Arcade.Body;
  const dist = Math.hypot(body.velocity.x, body.velocity.y) * (deltaMs / 1000);
  projectile.traveled += dist;
  projectile.prevX = x1;
  projectile.prevY = y1;

  if (projectile.traveled >= projectile.maxTravel) {
    if (projectile.spellBehavior === "aoe_on_hit" && projectile.blastRadiusWu) {
      projectile.pendingDetonation = {
        x: projectile.sprite.x,
        y: projectile.sprite.y,
        radiusWu: projectile.blastRadiusWu,
        damage: projectile.damage,
        flavor: projectile.damageFlavor,
      };
    }
    despawnProjectileSprite(projectile.sprite);
    return false;
  }

  return true;
}
