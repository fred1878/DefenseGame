import Phaser from "phaser";

type SceneMeleeFxPool = Map<string, Phaser.GameObjects.Sprite[]>;

const scenePools = new WeakMap<Phaser.Scene, SceneMeleeFxPool>();

function poolMap(scene: Phaser.Scene): SceneMeleeFxPool {
  let map = scenePools.get(scene);
  if (!map) {
    map = new Map();
    scenePools.set(scene, map);
  }
  return map;
}

/**
 * Take an enemy swipe sprite for `textureKey`, reusing a released one when the
 * scene has it. Spawn code retunes display size, transform, depth and alpha.
 */
export function acquireMeleeFxSprite(
  scene: Phaser.Scene,
  x: number,
  y: number,
  textureKey: string,
): Phaser.GameObjects.Sprite {
  const pooled = poolMap(scene).get(textureKey)?.pop();
  if (pooled) {
    pooled.setPosition(x, y);
    pooled.setTexture(textureKey);
    pooled.setActive(true).setVisible(true);
    return pooled;
  }
  return scene.add.sprite(x, y, textureKey);
}

/**
 * Stop a swipe and return its sprite to the per-scene pool (swing finished,
 * enemy died with `fxRecycleOnDeath`). Keeps the sprite out of the display
 * list without allocating a new GameObject for every swing.
 */
export function releaseMeleeFxSprite(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Sprite,
): void {
  if (!sprite.scene || !sprite.active) return;
  sprite.anims.stop();
  sprite.off(Phaser.Animations.Events.ANIMATION_COMPLETE);
  sprite.setActive(false).setVisible(false);
  const key = sprite.texture.key;
  const map = poolMap(scene);
  const stack = map.get(key) ?? [];
  stack.push(sprite);
  map.set(key, stack);
}

/** Destroy every pooled swipe sprite on scene shutdown. */
export function destroyMeleeFxPool(scene: Phaser.Scene): void {
  const map = scenePools.get(scene);
  if (!map) return;
  for (const stack of map.values()) {
    for (const sprite of stack) sprite.destroy();
  }
  scenePools.delete(scene);
}
