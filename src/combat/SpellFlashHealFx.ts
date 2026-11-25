import Phaser from "phaser";
import { DEFENSE_RENDER_DEPTH } from "../config";
import { COMBAT_FX_TEXTURE } from "../content/assets";
import {
  HOLY_FX_ANIM,
  HOLY_FX_FLASH_ALPHA,
  HOLY_FX_FLASH_DISPLAY_PX,
  HOLY_FX_TEXTURE,
} from "../content/holyFxAssets";

const FLASH_DEPTH = DEFENSE_RENDER_DEPTH.playerCombatFx;
const FLASH_DURATION_MS = 420;

const RING_GOLD = 0xffe090;
const RING_WHITE = 0xffffff;

/** Vector ring radii at t=0 / t=1 — slightly under boosted #278 sizes (78px peak). */
const FLASH_RING_START_PX = 14;
const FLASH_RING_SPAN_PX = 54;

/** Short holy pulse when Flash Heal resolves (after windup). */
export function showFlashHealPulseFx(
  scene: Phaser.Scene,
  centerX: number,
  centerY: number,
  registerWorldDraw?: (go: Phaser.GameObjects.GameObject) => void,
): void {
  const gfx = scene.add.graphics();
  gfx.setDepth(FLASH_DEPTH);
  gfx.setBlendMode(Phaser.BlendModes.ADD);
  registerWorldDraw?.(gfx);

  const anim = { t: 0 };
  let overlay: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite | undefined;

  const holySpriteActive =
    scene.textures.exists(HOLY_FX_TEXTURE.impact) &&
    (scene.anims?.exists(HOLY_FX_ANIM.flashImpact) ?? false);

  if (holySpriteActive) {
    const holy = scene.add
      .sprite(centerX, centerY, HOLY_FX_TEXTURE.impact)
      .setDepth(FLASH_DEPTH + 1)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(HOLY_FX_FLASH_ALPHA)
      .setDisplaySize(HOLY_FX_FLASH_DISPLAY_PX, HOLY_FX_FLASH_DISPLAY_PX)
      .play(HOLY_FX_ANIM.flashImpact);
    registerWorldDraw?.(holy);
    overlay = holy;
    holy.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      if (overlay === holy) overlay = undefined;
      holy.destroy();
    });
  } else {
    const shockKey = COMBAT_FX_TEXTURE.spellShockwave;
    if (scene.textures.exists(shockKey)) {
      const shock = scene.add
        .image(centerX, centerY, shockKey)
        .setDepth(FLASH_DEPTH - 1)
        .setTint(0xfff0c0)
        .setAlpha(0.75)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDisplaySize(56, 56);
      registerWorldDraw?.(shock);
      overlay = shock;
    }
  }

  const redraw = () => {
    const t = anim.t;
    const r = FLASH_RING_START_PX + FLASH_RING_SPAN_PX * t;
    const fade = 1 - t * 0.88;
    gfx.clear();
    gfx.fillStyle(RING_WHITE, 0.32 * fade);
    gfx.fillCircle(centerX, centerY, r * 0.58);
    gfx.lineStyle(6, RING_GOLD, 0.92 * fade);
    gfx.strokeCircle(centerX, centerY, r);
    gfx.lineStyle(3.5, RING_WHITE, 0.82 * fade);
    gfx.strokeCircle(centerX, centerY, r * 0.78);
  };

  redraw();

  scene.tweens.add({
    targets: anim,
    t: 1,
    duration: FLASH_DURATION_MS,
    ease: "Cubic.easeOut",
    onUpdate: redraw,
    onComplete: () => {
      gfx.destroy();
      overlay?.destroy();
    },
  });

  if (overlay && overlay instanceof Phaser.GameObjects.Image) {
    scene.tweens.add({
      targets: overlay,
      alpha: 0,
      scale: 1.35,
      duration: FLASH_DURATION_MS,
      ease: "Quad.easeOut",
    });
  }
}
