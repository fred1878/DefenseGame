import type Phaser from "phaser";
import { adoptDefenseWorldObject } from "./defenseWorldLayer";

const INSTALLED_REGISTRY_KEY = "defenseWorldLayerHookInstalled";
const SUPPRESS_WORLD_ADOPT_KEY = "defenseSuppressWorldAdopt";
export const DEFENSE_WORLD_LAYER_REGISTRY_KEY = "defenseWorldLayer";

/** HUD / overlay factories use scrollFactor 0 after create; skip auto-adopt while active. */
export function runDefenseUiFactory<T>(scene: Phaser.Scene, fn: () => T): T {
  scene.registry.set(SUPPRESS_WORLD_ADOPT_KEY, true);
  try {
    return fn();
  } finally {
    scene.registry.remove(SUPPRESS_WORLD_ADOPT_KEY);
  }
}

/** Factories that create play-area world display objects during Defense. */
const ADD_WORLD_FACTORY_METHODS = [
  "existing",
  "graphics",
  "image",
  "sprite",
  "particles",
  "circle",
  "rectangle",
  "ellipse",
  "arc",
  "line",
  "text",
  "tileSprite",
  "renderTexture",
  "zone",
  "star",
  "polygon",
  "mesh",
  "nineslice",
] as const;

const PHYSICS_ADD_WORLD_METHODS = [
  "sprite",
  "staticSprite",
  "image",
  "staticImage",
] as const;

function adoptCreatedWorldObject(
  scene: Phaser.Scene,
  go: Phaser.GameObjects.GameObject,
): void {
  if (scene.registry.get(SUPPRESS_WORLD_ADOPT_KEY) === true) return;
  const worldLayer = scene.registry.get(DEFENSE_WORLD_LAYER_REGISTRY_KEY) as
    | Phaser.GameObjects.Layer
    | undefined;
  if (worldLayer) adoptDefenseWorldObject(go, worldLayer);
}

function wrapFactoryMethod<T extends Phaser.GameObjects.GameObject>(
  scene: Phaser.Scene,
  original: (...args: unknown[]) => T,
): (...args: unknown[]) => T {
  return (...args: unknown[]) => {
    const go = original(...args);
    adoptCreatedWorldObject(scene, go);
    return go;
  };
}

function patchFactoryRecord(
  scene: Phaser.Scene,
  target: object,
  methodNames: readonly string[],
): void {
  const record = target as Record<string, unknown>;
  for (const name of methodNames) {
    const original = record[name];
    if (typeof original !== "function") continue;
    const bound = (...args: unknown[]) =>
      (original as (...args: unknown[]) => Phaser.GameObjects.GameObject).apply(
        target,
        args,
      );
    record[name] = wrapFactoryMethod(scene, bound);
  }
}

/** Point the hook at this run's world layer (DefenseScene is restarted across nights). */
export function setDefenseWorldLayerTarget(
  scene: Phaser.Scene,
  worldLayer: Phaser.GameObjects.Layer,
): void {
  scene.registry.set(DEFENSE_WORLD_LAYER_REGISTRY_KEY, worldLayer);
}

/**
 * New `scene.add.*` / `scene.physics.add.*` display objects are parented under the
 * defense world layer so the UI camera (one `ignore` on the layer) never draws them.
 */
export function installDefenseWorldLayerHook(
  scene: Phaser.Scene,
  worldLayer: Phaser.GameObjects.Layer,
): void {
  setDefenseWorldLayerTarget(scene, worldLayer);
  if (scene.registry.get(INSTALLED_REGISTRY_KEY) === true) return;
  scene.registry.set(INSTALLED_REGISTRY_KEY, true);
  patchFactoryRecord(scene, scene.add, ADD_WORLD_FACTORY_METHODS);
  patchFactoryRecord(scene, scene.physics.add, PHYSICS_ADD_WORLD_METHODS);
}
