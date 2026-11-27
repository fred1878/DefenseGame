import { playerTuning } from "../config/player";
import type Phaser from "phaser";
import { defenseHalfHeight, defenseHalfWidth } from "../config/defense";
import { ConfigLoadError } from "../core/data/configValidation";
import type { EnemyDef } from "../core/data/DataStore";
import type { EnemyKnockbackCarrier } from "../combat/rules/enemyKnockback";
import {
  type EntityPhysicsTuning,
  setTuning,
  tuning,
} from "../tuning/gameTuning";

let enemyBodyRadiusById: Record<string, number> | null = null;

/** Set after `public/data/entity-physics.json` loads (Boot). */
export function applyEntityPhysics(next: EntityPhysicsTuning): void {
  setTuning("entityPhysics", next);
}

export function knockbackVelocityCapMult(): number {
  return tuning("entityPhysics").knockbackVelocityCapMult;
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
  return playerTuning().bodyRadiusWu;
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
  return (
    enemyCollisionBodyRadius(defId) +
    tuning("entityPhysics").enemyPathClearanceMarginWu
  );
}

/** Player footprint for A* peer avoidance while routing to the wall. */
export function playerPathClearancePx(): number {
  return (
    playerBodyRadiusPx() + tuning("entityPhysics").enemyPathClearanceMarginWu
  );
}

/** Static obstacle inflation on the shared defense nav grid. */
export function maxNavObstacleClearancePx(): number {
  return tuning("entityPhysics").staticObstacleNavClearanceWu;
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
export function defensePlayBoundsInset(
  bodyRadiusPx: number,
  registry?: Phaser.Data.DataManager,
): DefensePlayBounds {
  const halfW = defenseHalfWidth(registry);
  const halfH = defenseHalfHeight(registry);
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
  const registry = enemy.sprite.scene?.registry;
  const bounds = defensePlayBoundsInset(bodyRadiusPx, registry);
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
