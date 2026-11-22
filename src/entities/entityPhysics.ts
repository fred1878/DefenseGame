import Phaser from "phaser";
import { PLAYER_TUNING } from "../config/player";
import { ConfigLoadError } from "../core/configValidation";
import type { EnemyDef } from "../core/DataStore";

/** Matches {@link DEFENSE_MAP.cellSize} / 2 − 1 px nav margin on obstacle inflation. */
export let ENEMY_PATH_CLEARANCE_MARGIN_PX = unsetMargin();

/** Nav-grid inflation around static obstacle colliders (independent of agent body size). */
export let STATIC_OBSTACLE_NAV_CLEARANCE_PX = unsetMargin();

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
  enemyPathClearanceMarginPx: number;
  staticObstacleNavClearancePx: number;
}): void {
  ENEMY_PATH_CLEARANCE_MARGIN_PX = tuning.enemyPathClearanceMarginPx;
  STATIC_OBSTACLE_NAV_CLEARANCE_PX = tuning.staticObstacleNavClearancePx;
}

/** Build lookup table from normalized `enemies.json` rows (Boot / tests). */
export function applyEnemyBodyRadii(enemies: Record<string, EnemyDef>): void {
  const map: Record<string, number> = {};
  for (const [id, row] of Object.entries(enemies)) {
    map[id] = row.bodyRadius;
  }
  enemyBodyRadiusById = map;
}

/** Arcade physics circle radius for the player (from `public/data/player.json`). */
export function playerBodyRadiusPx(): number {
  return PLAYER_TUNING.bodyRadius;
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
  return enemyCollisionBodyRadius(defId) + ENEMY_PATH_CLEARANCE_MARGIN_PX;
}

/** Player footprint for A* peer avoidance while routing to the wall. */
export function playerPathClearancePx(): number {
  return playerBodyRadiusPx() + ENEMY_PATH_CLEARANCE_MARGIN_PX;
}

/** Static obstacle inflation on the shared defense nav grid. */
export function maxNavObstacleClearancePx(): number {
  return STATIC_OBSTACLE_NAV_CLEARANCE_PX;
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