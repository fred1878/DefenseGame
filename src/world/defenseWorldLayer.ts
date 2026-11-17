import Phaser from "phaser";

type WorldLayerRoot = Phaser.GameObjects.Layer;

function layerAsGameObject(layer: WorldLayerRoot): Phaser.GameObjects.GameObject {
  return layer as unknown as Phaser.GameObjects.GameObject;
}

/** True when `go` is the world layer or nested under it. */
export function isInDefenseWorldLayer(go: Phaser.GameObjects.GameObject, worldLayer: WorldLayerRoot): boolean {
  const root = layerAsGameObject(worldLayer);
  let node: Phaser.GameObjects.GameObject | null = go;
  while (node) {
    if (node === root) return true;
    node = node.parentContainer;
  }
  return false;
}

/** Parent combat/world display objects under the dedicated world layer. */
export function adoptDefenseWorldObject(go: Phaser.GameObjects.GameObject, worldLayer: WorldLayerRoot): void {
  if (go === layerAsGameObject(worldLayer) || isInDefenseWorldLayer(go, worldLayer)) return;
  worldLayer.add(go);
}