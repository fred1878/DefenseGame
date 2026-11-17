import Phaser from "phaser";
import { adoptDefenseWorldObject } from "./defenseWorldLayer";

const INSTALLED_REGISTRY_KEY = "defenseWorldLayerHookInstalled";

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
  "container",
  "tileSprite",
  "renderTexture",
  "zone",
  "star",
  "polygon",
  "mesh",
  "nineslice",
] as const;

const PHYSICS_ADD_WORLD_METHODS = ["sprite", "staticSprite", "image", "staticImage"] as const;

function wrapFactoryMethod<T extends Phaser.GameObjects.GameObject>(
  original: (...args: unknown[]) => T,
  worldLayer: Phaser.GameObjects.Layer,
): (...args: unknown[]) => T {
  return (...args: unknown[]) => {
    const go = original(...args);
    adoptDefenseWorldObject(go, worldLayer);
    return go;
  };
}

function patchFactoryRecord(
  target: object,
  methodNames: readonly string[],
  worldLayer: Phaser.GameObjects.Layer,
): void {
  const record = target as Record<string, unknown>;
  for (const name of methodNames) {
    const original = record[name];
    if (typeof original !== "function") continue;
    const bound = (...args: unknown[]) =>
      (original as (...args: unknown[]) => Phaser.GameObjects.GameObject).apply(target, args);
    record[name] = wrapFactoryMethod(bound, worldLayer);
  }
}

/**
 * New `scene.add.*` / `scene.physics.add.*` display objects are parented under the
 * defense world layer so the UI camera (one `ignore` on the layer) never draws them.
 */
export function installDefenseWorldLayerHook(
  scene: Phaser.Scene,
  worldLayer: Phaser.GameObjects.Layer,
): void {
  if (scene.registry.get(INSTALLED_REGISTRY_KEY) === true) return;
  scene.registry.set(INSTALLED_REGISTRY_KEY, true);
  patchFactoryRecord(scene.add, ADD_WORLD_FACTORY_METHODS, worldLayer);
  patchFactoryRecord(scene.physics.add, PHYSICS_ADD_WORLD_METHODS, worldLayer);
}