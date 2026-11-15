import Phaser from "phaser";
import {
  GROUND_DECOR_ASSETS,
  GROUND_DECOR_DISPLAY,
  GROUND_TILE_SIZE,
} from "../content/assets";
import {
  groundDecorJitter,
  groundDecorShouldPlace,
  groundTileVariantIndex,
} from "./groundTileVariant";

export function buildGroundDecorLayer(
  scene: Phaser.Scene,
  worldHalfWidth: number,
  worldHalfHeight: number,
  seed: number,
): Phaser.GameObjects.Container {
  const tilesX = Math.ceil((worldHalfWidth * 2) / GROUND_TILE_SIZE);
  const tilesY = Math.ceil((worldHalfHeight * 2) / GROUND_TILE_SIZE);
  const originX = -worldHalfWidth;
  const originY = -worldHalfHeight;
  const layer = scene.add.container(0, 0).setDepth(-9);

  const keys = GROUND_DECOR_ASSETS.map((a) => a.key).filter((k) =>
    scene.textures.exists(k),
  );
  if (keys.length === 0) return layer;

  for (let ty = 0; ty < tilesY; ty++) {
    for (let tx = 0; tx < tilesX; tx++) {
      if (!groundDecorShouldPlace(tx, ty, seed)) continue;
      const vi = groundTileVariantIndex(tx, ty, seed, keys.length);
      const key = keys[vi]!;
      const jitter = GROUND_TILE_SIZE * 0.22;
      const x =
        originX +
        tx * GROUND_TILE_SIZE +
        GROUND_TILE_SIZE / 2 +
        groundDecorJitter(tx, ty, seed, jitter);
      const y =
        originY +
        ty * GROUND_TILE_SIZE +
        GROUND_TILE_SIZE / 2 +
        groundDecorJitter(ty, tx, seed ^ 0x85ebca6b, jitter);
      const disp = GROUND_DECOR_DISPLAY[key] ?? 24;
      const spr = scene.add.image(x, y, key).setOrigin(0.5);
      spr.setDisplaySize(disp, disp);
      layer.add(spr);
    }
  }
  return layer;
}