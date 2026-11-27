import Phaser from "phaser";
import { DEFENSE_RENDER_DEPTH } from "../config";
import {
  registerSmokeFxAnimations,
  SMOKE_FX_ANIM,
  SMOKE_FX_B_ALPHA,
  SMOKE_FX_B_DISPLAY_PX,
  SMOKE_FX_TEXTURE,
  smokeFxPackLoaded,
} from "../content/smokeFxAssets";
import { worldDisplayPx, worldUnit } from "../config/worldScale";

const DEPTH = DEFENSE_RENDER_DEPTH.enemyCombatFx;

/** One-shot Smoke B at lobber payload ground impact; sized to authored blast radius. */
export function spawnLobberGroundImpactSmokeFx(
  scene: Phaser.Scene,
  worldX: number,
  worldY: number,
  blastRadiusWu: number,
  impactVfxBlastMul: number,
  registerWorldDraw?: (go: Phaser.GameObjects.GameObject) => void,
): void {
  if (!smokeFxPackLoaded(scene)) {
    throw new Error(
      "Lobber impact smoke: Smoke B texture missing (fx_smoke_vfx_b)",
    );
  }
  registerSmokeFxAnimations(scene);
  if (!scene.anims.exists(SMOKE_FX_ANIM.lobImpact)) {
    throw new Error(
      `Lobber impact smoke: animation ${SMOKE_FX_ANIM.lobImpact} not registered`,
    );
  }

  const reg = scene.registry;
  const blastRadiusPx = worldUnit(blastRadiusWu, reg);
  const display = Math.max(
    blastRadiusPx * impactVfxBlastMul,
    worldDisplayPx(SMOKE_FX_B_DISPLAY_PX, reg),
  );
  const sprite = scene.add
    .sprite(worldX, worldY, SMOKE_FX_TEXTURE.smokeB)
    .setDepth(DEPTH)
    .setAlpha(SMOKE_FX_B_ALPHA)
    .setDisplaySize(display, display)
    .play(SMOKE_FX_ANIM.lobImpact);
  registerWorldDraw?.(sprite);
  sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
    sprite.destroy();
  });
}
