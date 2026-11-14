import Phaser from "phaser";
import { GROUND_TILE_KEYS, GROUND_TILE_SIZE } from "../config/assets";

/** Tile index from grid coords — stable checker/hash mix when count > 1. */
export function groundTileIndex(
  tileX: number,
  tileY: number,
  tileCount: number,
): number {
  if (tileCount <= 1) return 0;
  const checker = (Math.floor(tileX / 2) + Math.floor(tileY / 2)) % tileCount;
  const jitter =
    (((tileX * 73856093) ^ (tileY * 19349663)) >>> 0) % tileCount;
  return (checker + jitter) % tileCount;
}

export function buildGroundLayer(
  scene: Phaser.Scene,
  worldHalfSize: number,
): Phaser.GameObjects.Container {
  const size = worldHalfSize * 2;
  const tilesX = Math.ceil(size / GROUND_TILE_SIZE);
  const tilesY = Math.ceil(size / GROUND_TILE_SIZE);
  const originX = -worldHalfSize;
  const originY = -worldHalfSize;
  const layer = scene.add.container(0, 0).setDepth(-10);
  const keys = GROUND_TILE_KEYS;

  for (let ty = 0; ty < tilesY; ty++) {
    for (let tx = 0; tx < tilesX; tx++) {
      const idx = groundTileIndex(tx, ty, keys.length);
      const key = keys[idx];
      if (!key || !scene.textures.exists(key)) continue;
      const x = originX + tx * GROUND_TILE_SIZE + GROUND_TILE_SIZE / 2;
      const y = originY + ty * GROUND_TILE_SIZE + GROUND_TILE_SIZE / 2;
      const tile = scene.add.image(x, y, key).setOrigin(0.5);
      tile.setDisplaySize(GROUND_TILE_SIZE, GROUND_TILE_SIZE);
      layer.add(tile);
    }
  }
  return layer;
}