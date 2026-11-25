/**
 * E2E implementations for DefenseScene `e2e*` wrappers (barrel).
 * Split by area: Combat (input, enemies, night/endless, tap targets),
 * Obstacles (placement, blockers, camera), Hud (layout + pixel probes).
 */
export type {
  DefenseObstacleBumpCardinal,
  DefenseObstacleBumpProbe,
  DefenseSceneE2eDelegate,
} from "./DefenseSceneE2ETypes";
export * from "./DefenseSceneE2ECombat";
export * from "./DefenseSceneE2EObstacles";
export * from "./DefenseSceneE2EHud";
