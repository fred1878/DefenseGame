import type Phaser from "phaser";

type SceneProjectilePool = Map<string, Phaser.Physics.Arcade.Sprite[]>;

const scenePools = new WeakMap<Phaser.Scene, SceneProjectilePool>();

function poolMap(scene: Phaser.Scene): SceneProjectilePool {
  let map = scenePools.get(scene);
  if (!map) {
    map = new Map();
    scenePools.set(scene, map);
  }
  return map;
}

function stashSprite(
  scene: Phaser.Scene,
  sprite: Phaser.Physics.Arcade.Sprite,
): void {
  const key = sprite.texture.key;
  const stack = poolMap(scene).get(key) ?? [];
  stack.push(sprite);
  poolMap(scene).set(key, stack);
}

/** Deactivate a projectile sprite and return it to the per-scene pool. */
export function releaseProjectileSprite(
  scene: Phaser.Scene,
  sprite: Phaser.Physics.Arcade.Sprite,
): void {
  if (!sprite.scene) return;
  const body = sprite.body as Phaser.Physics.Arcade.Body | null;
  body?.stop();
  if (body) body.enable = false;
  sprite.setActive(false).setVisible(false);
  stashSprite(scene, sprite);
}

export function acquireProjectileSprite(
  scene: Phaser.Scene,
  x: number,
  y: number,
  textureKey: string,
  displayPx: number,
  circleRadiusPx: number,
  depth: number,
): Phaser.Physics.Arcade.Sprite {
  const stack = poolMap(scene).get(textureKey);
  const pooled = stack?.pop();
  if (pooled) {
    pooled.setPosition(x, y);
    pooled.setTexture(textureKey);
    pooled.setDisplaySize(displayPx, displayPx);
    pooled.setCircle(circleRadiusPx);
    pooled.setDepth(depth);
    pooled.setActive(true).setVisible(true);
    pooled.clearTint();
    pooled.setAlpha(1);
    const body = pooled.body as Phaser.Physics.Arcade.Body;
    body.reset(x, y);
    body.enable = true;
    return pooled;
  }
  const sprite = scene.physics.add.sprite(x, y, textureKey);
  sprite.setDisplaySize(displayPx, displayPx);
  sprite.setCircle(circleRadiusPx);
  sprite.setDepth(depth);
  return sprite;
}

/** Tear down pooled sprites when the defense scene shuts down. */
export function destroyProjectilePool(scene: Phaser.Scene): void {
  const map = scenePools.get(scene);
  if (!map) return;
  for (const stack of map.values()) {
    for (const sprite of stack) sprite.destroy();
  }
  scenePools.delete(scene);
}
