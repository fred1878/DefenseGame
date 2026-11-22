import Phaser from "phaser";
import type { DamageFlavor } from "./DamageSystem";

export const HIT_FLASH_MS = 190;

const TIMER_KEY = "hitFlashTimer";
const FLAVOR_KEY = "hitFlashFlavor";

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

/** Physical/lightning: multiply-tint white is invisible on pale sprites; fill replaces pixels for a strong flash. */
function applyTint(
  sprite: Phaser.GameObjects.Sprite | Phaser.Physics.Arcade.Sprite,
  flavor: DamageFlavor,
): void {
  const tint = HIT_TINT[flavor];
  if (flavor === "physical") {
    sprite.setTintFill(tint);
  } else {
    sprite.setTint(tint);
  }
}

/** Phaser clears tint on `setTexture`; call after facing texture swaps while flash is active. */
export function reapplySpriteHitFlashIfActive(
  sprite: Phaser.GameObjects.Sprite | Phaser.Physics.Arcade.Sprite,
): void {
  if (typeof sprite.getData !== "function") return;
  const flavor = sprite.getData(FLAVOR_KEY) as DamageFlavor | undefined;
  if (!flavor) return;
  applyTint(sprite, flavor);
}

export function flashSpriteTint(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Sprite | Phaser.Physics.Arcade.Sprite,
  flavor: DamageFlavor,
): void {
  const prev = sprite.getData(TIMER_KEY) as Phaser.Time.TimerEvent | undefined;
  prev?.remove(false);
  sprite.setData(FLAVOR_KEY, flavor);
  applyTint(sprite, flavor);
  const timer = scene.time.delayedCall(HIT_FLASH_MS, () => {
    sprite.clearTint();
    sprite.setData(TIMER_KEY, undefined);
    sprite.setData(FLAVOR_KEY, undefined);
  });
  sprite.setData(TIMER_KEY, timer);
}