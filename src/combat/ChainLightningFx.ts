import Phaser from "phaser";
import { DEFENSE_RENDER_DEPTH } from "../config";
import { COMBAT_FX_TEXTURE } from "../content/assets";

const CHAIN_FX_DEPTH = DEFENSE_RENDER_DEPTH.playerCombatFx;
const CHAIN_HOLD_MS = 280;
const CHAIN_CORE = 0x99eeff;
const CHAIN_EDGE = 0x44aaff;
const JITTER_SEGMENTS = 5;

export type ChainLightningPoint = { x: number; y: number };

/** Ordered segments from the primary target through each hop. */
export function buildChainLightningSegments(
  primary: ChainLightningPoint,
  hops: readonly ChainLightningPoint[],
): Array<{ from: ChainLightningPoint; to: ChainLightningPoint }> {
  const segments: Array<{ from: ChainLightningPoint; to: ChainLightningPoint }> = [];
  let from = primary;
  for (const hop of hops) {
    segments.push({ from, to: hop });
    from = hop;
  }
  return segments;
}

/**
 * Jagged polyline between two points (stable when `rand` is injected for tests).
 */
export function jitterLightningPolyline(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  segments: number,
  amplitude: number,
  rand: () => number = Math.random,
): ChainLightningPoint[] {
  const pts: ChainLightningPoint[] = [{ x: x1, y: y1 }];
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const along = (rand() * 2 - 1) * amplitude;
    pts.push({
      x: x1 + dx * t + nx * along,
      y: y1 + dy * t + ny * along,
    });
  }
  pts.push({ x: x2, y: y2 });
  return pts;
}

export function showChainLightningFx(
  scene: Phaser.Scene,
  primary: ChainLightningPoint,
  hops: readonly ChainLightningPoint[],
  registerWorldDraw?: (go: Phaser.GameObjects.GameObject) => void,
): void {
  const segments = buildChainLightningSegments(primary, hops);
  if (segments.length === 0) return;

  const gfx = scene.add.graphics();
  gfx.setDepth(CHAIN_FX_DEPTH);
  gfx.setBlendMode(Phaser.BlendModes.ADD);
  registerWorldDraw?.(gfx);

  for (const seg of segments) {
    const poly = jitterLightningPolyline(
      seg.from.x,
      seg.from.y,
      seg.to.x,
      seg.to.y,
      JITTER_SEGMENTS,
      10,
    );
    gfx.lineStyle(3, CHAIN_EDGE, 0.85);
    gfx.beginPath();
    gfx.moveTo(poly[0]!.x, poly[0]!.y);
    for (let i = 1; i < poly.length; i++) {
      gfx.lineTo(poly[i]!.x, poly[i]!.y);
    }
    gfx.strokePath();
    gfx.lineStyle(1.5, CHAIN_CORE, 0.95);
    gfx.beginPath();
    gfx.moveTo(poly[0]!.x, poly[0]!.y);
    for (let i = 1; i < poly.length; i++) {
      gfx.lineTo(poly[i]!.x, poly[i]!.y);
    }
    gfx.strokePath();
  }

  const boltKey = COMBAT_FX_TEXTURE.spellLightningBolt;
  const hopSprites: Phaser.GameObjects.Image[] = [];
  if (scene.textures.exists(boltKey)) {
    for (const hop of hops) {
      const img = scene.add
        .image(hop.x, hop.y, boltKey)
        .setDepth(CHAIN_FX_DEPTH + 0.1)
        .setAlpha(0.9)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(0.85);
      registerWorldDraw?.(img);
      hopSprites.push(img);
    }
  }

  const fadeMs = Math.max(100, CHAIN_HOLD_MS - 80);
  scene.tweens.add({
    targets: [gfx, ...hopSprites],
    alpha: 0,
    duration: fadeMs,
    delay: 40,
    ease: "Quad.easeOut",
    onComplete: () => {
      gfx.destroy();
      for (const s of hopSprites) s.destroy();
    },
  });
}