import type { DefenseSceneE2eHost } from "./DefenseSceneE2EHost";
import type { DefenseSceneE2eDelegate } from "./DefenseSceneE2ETypes";

type Factory = (scene: DefenseSceneE2eDelegate) => DefenseSceneE2eHost;

let factory: Factory | null = null;

/**
 * Called by the lazy E2E chunk (`installE2E`) so the ~1k lines of
 * DefenseScene E2E helpers never ship in the production bundle.
 */
export function registerDefenseSceneE2eHostFactory(f: Factory | null): void {
  factory = f;
}

/** The bound E2E host for `scene`, or null outside E2E mode. */
export function createRegisteredDefenseSceneE2eHost(
  scene: DefenseSceneE2eDelegate,
): DefenseSceneE2eHost | null {
  return factory ? factory(scene) : null;
}
