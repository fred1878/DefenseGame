import Phaser from "phaser";
import type { DamageFlavor } from "./DamageSystem";

const FLASH_MS = 140;

const HIT_TINT: Record<DamageFlavor, number> = {
  default: 0xffffff,
  fire: 0xff3333,
};

export function flashSpriteTint(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Sprite | Phaser.Physics.Arcade.Sprite,
  flavor: DamageFlavor,
): void {
  const prev = sprite.getData("hitFlashTimer") as Phaser.Time.TimerEvent | undefined;
  prev?.remove(false);
  sprite.setTint(HIT_TINT[flavor]);
  const timer = scene.time.delayedCall(FLASH_MS, () => {
    sprite.clearTint();
    sprite.setData("hitFlashTimer", undefined);
  });
  sprite.setData("hitFlashTimer", timer);
}