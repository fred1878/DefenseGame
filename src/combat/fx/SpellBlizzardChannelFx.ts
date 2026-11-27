import Phaser from "phaser";
import { DEFENSE_RENDER_DEPTH } from "../../config";
import { COMBAT_FX_TEXTURE } from "../../content/assets";

/** MobileRPG blizzard slices scattered over the ground AoE while channeling. */
const BLIZZARD_PARTICLE_BASE_SIZE_MIN = 22;
const BLIZZARD_PARTICLE_BASE_SIZE_MAX = 36;
/** Display-size multiplier for channel particles (timing/behavior unchanged). */
const BLIZZARD_PARTICLE_VISUAL_SCALE = 2;

export class SpellBlizzardChannelFx {
  private readonly sprites: Phaser.GameObjects.Image[] = [];
  private readonly tweens: Phaser.Tweens.Tween[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  start(
    centerX: number,
    centerY: number,
    radiusWu: number,
    textureKey: string,
  ): void {
    this.stop();
    if (!this.scene.textures.exists(textureKey)) return;
    const count = Math.min(14, Math.max(8, Math.floor(radiusWu / 14)));
    for (let i = 0; i < count; i++) {
      const ang =
        (i / count) * Math.PI * 2 + Phaser.Math.FloatBetween(-0.2, 0.2);
      const dist = radiusWu * Phaser.Math.FloatBetween(0.15, 0.92);
      const x = centerX + Math.cos(ang) * dist;
      const y = centerY + Math.sin(ang) * dist;
      const size =
        Phaser.Math.Between(
          BLIZZARD_PARTICLE_BASE_SIZE_MIN,
          BLIZZARD_PARTICLE_BASE_SIZE_MAX,
        ) * BLIZZARD_PARTICLE_VISUAL_SCALE;
      const sprite = this.scene.add
        .image(x, y, textureKey)
        .setDepth(DEFENSE_RENDER_DEPTH.enemyCombatFx)
        .setAlpha(Phaser.Math.FloatBetween(0.45, 0.85))
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDisplaySize(size, size)
        .setAngle(Phaser.Math.Between(-40, 40));
      this.sprites.push(sprite);
      const drift = this.scene.tweens.add({
        targets: sprite,
        x: x + Phaser.Math.FloatBetween(-10, 10),
        y: y + Phaser.Math.FloatBetween(-14, 6),
        alpha: { from: sprite.alpha, to: sprite.alpha * 0.35 },
        duration: Phaser.Math.Between(280, 520),
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
      this.tweens.push(drift);
    }
  }

  stop(): void {
    for (const t of this.tweens) t.stop();
    this.tweens.length = 0;
    for (const s of this.sprites) s.destroy();
    this.sprites.length = 0;
  }

  destroy(): void {
    this.stop();
  }

  static defaultTextureKey(): string {
    return COMBAT_FX_TEXTURE.spellBlizzard;
  }
}
