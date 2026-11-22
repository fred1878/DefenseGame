import Phaser from "phaser";
import { defenseHalfHeight, defenseHalfWidth } from "../config/defense";
import { PLAYER_TUNING } from "../config/player";
import { ConfigLoadError } from "../core/configValidation";
import type { EnemyDef } from "../core/DataStore";
import type { EnemyKnockbackCarrier } from "../combat/enemyKnockback";

/** Extra path radius beyond body (authored WU from `entity-physics.json`). */
export let ENEMY_PATH_CLEARANCE_MARGIN_WU = unsetMargin();

/** Nav-grid inflation around static obstacle colliders (authored WU). */
export let STATIC_OBSTACLE_NAV_CLEARANCE_WU = unsetMargin();

/** Caps combined knockback velocity as `strength * knockbackVelocityCapMult`. */
export let KNOCKBACK_VELOCITY_CAP_MULT = unsetMargin();

let enemyBodyRadiusById: Record<string, number> | null = null;

function unsetMargin(): number {
  return new Proxy({} as object, {
    get() {
      throw new Error(
        "Path clearance margin not loaded — Boot must apply public/data/entity-physics.json",
      );
    },
  }) as unknown as number;
}

export function applyEntityPhysics(tuning: {
  enemyPathClearanceMarginWu: number;
  staticObstacleNavClearanceWu: number;
  knockbackVelocityCapMult: number;
}): void {
  ENEMY_PATH_CLEARANCE_MARGIN_WU = tuning.enemyPathClearanceMarginWu;
  STATIC_OBSTACLE_NAV_CLEARANCE_WU = tuning.staticObstacleNavClearanceWu;
  KNOCKBACK_VELOCITY_CAP_MULT = tuning.knockbackVelocityCapMult;
}

export function knockbackVelocityCapMult(): number {
  return KNOCKBACK_VELOCITY_CAP_MULT;
}

/** Build lookup table from normalized `enemies.json` rows (Boot / tests). */
export function applyEnemyBodyRadii(enemies: Record<string, EnemyDef>): void {
  const map: Record<string, number> = {};
  for (const [id, row] of Object.entries(enemies)) {
    map[id] = row.bodyRadiusWu;
  }
  enemyBodyRadiusById = map;
}

/** Arcade physics circle radius for the player (from `public/data/player.json`). */
/** Player collision radius in authored world units. */
export function playerBodyRadiusPx(): number {
  return PLAYER_TUNING.bodyRadiusWu;
}

export function enemyCollisionBodyRadius(defId: string): number {
  if (!enemyBodyRadiusById) {
    throw new Error(
      "Enemy body radii not loaded — call applyEnemyBodyRadii after enemies.json",
    );
  }
  const r = enemyBodyRadiusById[defId];
  if (r === undefined) {
    throw new ConfigLoadError(`Missing enemy body radius for id ${defId}`);
  }
  return r;
}

const MELEE_COLLISION_BEHAVIORS = new Set([
  "meleeChaser",
  "bruiser",
  "charger",
  "ward",
  "wallSiege",
]);

/** Behaviors that use wide melee collision vs the player (standoff / arcade overlap). */
export function isMeleeBodyCollisionBehavior(behavior: string): boolean {
  return MELEE_COLLISION_BEHAVIORS.has(behavior);
}

export function enemyPathClearancePx(defId: string): number {
  return enemyCollisionBodyRadius(defId) + ENEMY_PATH_CLEARANCE_MARGIN_WU;
}

/** Player footprint for A* peer avoidance while routing to the wall. */
export function playerPathClearancePx(): number {
  return playerBodyRadiusPx() + ENEMY_PATH_CLEARANCE_MARGIN_WU;
}

/** Static obstacle inflation on the shared defense nav grid. */
export function maxNavObstacleClearancePx(): number {
  return STATIC_OBSTACLE_NAV_CLEARANCE_WU;
}

/** Centers a circle body on the sprite anchor after {@link Phaser.GameObjects.Components.DisplaySize#setDisplaySize}. */
export function applyArcadeCircleCollider(
  sprite: Phaser.Physics.Arcade.Sprite,
  circleRadius: number,
): void {
  const offsetX = sprite.displayWidth / 2 - circleRadius;
  const offsetY = sprite.displayHeight / 2 - circleRadius;
  sprite.setCircle(circleRadius, offsetX, offsetY);
}

export type DefensePlayBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

/** Inset defense field so a circle body at (x, y) stays fully on the playable ground. */
export function defensePlayBoundsInset(bodyRadiusPx: number): DefensePlayBounds {
  const halfW = defenseHalfWidth();
  const halfH = defenseHalfHeight();
  const inset = Math.max(0, bodyRadiusPx);
  return {
    minX: -halfW + inset,
    maxX: halfW - inset,
    minY: -halfH + inset,
    maxY: halfH - inset,
  };
}

export function clampToDefensePlayBounds(
  x: number,
  y: number,
  bounds: DefensePlayBounds,
): { x: number; y: number; changed: boolean } {
  const nx = Math.min(bounds.maxX, Math.max(bounds.minX, x));
  const ny = Math.min(bounds.maxY, Math.max(bounds.minY, y));
  return { x: nx, y: ny, changed: nx !== x || ny !== y };
}

/**
 * Snap an enemy back onto the field when knockback displaced the body center outside
 * nav / camera bounds; clears residual knockback so pathing can recover.
 */
export function enforceEnemyDefenseBounds(
  enemy: EnemyKnockbackCarrier,
  bodyRadiusPx: number,
): boolean {
  const bounds = defensePlayBoundsInset(bodyRadiusPx);
  const clamped = clampToDefensePlayBounds(
    enemy.sprite.x,
    enemy.sprite.y,
    bounds,
  );
  if (!clamped.changed) return false;
  enemy.sprite.setPosition(clamped.x, clamped.y);
  enemy.knockbackVx = 0;
  enemy.knockbackVy = 0;
  enemy.sprite.setVelocity(0, 0);
  return true;
}

export function tuneArcadeDynamicBody(
  sprite: Phaser.Physics.Arcade.Sprite,
  circleRadius: number,
  options: { pushable?: boolean; worldBounds?: boolean } = {},
): void {
  applyArcadeCircleCollider(sprite, circleRadius);
  sprite.setBounce(0, 0);
  const body = sprite.body as Phaser.Physics.Arcade.Body;
  body.setFriction(0, 0);
  if (options.pushable !== undefined) {
    body.pushable = options.pushable;
  }
  if (options.worldBounds) {
    sprite.setCollideWorldBounds(true);
  }
}