import type Phaser from "phaser";
import {
  hitFlashDurationMs,
  hitFlashFlavorEntry,
  hitFlashTintFor,
} from "../config/hitFlash";
import type { DamageFlavor } from "./DamageSystem";

export { hitFlashDurationMs, hitFlashTintFor } from "../config/hitFlash";

const TIMER_KEY = "hitFlashTimer";
const FLAVOR_KEY = "hitFlashFlavor";
const STRENGTH_KEY = "hitFlashStrength";

/** Multiply-style tint at linear flash strength (1 = full hit color, 0 = white / no tint). */
export function hitFlashTintAtStrength(
  flavor: DamageFlavor,
  strength: number,
): number {
  const full = hitFlashTintFor(flavor);
  const fr = (full >> 16) & 0xff;
  const fg = (full >> 8) & 0xff;
  const fb = full & 0xff;
  const r = Math.round(255 - (255 - fr) * strength);
  const g = Math.round(255 - (255 - fg) * strength);
  const b = Math.round(255 - (255 - fb) * strength);
  return (r << 16) | (g << 8) | b;
}

function finishFlash(
  sprite: Phaser.GameObjects.Sprite | Phaser.Physics.Arcade.Sprite,
): void {
  sprite.clearTint();
  sprite.setAlpha(1);
  sprite.setData(TIMER_KEY, undefined);
  sprite.setData(FLAVOR_KEY, undefined);
  sprite.setData(STRENGTH_KEY, undefined);
}

function applyTint(
  sprite: Phaser.GameObjects.Sprite | Phaser.Physics.Arcade.Sprite,
  flavor: DamageFlavor,
  strength: number,
): void {
  if (strength <= 0) {
    sprite.clearTint();
    sprite.setAlpha(1);
    return;
  }

  const entry = hitFlashFlavorEntry(flavor);

  if (entry.alphaFade) {
    sprite.setAlpha(Math.max(entry.peakAlpha * strength, 0.001));
  } else {
    sprite.setAlpha(1);
  }

  if (entry.mode === "fill") {
    sprite.setTintFill(entry.tint);
    return;
  }

  if (entry.colorFade) {
    sprite.setTint(hitFlashTintAtStrength(flavor, strength));
  } else {
    sprite.setTint(entry.tint);
  }
}

/** Phaser clears tint on `setTexture`; call after facing texture swaps while flash is active. */
export function reapplySpriteHitFlashIfActive(
  sprite: Phaser.GameObjects.Sprite | Phaser.Physics.Arcade.Sprite,
): void {
  if (typeof sprite.getData !== "function") return;
  const flavor = sprite.getData(FLAVOR_KEY) as DamageFlavor | undefined;
  if (!flavor) return;
  const strength = (sprite.getData(STRENGTH_KEY) as number | undefined) ?? 1;
  applyTint(sprite, flavor, strength);
}

export function flashSpriteTint(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Sprite | Phaser.Physics.Arcade.Sprite,
  flavor: DamageFlavor,
): void {
  const prev = sprite.getData(TIMER_KEY) as Phaser.Tweens.Tween | undefined;
  prev?.stop();

  sprite.setData(FLAVOR_KEY, flavor);
  const counter = { strength: 1 };
  sprite.setData(STRENGTH_KEY, 1);
  applyTint(sprite, flavor, 1);

  const tween = scene.tweens.add({
    targets: counter,
    strength: 0,
    duration: hitFlashDurationMs(),
    ease: "Linear",
    onUpdate: () => {
      sprite.setData(STRENGTH_KEY, counter.strength);
      applyTint(sprite, flavor, counter.strength);
    },
    onComplete: () => finishFlash(sprite),
  });
  sprite.setData(TIMER_KEY, tween);
}