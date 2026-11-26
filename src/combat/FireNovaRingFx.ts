import Phaser from "phaser";
import { DEFENSE_RENDER_DEPTH } from "../config";
import type { SpellDefinition } from "../content/spells";
import {
  assertPvfxClipReady,
  PVFX_ANIM,
  PVFX_TEXTURE,
} from "../content/combatPvfxAssets";

const RING_DEPTH = DEFENSE_RENDER_DEPTH.playerCombatFx;

/** PVFX `fire/flame-ring` lit grid cell size. */
export const FLAME_RING_SOURCE_W = 112;
export const FLAME_RING_SOURCE_H = 80;
export const FLAME_RING_ORIGIN_X = 56 / FLAME_RING_SOURCE_W;
export const FLAME_RING_ORIGIN_Y = 60 / FLAME_RING_SOURCE_H;

/**
 * Peak expanding-ring outer radius in source pixels (manifest peak frame, pivot to trim edge).
 * `blastRadiusPx / this` scales the sheet so the ring matches `blastRadiusWu` via `worldUnit`.
 */
export const FLAME_RING_PEAK_OUTER_RADIUS_PX = 52;

/** Expand duration when the spell has no windup/channel (instant nova); unused by PVFX playback. */
const INSTANT_RING_BASE_MS = 360;
const INSTANT_RING_PER_RADIUS_PX = 1.35;
const INSTANT_RING_MAX_MS = 520;

export function fireNovaRingDurationMs(
  def: Pick<SpellDefinition, "castMs" | "channelMs">,
  radiusPx: number,
): number {
  const authored = (def.castMs ?? 0) + (def.channelMs ?? 0);
  if (authored > 0) return authored;
  return Math.min(
    INSTANT_RING_MAX_MS,
    Math.max(
      INSTANT_RING_BASE_MS,
      Math.round(radiusPx * INSTANT_RING_PER_RADIUS_PX),
    ),
  );
}

export function flameRingDisplaySize(blastRadiusPx: number): {
  width: number;
  height: number;
} {
  const scale = blastRadiusPx / FLAME_RING_PEAK_OUTER_RADIUS_PX;
  return {
    width: FLAME_RING_SOURCE_W * scale,
    height: FLAME_RING_SOURCE_H * scale,
  };
}

/** PVFX `fire/flame-ring` centered on blast; display radius matches `blastRadiusPx`. */
export function showFireNovaRingFx(
  scene: Phaser.Scene,
  centerX: number,
  centerY: number,
  blastRadiusPx: number,
  registerWorldDraw?: (go: Phaser.GameObjects.GameObject) => void,
): void {
  assertPvfxClipReady(
    scene,
    PVFX_TEXTURE.flameRing,
    PVFX_ANIM.flameRing,
    "fire_nova",
  );
  const { width, height } = flameRingDisplaySize(blastRadiusPx);
  const sprite = scene.add
    .sprite(centerX, centerY, PVFX_TEXTURE.flameRing)
    .setDepth(RING_DEPTH)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setAlpha(0.96)
    .setOrigin(FLAME_RING_ORIGIN_X, FLAME_RING_ORIGIN_Y)
    .setDisplaySize(width, height)
    .play(PVFX_ANIM.flameRing);
  registerWorldDraw?.(sprite);
  sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () =>
    sprite.destroy(),
  );
}
