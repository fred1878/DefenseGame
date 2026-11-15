import Phaser from "phaser";
import { GROUND_TILE_ASSETS, GROUND_TILE_SIZE } from "../config/assets";
import { groundTileVariantIndex } from "./groundTileVariant";

export function buildGroundLayer(
  scene: Phaser.Scene,
  worldHalfSize: number,
  /** Night number — stable variant map per defense. */
  seed = 0,
): Phaser.GameObjects.Container {
  const size = worldHalfSize * 2;
  const tilesX = Math.ceil(size / GROUND_TILE_SIZE);
  const tilesY = Math.ceil(size / GROUND_TILE_SIZE);
  const originX = -worldHalfSize;
  const originY = -worldHalfSize;
  const layer = scene.add.container(0, 0).setDepth(-10);

  const variantKeys = GROUND_TILE_ASSETS.map((a) => a.key).filter((key) =>
    scene.textures.exists(key),
  );
  if (variantKeys.length === 0) {
    return layer;
  }

  for (let ty = 0; ty < tilesY; ty++) {
    for (let tx = 0; tx < tilesX; tx++) {
      const x = originX + tx * GROUND_TILE_SIZE + GROUND_TILE_SIZE / 2;
      const y = originY + ty * GROUND_TILE_SIZE + GROUND_TILE_SIZE / 2;
      const vi = groundTileVariantIndex(tx, ty, seed, variantKeys.length);
      const tile = scene.add.image(x, y, variantKeys[vi]!).setOrigin(0.5);
      tile.setDisplaySize(GROUND_TILE_SIZE, GROUND_TILE_SIZE);
      layer.add(tile);
    }
  }
  return layer;
}