import Phaser from "phaser";
import { DEFENSE_RENDER_DEPTH } from "../config";

export type ArrowRainTelegraphPalette = {
  fill: number;
  stroke: number;
  inner: number;
};

export const ARROW_RAIN_TELEGRAPH_PALETTE: ArrowRainTelegraphPalette = {
  fill: 0xff5533,
  stroke: 0xffcc66,
  inner: 0xffffff,
};

/** Lob explosive AoE — distinct from arrow-rain archer telegraph. */
export const LOBBER_TELEGRAPH_PALETTE: ArrowRainTelegraphPalette = {
  fill: 0x7c3aed,
  stroke: 0xc4b5fd,
  inner: 0xede9fe,
};

/** Slightly darken palette RGB during active windup (pre-impact) telegraph. */
const TELEGRAPH_WINDUP_COLOR_SCALE = 0.82;

function scaleTelegraphRgb(color: number, factor: number): number {
  const r = Math.min(255, Math.floor(((color >> 16) & 0xff) * factor));
  const g = Math.min(255, Math.floor(((color >> 8) & 0xff) * factor));
  const b = Math.min(255, Math.floor((color & 0xff) * factor));
  return (r << 16) | (g << 8) | b;
}

export type ArrowRainTelegraph = {
  gfx: Phaser.GameObjects.Graphics;
  zoneX: number;
  zoneY: number;
  phaseMs: number;
  windupMs: number;
  zoneRadius: number;
  palette: ArrowRainTelegraphPalette;
};

export function spawnArrowRainTelegraph(
  scene: Phaser.Scene,
  zoneX: number,
  zoneY: number,
  windupMs: number,
  zoneRadius: number,
  palette: ArrowRainTelegraphPalette = ARROW_RAIN_TELEGRAPH_PALETTE,
): ArrowRainTelegraph {
  const gfx = scene.add.graphics();
  gfx.setDepth(DEFENSE_RENDER_DEPTH.floorTelegraph);
  return { gfx, zoneX, zoneY, phaseMs: 0, windupMs, zoneRadius, palette };
}

export function updateArrowRainTelegraph(
  telegraph: ArrowRainTelegraph,
  deltaMs: number,
  raining: boolean,
  zoneRadius = telegraph.zoneRadius,
): void {
  telegraph.phaseMs += deltaMs;
  const r = zoneRadius;
  const pal = telegraph.palette;
  const t = raining
    ? 1
    : Math.min(1, telegraph.phaseMs / Math.max(1, telegraph.windupMs));
  const pulse = 0.35 + 0.25 * Math.sin(telegraph.phaseMs * 0.012);
  const fillAlpha = raining ? 0.22 + pulse * 0.12 : 0.12 + t * 0.2;
  const strokeAlpha = raining ? 0.85 : 0.45 + t * 0.35;
  const colorScale = raining ? 1 : TELEGRAPH_WINDUP_COLOR_SCALE;
  const fillColor = scaleTelegraphRgb(pal.fill, colorScale);
  const strokeColor = scaleTelegraphRgb(pal.stroke, colorScale);

  telegraph.gfx.clear();
  telegraph.gfx.lineStyle(3, strokeColor, strokeAlpha);
  telegraph.gfx.fillStyle(fillColor, fillAlpha);
  telegraph.gfx.strokeCircle(telegraph.zoneX, telegraph.zoneY, r);
  telegraph.gfx.fillCircle(telegraph.zoneX, telegraph.zoneY, r);

  if (!raining) {
    const inner = r * (0.35 + t * 0.45);
    telegraph.gfx.lineStyle(
      2,
      scaleTelegraphRgb(pal.inner, TELEGRAPH_WINDUP_COLOR_SCALE),
      0.25 + t * 0.35,
    );
    telegraph.gfx.strokeCircle(telegraph.zoneX, telegraph.zoneY, inner);
  }
}

export function destroyArrowRainTelegraph(telegraph: ArrowRainTelegraph | undefined): void {
  telegraph?.gfx.destroy();
}