import {
  requireFiniteNumber,
  requireRecord,
} from "./configValidation";

export type EntityPhysicsInput = {
  enemyPathClearanceMarginPx?: number;
  staticObstacleNavClearancePx?: number;
  knockbackVelocityCapMult?: number;
};

export type EntityPhysicsTuning = {
  enemyPathClearanceMarginPx: number;
  staticObstacleNavClearancePx: number;
  knockbackVelocityCapMult: number;
};

export function normalizeEntityPhysics(
  raw: EntityPhysicsInput | null | undefined,
): EntityPhysicsTuning {
  const root = requireRecord(raw, "entity-physics");
  return {
    enemyPathClearanceMarginPx: requireFiniteNumber(
      root.enemyPathClearanceMarginPx,
      "entity-physics.enemyPathClearanceMarginPx",
    ),
    staticObstacleNavClearancePx: requireFiniteNumber(
      root.staticObstacleNavClearancePx,
      "entity-physics.staticObstacleNavClearancePx",
    ),
    knockbackVelocityCapMult: requireFiniteNumber(
      root.knockbackVelocityCapMult,
      "entity-physics.knockbackVelocityCapMult",
    ),
  };
}