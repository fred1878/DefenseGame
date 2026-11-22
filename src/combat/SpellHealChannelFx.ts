import Phaser from "phaser";
import { DEFENSE_RENDER_DEPTH } from "../config";
import { COMBAT_FX_TEXTURE } from "../content/assets";

/** Holy beacon radius in world pixels while channeling heal. */
const BEACON_RADIUS_PX = 44;
const BEACON_DEPTH = DEFENSE_RENDER_DEPTH.playerCombatFx;

const GOLD_RING = 0xffe8a0;
const WHITE_CORE = 0xfffef5;
const GOLD_FILL = 0xffcc44;

/**
 * Sustained gold/white healing aura on the caster during channeled Heal.
 * Follow the player each frame via {@link follow}.
 */
export class SpellHealChannelFx {
  private gfx: Phaser.GameObjects.Graphics | null = null;
  private glow: Phaser.GameObjects.Image | null = null;
  private pulseTween: Phaser.Tweens.Tween | null = null;
  private pulse = { phase: 0 };
  private centerX = 0;
  private centerY = 0;

  constructor(private readonly scene: Phaser.Scene) {}

  start(
    centerX: number,
    centerY: number,
    registerWorldDraw?: (go: Phaser.GameObjects.GameObject) => void,
  ): void {
    this.stop();
    const gfx = this.scene.add.graphics();
    gfx.setDepth(BEACON_DEPTH);
    gfx.setBlendMode(Phaser.BlendModes.ADD);
    registerWorldDraw?.(gfx);
    this.gfx = gfx;

    const shockKey = COMBAT_FX_TEXTURE.spellShockwave;
    if (this.scene.textures.exists(shockKey)) {
      const glow = this.scene.add
        .image(centerX, centerY, shockKey)
        .setDepth(BEACON_DEPTH - 1)
        .setTint(0xffe6a8)
        .setAlpha(0.42)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDisplaySize(BEACON_RADIUS_PX * 2.4, BEACON_RADIUS_PX * 2.4);
      registerWorldDraw?.(glow);
      this.glow = glow;
    }

    this.centerX = centerX;
    this.centerY = centerY;
    this.redraw();
    this.pulse.phase = 0;
    this.pulseTween = this.scene.tweens.add({
      targets: this.pulse,
      phase: 1,
      duration: 620,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
      onUpdate: () => this.redraw(),
    });
  }

  follow(centerX: number, centerY: number): void {
    this.centerX = centerX;
    this.centerY = centerY;
    if (this.glow) {
      this.glow.setPosition(centerX, centerY);
    }
    this.redraw();
  }

  private redraw(): void {
    const centerX = this.centerX;
    const centerY = this.centerY;
    const gfx = this.gfx;
    if (!gfx) return;
    const breathe = 0.72 + 0.28 * Math.sin(this.pulse.phase * Math.PI);
    const r = BEACON_RADIUS_PX * (0.92 + 0.08 * breathe);
    gfx.clear();

    gfx.fillStyle(GOLD_FILL, 0.14 * breathe);
    gfx.fillCircle(centerX, centerY, r * 0.72);

    gfx.fillStyle(WHITE_CORE, 0.1 * breathe);
    gfx.fillCircle(centerX, centerY, r * 0.38);

    gfx.lineStyle(3, GOLD_RING, 0.82 * breathe);
    gfx.strokeCircle(centerX, centerY, r);

    gfx.lineStyle(1.5, WHITE_CORE, 0.55 * breathe);
    gfx.strokeCircle(centerX, centerY, r * 0.62);
  }

  stop(): void {
    this.pulseTween?.stop();
    this.pulseTween = null;
    this.gfx?.destroy();
    this.gfx = null;
    this.glow?.destroy();
    this.glow = null;
  }

  destroy(): void {
    this.stop();
  }
}