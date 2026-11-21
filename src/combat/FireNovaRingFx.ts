import Phaser from "phaser";
import { DEFENSE_RENDER_DEPTH } from "../config";
import type { SpellDefinition } from "../content/spells";

const RING_DEPTH = DEFENSE_RENDER_DEPTH.playerCombatFx;

const RING_OUTER = 0xff3311;
const RING_MID = 0xff5533;
const FILL_CORE = 0xff2200;

/** Expand duration when the spell has no windup/channel (instant nova). */
const INSTANT_RING_BASE_MS = 300;
const INSTANT_RING_PER_RADIUS_PX = 1.1;
const INSTANT_RING_MAX_MS = 420;

export function fireNovaRingDurationMs(
  def: Pick<SpellDefinition, "castMs" | "channelMs">,
  radiusPx: number,
): number {
  const authored = (def.castMs ?? 0) + (def.channelMs ?? 0);
  if (authored > 0) return authored;
  return Math.min(
    INSTANT_RING_MAX_MS,
    Math.max(INSTANT_RING_BASE_MS, Math.round(radiusPx * INSTANT_RING_PER_RADIUS_PX)),
  );
}

/**
 * Red expanding ring from blast center, sized to `radiusPx` (spell blast radius in world pixels).
 */
export function showFireNovaRingFx(
  scene: Phaser.Scene,
  centerX: number,
  centerY: number,
  radiusPx: number,
  durationMs: number,
  registerWorldDraw?: (go: Phaser.GameObjects.GameObject) => void,
): void {
  const gfx = scene.add.graphics();
  gfx.setDepth(RING_DEPTH);
  registerWorldDraw?.(gfx);

  const anim = { t: 0 };

  const redraw = () => {
    const t = anim.t;
    const r = Math.max(4, radiusPx * t);
    const fade = 1 - t * 0.85;
    gfx.clear();

    gfx.fillStyle(FILL_CORE, 0.1 * fade);
    gfx.fillCircle(centerX, centerY, r * 0.92);

    gfx.lineStyle(4, RING_OUTER, 0.75 * fade);
    gfx.strokeCircle(centerX, centerY, r);

    if (r > 10) {
      gfx.lineStyle(2, RING_MID, 0.45 * fade);
      gfx.strokeCircle(centerX, centerY, r * 0.82);
    }
  };

  redraw();

  scene.tweens.add({
    targets: anim,
    t: 1,
    duration: durationMs,
    ease: "Cubic.easeOut",
    onUpdate: redraw,
    onComplete: () => gfx.destroy(),
  });
}