import Phaser from "phaser";
import { DEFENSE_RENDER_DEPTH } from "../config";
import { COMBAT_FX_TEXTURE } from "../content/assets";

const FLASH_DEPTH = DEFENSE_RENDER_DEPTH.playerCombatFx;
const FLASH_DURATION_MS = 420;

const RING_GOLD = 0xffe090;
const RING_WHITE = 0xffffff;

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
  const shockKey = COMBAT_FX_TEXTURE.spellShockwave;
  let sprite: Phaser.GameObjects.Image | undefined;
  if (scene.textures.exists(shockKey)) {
    sprite = scene.add
      .image(centerX, centerY, shockKey)
      .setDepth(FLASH_DEPTH - 1)
      .setTint(0xfff0c0)
      .setAlpha(0.75)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDisplaySize(56, 56);
    registerWorldDraw?.(sprite);
  }

  const redraw = () => {
    const t = anim.t;
    const r = 16 + 62 * t;
    const fade = 1 - t * 0.88;
    gfx.clear();
    gfx.fillStyle(RING_WHITE, 0.38 * fade);
    gfx.fillCircle(centerX, centerY, r * 0.58);
    gfx.lineStyle(7, RING_GOLD, 0.98 * fade);
    gfx.strokeCircle(centerX, centerY, r);
    gfx.lineStyle(4, RING_WHITE, 0.88 * fade);
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
      sprite?.destroy();
    },
  });

  if (sprite) {
    scene.tweens.add({
      targets: sprite,
      alpha: 0,
      scale: 1.35,
      duration: FLASH_DURATION_MS,
      ease: "Quad.easeOut",
    });
  }
}