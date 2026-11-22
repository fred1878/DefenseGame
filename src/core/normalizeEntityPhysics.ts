import {
  requireFiniteNumber,
  requireRecord,
} from "./configValidation";

export type EntityPhysicsInput = {
  enemyPathClearanceMarginWu?: number;
  staticObstacleNavClearanceWu?: number;
  knockbackVelocityCapMult?: number;
};

export type EntityPhysicsTuning = {
  enemyPathClearanceMarginWu: number;
  staticObstacleNavClearanceWu: number;
  knockbackVelocityCapMult: number;
};

/** Boot-required keys for `public/data/entity-physics.json` (see `DATA_FIELDS.md`). */
export const ENTITY_PHYSICS_BOOT_KEYS = [
  "enemyPathClearanceMarginPx",
  "staticObstacleNavClearancePx",
  "knockbackVelocityCapMult",
] as const satisfies readonly (keyof EntityPhysicsTuning)[];

export function normalizeEntityPhysics(
  raw: EntityPhysicsInput | null | undefined,
): EntityPhysicsTuning {
  const root = requireRecord(raw, "entity-physics");
  return {
    enemyPathClearanceMarginWu: requireFiniteNumber(
      root.enemyPathClearanceMarginWu,
      "entity-physics.enemyPathClearanceMarginWu",
    ),
    staticObstacleNavClearanceWu: requireFiniteNumber(
      root.staticObstacleNavClearanceWu,
      "entity-physics.staticObstacleNavClearanceWu",
    ),
    knockbackVelocityCapMult: requireFiniteNumber(
      root.knockbackVelocityCapMult,
      "entity-physics.knockbackVelocityCapMult",
    ),
  };
}