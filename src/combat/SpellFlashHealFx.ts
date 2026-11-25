import Phaser from "phaser";
import { DEFENSE_RENDER_DEPTH } from "../config";
import {
  assertPvfxClipReady,
  PVFX_ANIM,
  PVFX_TEXTURE,
} from "../content/combatPvfxAssets";
import { worldDisplayPx } from "../core/worldPixelScale";

const FLASH_DEPTH = DEFENSE_RENDER_DEPTH.playerCombatFx;
const FLASH_DURATION_MS = 420;

const RING_GOLD = 0xffe090;
const RING_WHITE = 0xffffff;

/** Vector ring radii at t=0 / t=1 — slightly under boosted #278 sizes (78px peak). */
const FLASH_RING_START_PX = 14;
const FLASH_RING_SPAN_PX = 54;

const HOLY_CAST_DISPLAY_PX = 76;
const HOLY_CAST_ALPHA = 0.9;

/** Short holy pulse when Flash Heal resolves (after windup). Procedural rings + PVFX holy-cast. */
export function showFlashHealPulseFx(
  scene: Phaser.Scene,
  centerX: number,
  centerY: number,
  registerWorldDraw?: (go: Phaser.GameObjects.GameObject) => void,
): void {
  assertPvfxClipReady(
    scene,
    PVFX_TEXTURE.holyCast,
    PVFX_ANIM.holyCast,
    "flash_heal resolve",
  );

  const gfx = scene.add.graphics();
  gfx.setDepth(FLASH_DEPTH);
  gfx.setBlendMode(Phaser.BlendModes.ADD);
  registerWorldDraw?.(gfx);

  const anim = { t: 0 };
  const reg = scene.registry;
  const display = worldDisplayPx(HOLY_CAST_DISPLAY_PX, reg);
  const holy = scene.add
    .sprite(centerX, centerY, PVFX_TEXTURE.holyCast)
    .setDepth(FLASH_DEPTH + 1)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setAlpha(HOLY_CAST_ALPHA)
    .setDisplaySize(display, display)
    .play(PVFX_ANIM.holyCast);
  registerWorldDraw?.(holy);
  holy.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
    holy.destroy();
  });

  const redraw = () => {
    const t = anim.t;
    const r = FLASH_RING_START_PX + FLASH_RING_SPAN_PX * t;
    const fade = 1 - t * 0.88;
    gfx.clear();
    gfx.fillStyle(RING_WHITE, 0.32 * fade);
    gfx.fillCircle(centerX, centerY, r * 0.58);
    gfx.lineStyle(6, RING_GOLD, 0.92 * fade);
    gfx.strokeCircle(centerX, centerY, r);
    gfx.lineStyle(3.5, RING_WHITE, 0.82 * fade);
    gfx.strokeCircle(centerX, centerY, r * 0.78);
  };

  redraw();

  scene.tweens.add({
    targets: anim,
    t: 1,
    duration: FLASH_DURATION_MS,
    ease: "Cubic.easeOut",
    onUpdate: redraw,
    onComplete: () => {
      gfx.destroy();
    },
  });
}