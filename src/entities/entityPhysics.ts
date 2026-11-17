import Phaser from "phaser";

/** Arcade physics circle radius (diameter ≈ 34px at 17 for player). */
export const ENTITY_BODY_RADIUS = {
  player: 17,
  enemy: 14,
  /** Wider circle for melee / wall-rush archetypes (collision only). */
  enemyMelee: 21,
  /** Grunt-only rush hitbox — wider than other melee archetypes. */
  grunt: 28,
} as const;

/** Matches {@link DEFENSE_MAP.cellSize} / 2 − 1 px nav margin on obstacle inflation. */
export const ENEMY_PATH_CLEARANCE_MARGIN_PX = 7;

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

export function tuneArcadeDynamicBody(
  sprite: Phaser.Physics.Arcade.Sprite,
  circleRadius: number,
  options: { pushable?: boolean; worldBounds?: boolean } = {},
): void {
  sprite.setCircle(circleRadius);
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