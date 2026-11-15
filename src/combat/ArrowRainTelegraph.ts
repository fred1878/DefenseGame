import Phaser from "phaser";

export type ArrowRainTelegraph = {
  gfx: Phaser.GameObjects.Graphics;
  zoneX: number;
  zoneY: number;
  phaseMs: number;
  windupMs: number;
  zoneRadius: number;
};

export function spawnArrowRainTelegraph(
  scene: Phaser.Scene,
  zoneX: number,
  zoneY: number,
  windupMs: number,
  zoneRadius: number,
): ArrowRainTelegraph {
  const gfx = scene.add.graphics();
  gfx.setDepth(3);
  return { gfx, zoneX, zoneY, phaseMs: 0, windupMs, zoneRadius };
}

export function updateArrowRainTelegraph(
  telegraph: ArrowRainTelegraph,
  deltaMs: number,
  raining: boolean,
  zoneRadius = telegraph.zoneRadius,
): void {
  telegraph.phaseMs += deltaMs;
  const r = zoneRadius;
  const t = raining
    ? 1
    : Math.min(1, telegraph.phaseMs / Math.max(1, telegraph.windupMs));
  const pulse = 0.35 + 0.25 * Math.sin(telegraph.phaseMs * 0.012);
  const fillAlpha = raining ? 0.22 + pulse * 0.12 : 0.12 + t * 0.2;
  const strokeAlpha = raining ? 0.85 : 0.45 + t * 0.35;

  telegraph.gfx.clear();
  telegraph.gfx.lineStyle(3, 0xffcc66, strokeAlpha);
  telegraph.gfx.fillStyle(0xff5533, fillAlpha);
  telegraph.gfx.strokeCircle(telegraph.zoneX, telegraph.zoneY, r);
  telegraph.gfx.fillCircle(telegraph.zoneX, telegraph.zoneY, r);

  if (!raining) {
    const inner = r * (0.35 + t * 0.45);
    telegraph.gfx.lineStyle(2, 0xffffff, 0.25 + t * 0.35);
    telegraph.gfx.strokeCircle(telegraph.zoneX, telegraph.zoneY, inner);
  }
}

export function destroyArrowRainTelegraph(telegraph: ArrowRainTelegraph | undefined): void {
  telegraph?.gfx.destroy();
}