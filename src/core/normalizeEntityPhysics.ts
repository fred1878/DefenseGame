import {
  ENTITY_BODY_RADIUS_DEFAULTS,
  ENEMY_PATH_CLEARANCE_MARGIN_PX_DEFAULT,
  type EntityBodyRadius,
} from "../entities/entityPhysics";

export type EntityPhysicsInput = {
  entityBodyRadius?: Partial<EntityBodyRadius>;
  enemyPathClearanceMarginPx?: number;
};

export type EntityPhysicsTuning = {
  entityBodyRadius: EntityBodyRadius;
  enemyPathClearanceMarginPx: number;
};

export function normalizeEntityPhysics(
  raw: EntityPhysicsInput | null | undefined,
): EntityPhysicsTuning {
  const base = ENTITY_BODY_RADIUS_DEFAULTS;
  const marginDefault = ENEMY_PATH_CLEARANCE_MARGIN_PX_DEFAULT;
  if (!raw) {
    return {
      entityBodyRadius: { ...base },
      enemyPathClearanceMarginPx: marginDefault,
    };
  }
  const r = raw.entityBodyRadius ?? {};
  return {
    entityBodyRadius: {
      player: finiteOr(r.player, base.player),
      enemy: finiteOr(r.enemy, base.enemy),
      enemyMelee: finiteOr(r.enemyMelee, base.enemyMelee),
      grunt: finiteOr(r.grunt, base.grunt),
    },
    enemyPathClearanceMarginPx: finiteOr(
      raw.enemyPathClearanceMarginPx,
      marginDefault,
    ),
  };
}

function finiteOr(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? value! : fallback;
}