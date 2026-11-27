import { TOWN_ISO_VIEW } from "../../config/townIsoView";

const V = TOWN_ISO_VIEW;

/** World px of tile (c, r)'s centre on the 2:1 grid. */
export function isoTileCenter(c: number, r: number): { x: number; y: number } {
  return {
    x: V.originX + (V.tileWidth / 2) * (c - r),
    y: V.originY + (V.tileHeight / 2) * (c + r),
  };
}

export function isoWorldToScreen(
  wx: number,
  wy: number,
): { x: number; y: number } {
  return { x: (wx - V.viewX) * V.scale, y: (wy - V.viewY) * V.scale };
}

export function isoScreenToWorld(
  sx: number,
  sy: number,
): { x: number; y: number } {
  return { x: sx / V.scale + V.viewX, y: sy / V.scale + V.viewY };
}

/** Depth for a world object by its foot Y: later rows draw on top (range 1..2). */
export function isoDepthForWorldY(wy: number): number {
  const t = (wy - V.viewY + 400) / (V.viewHeight + 800);
  return 1 + Math.min(1, Math.max(0, t));
}
