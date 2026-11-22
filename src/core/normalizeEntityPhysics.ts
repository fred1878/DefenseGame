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