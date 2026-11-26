import Phaser from "phaser";
import { DEFENSE_RENDER_DEPTH } from "../config";
import {
  assertPvfxClipReady,
  PVFX_ANIM,
  PVFX_REGEN_AURA_CHANNEL_ALPHA,
  PVFX_REGEN_AURA_CHANNEL_SPRITE_SCALE,
  PVFX_REGEN_AURA_ORIGIN_X,
  PVFX_REGEN_AURA_ORIGIN_Y,
  PVFX_REGEN_AURA_SOURCE_H,
  PVFX_REGEN_AURA_SOURCE_W,
  PVFX_TEXTURE,
} from "../content/combatPvfxAssets";

/** Holy beacon radius — between pre-boost 44 and boosted #278 (52). */
const BEACON_RADIUS_PX = 48;
const BEACON_DEPTH = DEFENSE_RENDER_DEPTH.playerCombatFx;
/** Brief fade when channel ends or is cancelled by movement. */
const CHANNEL_FADE_OUT_MS = 280;

/** Procedural rings — subtle green-gold shift vs legacy all-gold heal vectors. */
const GOLD_RING = 0xd8f0a0;
const WHITE_CORE = 0xf6fff2;
const GOLD_FILL = 0xc4e858;

/**
 * Sustained green-gold healing aura on the caster during channeled Heal.
 * Follow the player each frame via {@link follow}.
 */
export class SpellHealChannelFx {
  private gfx: Phaser.GameObjects.Graphics | null = null;
  private auraLoop: Phaser.GameObjects.Sprite | null = null;
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
    assertPvfxClipReady(
      this.scene,
      PVFX_TEXTURE.regenAura,
      PVFX_ANIM.regenAuraLoop,
      "heal channel",
    );

    const gfx = this.scene.add.graphics();
    gfx.setDepth(BEACON_DEPTH);
    gfx.setBlendMode(Phaser.BlendModes.ADD);
    registerWorldDraw?.(gfx);
    this.gfx = gfx;

    const widthScale =
      (BEACON_RADIUS_PX * PVFX_REGEN_AURA_CHANNEL_SPRITE_SCALE) /
      PVFX_REGEN_AURA_SOURCE_W;
    const displayW = PVFX_REGEN_AURA_SOURCE_W * widthScale;
    const displayH = PVFX_REGEN_AURA_SOURCE_H * widthScale;
    const loop = this.scene.add
      .sprite(centerX, centerY, PVFX_TEXTURE.regenAura)
      .setDepth(BEACON_DEPTH + 1)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(PVFX_REGEN_AURA_CHANNEL_ALPHA)
      .setOrigin(PVFX_REGEN_AURA_ORIGIN_X, PVFX_REGEN_AURA_ORIGIN_Y)
      .setDisplaySize(displayW, displayH)
      .play(PVFX_ANIM.regenAuraLoop);
    registerWorldDraw?.(loop);
    this.auraLoop = loop;

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
    if (this.auraLoop) {
      this.auraLoop.setPosition(centerX, centerY);
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
    const hasGfx = this.gfx || this.auraLoop;
    if (!hasGfx) return;
    this.fading = true;
    this.pulseTween?.stop();
    this.pulseTween = null;
    const targets: Phaser.GameObjects.Components.AlphaSingle[] = [];
    if (this.gfx) targets.push(this.gfx);
    if (this.auraLoop) targets.push(this.auraLoop);
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
    this.auraLoop?.destroy();
    this.auraLoop = null;
  }

  destroy(): void {
    this.stop();
  }
}
