/**
 * E2E implementations exposed as `DefenseScene.e2e.*` (barrel; bound by
 * `DefenseSceneE2EHost.ts`).
 * Split by area: Combat (input, enemies, night/endless, tap targets),
 * Obstacles (placement, blockers, camera), Hud (layout + pixel probes).
 */
export type {
  DefenseObstacleBumpCardinal,
  DefenseSceneE2eDelegate,
} from "./DefenseSceneE2ETypes";
export * from "./DefenseSceneE2ECombat";
export * from "./DefenseSceneE2EObstacles";
export * from "./DefenseSceneE2EHud";