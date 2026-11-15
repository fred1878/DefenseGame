import Phaser from "phaser";
import { GROUND_TILE_SIZE, GROUND_TILE_TEXTURE } from "../content/assets";

export function buildGroundLayer(
  scene: Phaser.Scene,
  worldHalfWidth: number,
  worldHalfHeight: number,
): Phaser.GameObjects.Container {
  const tilesX = Math.ceil((worldHalfWidth * 2) / GROUND_TILE_SIZE);
  const tilesY = Math.ceil((worldHalfHeight * 2) / GROUND_TILE_SIZE);
  const originX = -worldHalfWidth;
  const originY = -worldHalfHeight;
  const layer = scene.add.container(0, 0).setDepth(-10);

  if (!scene.textures.exists(GROUND_TILE_TEXTURE)) {
    return layer;
  }

  for (let ty = 0; ty < tilesY; ty++) {
    for (let tx = 0; tx < tilesX; tx++) {
      const x = originX + tx * GROUND_TILE_SIZE + GROUND_TILE_SIZE / 2;
      const y = originY + ty * GROUND_TILE_SIZE + GROUND_TILE_SIZE / 2;
      const tile = scene.add.image(x, y, GROUND_TILE_TEXTURE).setOrigin(0.5);
      tile.setDisplaySize(GROUND_TILE_SIZE, GROUND_TILE_SIZE);
      layer.add(tile);
    }
  }
  return layer;
}