import Phaser from "phaser";
import { DEFENSE_RENDER_DEPTH } from "../config";
import { COMBAT_FX_TEXTURE } from "../content/assets";
import {
  HOLY_FX_ANIM,
  HOLY_FX_CHANNEL_ALPHA,
  HOLY_FX_CHANNEL_SPRITE_SCALE,
  HOLY_FX_TEXTURE,
} from "../content/holyFxAssets";

/** Holy beacon radius — between pre-boost 44 and boosted #278 (52). */
const BEACON_RADIUS_PX = 48;
const BEACON_DEPTH = DEFENSE_RENDER_DEPTH.playerCombatFx;
/** Brief fade when channel ends or is cancelled by movement. */
const CHANNEL_FADE_OUT_MS = 280;

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
  private holyLoop: Phaser.GameObjects.Sprite | null = null;
  private pulseTween: Phaser.Tweens.Tween | null = null;
  private fadeTween: Phaser.Tweens.Tween | null = null;
  private pulse = { phase: 0 };
  private centerX = 0;
  private centerY = 0;
  private fading = false;

  constructor(private readonly scene: Phaser.Scene) {}

  start(
    centerX: number,
    centerY: number,
    registerWorldDraw?: (go: Phaser.GameObjects.GameObject) => void,
  ): void {
    this.stop();
    const holyActive =
      this.scene.textures.exists(HOLY_FX_TEXTURE.channel) &&
      (this.scene.anims?.exists(HOLY_FX_ANIM.channelLoop) ?? false);

    const gfx = this.scene.add.graphics();
    gfx.setDepth(BEACON_DEPTH);
    gfx.setBlendMode(Phaser.BlendModes.ADD);
    registerWorldDraw?.(gfx);
    this.gfx = gfx;

    if (holyActive) {
      const loopSize = BEACON_RADIUS_PX * HOLY_FX_CHANNEL_SPRITE_SCALE;
      const loop = this.scene.add
        .sprite(centerX, centerY, HOLY_FX_TEXTURE.channel)
        .setDepth(BEACON_DEPTH + 1)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(HOLY_FX_CHANNEL_ALPHA)
        .setDisplaySize(loopSize, loopSize)
        .play(HOLY_FX_ANIM.channelLoop);
      registerWorldDraw?.(loop);
      this.holyLoop = loop;
    } else {
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
    if (this.holyLoop) {
      this.holyLoop.setPosition(centerX, centerY);
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

    gfx.fillStyle(GOLD_FILL, 0.22 * breathe);
    gfx.fillCircle(centerX, centerY, r * 0.74);

    gfx.fillStyle(WHITE_CORE, 0.18 * breathe);
    gfx.fillCircle(centerX, centerY, r * 0.42);

    gfx.lineStyle(4.5, GOLD_RING, 0.9 * breathe);
    gfx.strokeCircle(centerX, centerY, r);

    gfx.lineStyle(2.5, WHITE_CORE, 0.78 * breathe);
    gfx.strokeCircle(centerX, centerY, r * 0.64);
  }

  /** Brief alpha fade then destroy (natural end or movement cancel). */
  fadeOut(): void {
    if (this.fading) return;
    const hasGfx = this.gfx || this.glow || this.holyLoop;
    if (!hasGfx) return;
    this.fading = true;
    this.pulseTween?.stop();
    this.pulseTween = null;
    const targets: Phaser.GameObjects.Components.AlphaSingle[] = [];
    if (this.gfx) targets.push(this.gfx);
    if (this.glow) targets.push(this.glow);
    if (this.holyLoop) targets.push(this.holyLoop);
    this.fadeTween = this.scene.tweens.add({
      targets,
      alpha: 0,
      duration: CHANNEL_FADE_OUT_MS,
      ease: "Linear",
      onComplete: () => this.stop(),
    });
  }

  stop(): void {
    this.fadeTween?.stop();
    this.fadeTween = null;
    this.fading = false;
    this.pulseTween?.stop();
    this.pulseTween = null;
    this.gfx?.destroy();
    this.gfx = null;
    this.glow?.destroy();
    this.glow = null;
    this.holyLoop?.destroy();
    this.holyLoop = null;
  }

  destroy(): void {
    this.stop();
  }
}