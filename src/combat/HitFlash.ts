import Phaser from "phaser";
import type { DamageFlavor } from "./DamageSystem";

const FLASH_MS = 140;
const TIMER_KEY = "hitFlashTimer";
const FLAVOR_KEY = "hitFlashFlavor";

/** Visible on enemy art — pure white tint is often a no-op on light pixels. */
const HIT_TINT: Record<DamageFlavor, number> = {
  default: 0xffb8b8,
  fire: 0xff3333,
};

export function hitFlashTintFor(flavor: DamageFlavor): number {
  return HIT_TINT[flavor];
}

function applyTint(
  sprite: Phaser.GameObjects.Sprite | Phaser.Physics.Arcade.Sprite,
  flavor: DamageFlavor,
): void {
  sprite.setTint(HIT_TINT[flavor]);
}

/** Phaser clears tint on `setTexture`; call after facing texture swaps while flash is active. */
export function reapplySpriteHitFlashIfActive(
  sprite: Phaser.GameObjects.Sprite | Phaser.Physics.Arcade.Sprite,
): void {
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
  const timer = scene.time.delayedCall(FLASH_MS, () => {
    sprite.clearTint();
    sprite.setData(TIMER_KEY, undefined);
    sprite.setData(FLAVOR_KEY, undefined);
  });
  sprite.setData(TIMER_KEY, timer);
}