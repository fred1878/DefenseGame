import Phaser from "phaser";

/** Arcade physics circle radius (diameter ≈ 34px at 17 for player). */
export const ENTITY_BODY_RADIUS = {
  player: 17,
  enemy: 14,
  /** Slightly wider circle for melee / wall-rush archetypes (collision only). */
  enemyMelee: 17,
} as const;

const MELEE_COLLISION_BEHAVIORS = new Set([
  "meleeChaser",
  "bruiser",
  "charger",
  "ward",
  "wallSiege",
]);

export function enemyCollisionBodyRadius(behavior: string): number {
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