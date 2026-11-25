import Phaser from "phaser";
import { DEFENSE_RENDER_DEPTH } from "../config";
import {
  ICE_FX_ANIM,
  ICE_FX_CAST_START_ALPHA,
  ICE_FX_CAST_START_DISPLAY_PX,
  ICE_FX_TEXTURE,
  assertIceCombatFxReady,
} from "../content/iceFxAssets";

const DEPTH = DEFENSE_RENDER_DEPTH.playerCombatFx;

/** Ice VFX 2 Start on the player for frost cast windup (non-looping). */
export class SpellIceCastWindupFx {
  private sprite: Phaser.GameObjects.Sprite | null = null;

  constructor(private readonly scene: Phaser.Scene) {}

  start(
    centerX: number,
    centerY: number,
    castMs: number,
    registerWorldDraw?: (go: Phaser.GameObjects.GameObject) => void,
  ): void {
    this.stop();
    assertIceCombatFxReady(this.scene, "frost cast windup");
    const sprite = this.scene.add
      .sprite(centerX, centerY, ICE_FX_TEXTURE.castStart)
      .setDepth(DEPTH)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(ICE_FX_CAST_START_ALPHA)
      .setDisplaySize(
        ICE_FX_CAST_START_DISPLAY_PX,
        ICE_FX_CAST_START_DISPLAY_PX,
      )
      .play(ICE_FX_ANIM.castStart);
    registerWorldDraw?.(sprite);
    const anim = this.scene.anims.get(ICE_FX_ANIM.castStart);
    const animMs = anim?.duration ?? 0;
    if (animMs > 0 && castMs > 0) {
      sprite.anims.timeScale = animMs / castMs;
    }
    this.sprite = sprite;
  }

  follow(centerX: number, centerY: number): void {
    this.sprite?.setPosition(centerX, centerY);
  }

  stop(): void {
    this.sprite?.destroy();
    this.sprite = null;
  }
}