import Phaser from "phaser";
import type { DamageFlavor } from "./DamageSystem";

export const HIT_FLASH_MS = 190;

const TIMER_KEY = "hitFlashTimer";
const FLAVOR_KEY = "hitFlashFlavor";
const STRENGTH_KEY = "hitFlashStrength";

/** Per-flavor tints — fire avoids pure white on light enemy pixels; physical is white for lightning. */
const HIT_TINT: Record<DamageFlavor, number> = {
  fire: 0xff2222,
  physical: 0xffffff,
  frost: 0x99ddff,
  /** Slightly darker than frost (0x99ddff) so multiply-tint reads on pale sprites. */
  water: 0x6eb0d0,
};

export function hitFlashTintFor(flavor: DamageFlavor): number {
  return HIT_TINT[flavor];
}

/** Multiply-style tint at linear flash strength (1 = full hit color, 0 = white / no tint). */
export function hitFlashTintAtStrength(
  flavor: DamageFlavor,
  strength: number,
): number {
  const full = HIT_TINT[flavor];
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

/** Physical/lightning: multiply-tint white is invisible on pale sprites; fill replaces pixels for a strong flash. */
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

  const tint = HIT_TINT[flavor];
  if (flavor === "physical") {
    sprite.setTintFill(tint);
    sprite.setAlpha(Math.max(strength, 0.001));
    return;
  }

  sprite.setAlpha(1);
  sprite.setTint(hitFlashTintAtStrength(flavor, strength));
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
    duration: HIT_FLASH_MS,
    ease: "Linear",
    onUpdate: () => {
      sprite.setData(STRENGTH_KEY, counter.strength);
      applyTint(sprite, flavor, counter.strength);
    },
    onComplete: () => finishFlash(sprite),
  });
  sprite.setData(TIMER_KEY, tween);
}