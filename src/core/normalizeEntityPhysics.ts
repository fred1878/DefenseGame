import type { EntityBodyRadius } from "../entities/entityPhysics";
import {
  requireFiniteNumber,
  requireRecord,
} from "./configValidation";

export type EntityPhysicsInput = {
  entityBodyRadius?: Partial<EntityBodyRadius>;
  enemyPathClearanceMarginPx?: number;
  staticObstacleNavClearancePx?: number;
};

export type EntityPhysicsTuning = {
  entityBodyRadius: EntityBodyRadius;
  enemyPathClearanceMarginPx: number;
  staticObstacleNavClearancePx: number;
};

const RADIUS_KEYS = ["player", "enemy", "enemyMelee", "grunt"] as const satisfies readonly (keyof EntityBodyRadius)[];

export function normalizeEntityPhysics(
  raw: EntityPhysicsInput | null | undefined,
): EntityPhysicsTuning {
  const root = requireRecord(raw, "entity-physics");
  const radiusBlock = requireRecord(
    root.entityBodyRadius,
    "entity-physics.entityBodyRadius",
  );
  const entityBodyRadius = {} as EntityBodyRadius;
  for (const key of RADIUS_KEYS) {
    entityBodyRadius[key] = requireFiniteNumber(
      radiusBlock[key],
      `entity-physics.entityBodyRadius.${key}`,
    );
  }
  return {
    entityBodyRadius,
    enemyPathClearanceMarginPx: requireFiniteNumber(
      root.enemyPathClearanceMarginPx,
      "entity-physics.enemyPathClearanceMarginPx",
    ),
    staticObstacleNavClearancePx: requireFiniteNumber(
      root.staticObstacleNavClearancePx,
      "entity-physics.staticObstacleNavClearancePx",
    ),
  };
}