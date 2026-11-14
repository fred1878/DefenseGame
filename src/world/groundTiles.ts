import type Phaser from "phaser";
import { GAME } from "../config";

/** Texture keys under `public/assets/tilesets/ground/`. */
export const GROUND_TILE_KEYS = ["ground_v1"] as const;
export type GroundTileKey = (typeof GROUND_TILE_KEYS)[number];

const TILE_SIZE = 64;

function tileSeed(tx: number, ty: number, salt: number): number {
  let h = (tx * 374761393 + ty * 668265263 + salt * 1442695041) | 0;
  h = (h ^ (h >>> 13)) | 0;
  h = (h * 1274126177) | 0;
  return (h ^ (h >>> 16)) >>> 0;
}

function pickTileKey(
  tx: number,
  ty: number,
  grid: Map<string, GroundTileKey>,
  salt: number,
): GroundTileKey {
  const keys = GROUND_TILE_KEYS;
  if (keys.length === 1) return keys[0];

  const neighbors = [
    grid.get(`${tx - 1},${ty}`),
    grid.get(`${tx + 1},${ty}`),
    grid.get(`${tx},${ty - 1}`),
    grid.get(`${tx},${ty + 1}`),
  ];

  let total = 0;
  const weights = keys.map((key, i) => {
    let w = 1 + (tileSeed(tx, ty, salt + i) % 100) / 200;
    for (const n of neighbors) {
      if (n === key) w *= 0.22;
    }
    total += w;
    return w;
  });

  let roll = (tileSeed(tx, ty, salt) % 10000) / 10000;
  roll *= total;
  for (let i = 0; i < keys.length; i++) {
    const w = weights[i] ?? 0;
    roll -= w;
    if (roll <= 0) return keys[i] ?? keys[0];
  }
  return keys[keys.length - 1] ?? keys[0];
}

/** Paints a neighbor-weighted ground grid covering the defense arena. */
export function buildGroundGrid(
  scene: Phaser.Scene,
  salt = 0,
): { tileCount: number; tilesX: number; tilesY: number } {
  const half = GAME.worldHalfSize;
  const tilesX = Math.ceil((half * 2) / TILE_SIZE);
  const tilesY = Math.ceil((half * 2) / TILE_SIZE);
  const originX = -half;
  const originY = -half;
  const grid = new Map<string, GroundTileKey>();

  for (let ty = 0; ty < tilesY; ty++) {
    for (let tx = 0; tx < tilesX; tx++) {
      const key = pickTileKey(tx, ty, grid, salt);
      grid.set(`${tx},${ty}`, key);
      scene.add
        .image(originX + tx * TILE_SIZE + TILE_SIZE / 2, originY + ty * TILE_SIZE + TILE_SIZE / 2, key)
        .setOrigin(0.5)
        .setDepth(0);
    }
  }

  return { tileCount: GROUND_TILE_KEYS.length, tilesX, tilesY };
}