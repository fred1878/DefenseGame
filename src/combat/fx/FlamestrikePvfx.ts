import Phaser from "phaser";
import { DEFENSE_RENDER_DEPTH } from "../../config";
import {
  assertPvfxClipReady,
  PVFX_ANIM,
  PVFX_TEXTURE,
} from "../../content/combatPvfxAssets";

const DEPTH = DEFENSE_RENDER_DEPTH.playerCombatFx;

export const FIRE_PILLAR_SOURCE_W = 64;
export const FIRE_PILLAR_SOURCE_H = 112;
export const FIRE_PILLAR_ORIGIN_X = 32 / FIRE_PILLAR_SOURCE_W;
export const FIRE_PILLAR_ORIGIN_Y = 102 / FIRE_PILLAR_SOURCE_H;

export const GROUND_FLAMES_SOURCE_W = 64;
export const GROUND_FLAMES_SOURCE_H = 40;
export const GROUND_FLAMES_ORIGIN_X = 32 / GROUND_FLAMES_SOURCE_W;
export const GROUND_FLAMES_ORIGIN_Y = 33 / GROUND_FLAMES_SOURCE_H;

/** One-shot pillars on impact. */
export const FLAMESTRIKE_PILLAR_COUNT = 6;

/** Looping ground patches during linger Dot zone. */
export const FLAMESTRIKE_GROUND_FLAMES_COUNT = 5;

/** Deterministic scatter inside blast disk (index-stratified angles + radii). */
export function scatterPointsInDisk(
  centerX: number,
  centerY: number,
  radiusPx: number,
  count: number,
  salt = 0,
): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < count; i++) {
    const angle = ((i + 0.5) / count) * Math.PI * 2 + salt * 0.17;
    const radialT = 0.3 + (0.55 * ((i * 37 + salt) % 100)) / 100;
    const r = radiusPx * radialT;
    points.push({
      x: centerX + Math.cos(angle) * r,
      y: centerY + Math.sin(angle) * r,
    });
  }
  return points;
}

function firePillarDisplaySize(blastRadiusPx: number): {
  width: number;
  height: number;
} {
  const height = Math.max(blastRadiusPx * 1.05, FIRE_PILLAR_SOURCE_H);
  const width = height * (FIRE_PILLAR_SOURCE_W / FIRE_PILLAR_SOURCE_H);
  return { width, height };
}

function groundFlamesDisplaySize(blastRadiusPx: number): {
  width: number;
  height: number;
} {
  const width = Math.max(blastRadiusPx * 0.55, GROUND_FLAMES_SOURCE_W);
  const height = width * (GROUND_FLAMES_SOURCE_H / GROUND_FLAMES_SOURCE_W);
  return { width, height };
}

/** Impact burst: scattered `fire/fire-pillar` one-shots within blast radius. */
export function playFlamestrikeFirePillarBurst(
  scene: Phaser.Scene,
  centerX: number,
  centerY: number,
  blastRadiusPx: number,
  registerWorldDraw?: (go: Phaser.GameObjects.GameObject) => void,
): void {
  assertPvfxClipReady(
    scene,
    PVFX_TEXTURE.firePillar,
    PVFX_ANIM.firePillar,
    "flamestrike_impact",
  );
  const display = firePillarDisplaySize(blastRadiusPx);
  for (const pt of scatterPointsInDisk(
    centerX,
    centerY,
    blastRadiusPx,
    FLAMESTRIKE_PILLAR_COUNT,
    1,
  )) {
    const sprite = scene.add
      .sprite(pt.x, pt.y, PVFX_TEXTURE.firePillar)
      .setDepth(DEPTH)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.95)
      .setOrigin(FIRE_PILLAR_ORIGIN_X, FIRE_PILLAR_ORIGIN_Y)
      .setDisplaySize(display.width, display.height)
      .play(PVFX_ANIM.firePillar);
    registerWorldDraw?.(sprite);
    sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () =>
      sprite.destroy(),
    );
  }
}

export type FlamestrikeLingerFxHandle = { destroy: () => void };

/** Lingering ground AoE visuals — looping `fire/ground-flames` until `destroy()`. */
export function spawnFlamestrikeGroundFlamesLinger(
  scene: Phaser.Scene,
  centerX: number,
  centerY: number,
  blastRadiusPx: number,
  registerWorldDraw?: (go: Phaser.GameObjects.GameObject) => void,
): FlamestrikeLingerFxHandle {
  assertPvfxClipReady(
    scene,
    PVFX_TEXTURE.groundFlames,
    PVFX_ANIM.groundFlamesLoop,
    "flamestrike_linger",
  );
  const display = groundFlamesDisplaySize(blastRadiusPx);
  const sprites: Phaser.GameObjects.Sprite[] = [];
  for (const pt of scatterPointsInDisk(
    centerX,
    centerY,
    blastRadiusPx,
    FLAMESTRIKE_GROUND_FLAMES_COUNT,
    2,
  )) {
    const sprite = scene.add
      .sprite(pt.x, pt.y, PVFX_TEXTURE.groundFlames)
      .setDepth(DEPTH - 0.05)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.88)
      .setOrigin(GROUND_FLAMES_ORIGIN_X, GROUND_FLAMES_ORIGIN_Y)
      .setDisplaySize(display.width, display.height)
      .play(PVFX_ANIM.groundFlamesLoop);
    registerWorldDraw?.(sprite);
    sprites.push(sprite);
  }
  return {
    destroy: () => {
      for (const s of sprites) {
        if (s.active) s.destroy();
      }
    },
  };
}
