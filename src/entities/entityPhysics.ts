import Phaser from "phaser";

export type EntityBodyRadius = {
  player: number;
  enemy: number;
  /** Wider circle for melee / wall-rush archetypes (collision only). */
  enemyMelee: number;
  /** Grunt-only rush hitbox — wider than other melee archetypes. */
  grunt: number;
};

/** Code defaults when `public/data/entity-physics.json` is absent. */
export const ENTITY_BODY_RADIUS_DEFAULTS: EntityBodyRadius = {
  player: 17,
  enemy: 14,
  enemyMelee: 21,
  grunt: 28,
};

/** Arcade physics circle radius (diameter ≈ 34px at 17 for player). */
export let ENTITY_BODY_RADIUS: EntityBodyRadius = {
  ...ENTITY_BODY_RADIUS_DEFAULTS,
};

/** Matches {@link DEFENSE_MAP.cellSize} / 2 − 1 px nav margin on obstacle inflation. */
export const ENEMY_PATH_CLEARANCE_MARGIN_PX_DEFAULT = 7;

export let ENEMY_PATH_CLEARANCE_MARGIN_PX = ENEMY_PATH_CLEARANCE_MARGIN_PX_DEFAULT;

export function applyEntityPhysics(tuning: {
  entityBodyRadius: EntityBodyRadius;
  enemyPathClearanceMarginPx: number;
}): void {
  ENTITY_BODY_RADIUS = { ...tuning.entityBodyRadius };
  ENEMY_PATH_CLEARANCE_MARGIN_PX = tuning.enemyPathClearanceMarginPx;
}

export function enemyPathClearancePx(defId: string, behavior: string): number {
  return (
    enemyCollisionBodyRadius(behavior, defId) + ENEMY_PATH_CLEARANCE_MARGIN_PX
  );
}

/** Widest melee rush radius used to inflate static obstacles on the shared nav grid. */
export function maxNavObstacleClearancePx(): number {
  return (
    Math.max(ENTITY_BODY_RADIUS.enemyMelee, ENTITY_BODY_RADIUS.grunt) +
    ENEMY_PATH_CLEARANCE_MARGIN_PX
  );
}

const MELEE_COLLISION_BEHAVIORS = new Set([
  "meleeChaser",
  "bruiser",
  "charger",
  "ward",
  "wallSiege",
]);

export function enemyCollisionBodyRadius(
  behavior: string,
  defId?: string,
): number {
  if (defId === "grunt") {
    return ENTITY_BODY_RADIUS.grunt;
  }
  return MELEE_COLLISION_BEHAVIORS.has(behavior)
    ? ENTITY_BODY_RADIUS.enemyMelee
    : ENTITY_BODY_RADIUS.enemy;
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