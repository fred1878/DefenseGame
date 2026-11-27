/**
 * Isometric town camera: 2:1 projection on a 64x32 tile grid. Art is authored at 1x in
 * "iso world px"; the town shows a 900x2000 world window scaled 0.6x onto the 540x1200 canvas.
 */
export const TOWN_ISO_VIEW = {
  tileWidth: 64,
  tileHeight: 32,
  /** World px of tile (0, 0)'s centre. */
  originX: 540,
  originY: 1600,
  /** Visible world window (top-left and size, world px). */
  viewX: 90,
  viewY: 220,
  viewWidth: 900,
  viewHeight: 2000,
  /** World → screen scale (viewWidth * scale = canvas width). */
  scale: 0.6,
} as const;
