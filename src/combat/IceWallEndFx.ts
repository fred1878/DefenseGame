import Phaser from "phaser";
import { DEFENSE_RENDER_DEPTH } from "../config";
import {
  assertIceCombatFxReady,
  ICE_FX_ANIM,
  ICE_FX_ROOT_ALPHA,
  ICE_FX_ROOT_DISPLAY_PX,
  ICE_FX_TEXTURE,
} from "../content/iceFxAssets";

const DEPTH = DEFENSE_RENDER_DEPTH.obstacleBlock;

/** Ice VFX 2 Ending on ice_wall segment timeout (trimmed strip from frame 5). */
export function playIceWallSegmentEndFx(
  scene: Phaser.Scene,
  worldX: number,
  worldY: number,
  registerWorldDraw?: (go: Phaser.GameObjects.GameObject) => void,
): void {
  assertIceCombatFxReady(scene, "ice_wall segment end");
  if (!scene.anims.exists(ICE_FX_ANIM.wallEnding)) {
    throw new Error(
      `Ice wall end FX: animation ${ICE_FX_ANIM.wallEnding} not registered`,
    );
  }
  const sprite = scene.add
    .sprite(worldX, worldY, ICE_FX_TEXTURE.rootEnding)
    .setDepth(DEPTH + 0.5)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setAlpha(ICE_FX_ROOT_ALPHA)
    .setDisplaySize(ICE_FX_ROOT_DISPLAY_PX, ICE_FX_ROOT_DISPLAY_PX)
    .play(ICE_FX_ANIM.wallEnding);
  registerWorldDraw?.(sprite);
  sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
    sprite.destroy();
  });
}