import Phaser from "phaser";
import { DEFENSE_RENDER_DEPTH } from "../config";
import {
  registerSmokeFxAnimations,
  SMOKE_FX_A_ALPHA,
  SMOKE_FX_A_DISPLAY_H_PX,
  SMOKE_FX_A_DISPLAY_W_PX,
  SMOKE_FX_ANIM,
  SMOKE_FX_TEXTURE,
  smokeFxPackLoaded,
} from "../content/smokeFxAssets";
import { worldDisplayPx } from "../core/worldPixelScale";

const DEPTH = DEFENSE_RENDER_DEPTH.enemyCombatFx;

/**
 * One-shot Smoke A at the world position where the charger begins its dash windup.
 * Stays fixed (not parented). `flipX` when charge heads left; no rotation.
 */
export function spawnChargerChargeStartSmokeFx(
  scene: Phaser.Scene,
  worldX: number,
  worldY: number,
  flipX: boolean,
  registerWorldDraw?: (go: Phaser.GameObjects.GameObject) => void,
): void {
  if (!smokeFxPackLoaded(scene)) {
    throw new Error(
      "Charger charge smoke: Smoke A texture missing (fx_smoke_vfx_a)",
    );
  }
  registerSmokeFxAnimations(scene);
  if (!scene.anims.exists(SMOKE_FX_ANIM.chargeStart)) {
    throw new Error(
      `Charger charge smoke: animation ${SMOKE_FX_ANIM.chargeStart} not registered`,
    );
  }

  const reg = scene.registry;
  const sprite = scene.add
    .sprite(worldX, worldY, SMOKE_FX_TEXTURE.smokeA)
    .setDepth(DEPTH)
    .setAlpha(SMOKE_FX_A_ALPHA)
    .setFlipX(flipX)
    .setDisplaySize(
      worldDisplayPx(SMOKE_FX_A_DISPLAY_W_PX, reg),
      worldDisplayPx(SMOKE_FX_A_DISPLAY_H_PX, reg),
    )
    .play(SMOKE_FX_ANIM.chargeStart);
  registerWorldDraw?.(sprite);
  sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
    sprite.destroy();
  });
}