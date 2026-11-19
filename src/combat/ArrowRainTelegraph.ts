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

  telegraph.gfx.clear();
  telegraph.gfx.lineStyle(3, pal.stroke, strokeAlpha);
  telegraph.gfx.fillStyle(pal.fill, fillAlpha);
  telegraph.gfx.strokeCircle(telegraph.zoneX, telegraph.zoneY, r);
  telegraph.gfx.fillCircle(telegraph.zoneX, telegraph.zoneY, r);

  if (!raining) {
    const inner = r * (0.35 + t * 0.45);
    telegraph.gfx.lineStyle(2, pal.inner, 0.25 + t * 0.35);
    telegraph.gfx.strokeCircle(telegraph.zoneX, telegraph.zoneY, inner);
  }
}

export function destroyArrowRainTelegraph(telegraph: ArrowRainTelegraph | undefined): void {
  telegraph?.gfx.destroy();
}