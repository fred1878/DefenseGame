import Phaser from "phaser";
import { CAST_BAR, SPELL_CHANNEL_THEME, spellById, type SpellId } from "../config";

/** World-space channeled-spell progress: ring + label + thin chip (not anonymous rects). */
export class CastBar {
  private readonly bg: Phaser.GameObjects.Rectangle;
  private readonly fill: Phaser.GameObjects.Rectangle;
  private readonly ring: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private readonly maxFillWidth: number;
  private spellId: SpellId | null = null;
  private worldX = 0;
  private worldY = 0;
  private progress = 0;
  private visible = false;

  constructor(scene: Phaser.Scene) {
    const halfW = CAST_BAR.width / 2;
    this.maxFillWidth = CAST_BAR.width - 2;
    this.ring = scene.add.graphics().setDepth(10);
    this.label = scene.add
      .text(0, 0, "", {
        fontFamily: "monospace",
        fontSize: CAST_BAR.labelFontSize,
        color: "#f4f4f5",
        stroke: "#18181b",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(11)
      .setVisible(false);
    this.bg = scene.add
      .rectangle(0, 0, CAST_BAR.width, CAST_BAR.height, CAST_BAR.bgColor, CAST_BAR.bgAlpha)
      .setOrigin(0.5)
      .setStrokeStyle(1, CAST_BAR.borderColor, 0.65)
      .setDepth(11)
      .setVisible(false);
    this.fill = scene.add
      .rectangle(-halfW + 1, 0, 0, CAST_BAR.height - 2, CAST_BAR.fillColor, CAST_BAR.fillAlpha)
      .setOrigin(0, 0.5)
      .setDepth(12)
      .setVisible(false);
  }

  setActiveSpell(spellId: SpellId | null): void {
    this.spellId = spellId;
    if (!spellId) {
      this.label.setText("");
      return;
    }
    const def = spellById(spellId);
    const theme = SPELL_CHANNEL_THEME[spellId];
    this.label.setText(def?.shortLabel ?? spellId);
    if (theme) {
      this.label.setColor(`#${theme.chip.toString(16).padStart(6, "0")}`);
    }
    this.applyThemeColors();
    if (this.visible) this.redrawRing();
  }

  setWorldPosition(x: number, y: number): void {
    this.worldX = x;
    this.worldY = y;
    const barY = y + CAST_BAR.offsetY;
    this.bg.setPosition(x, barY);
    const halfW = CAST_BAR.width / 2;
    this.fill.setPosition(x - halfW + 1, barY);
    const ringY = y + CAST_BAR.ringYOffset;
    this.label.setPosition(x, ringY + CAST_BAR.labelOffsetY);
    if (this.visible) this.redrawRing();
  }

  setProgress(progress: number): void {
    this.progress = Phaser.Math.Clamp(progress, 0, 1);
    this.fill.width = this.maxFillWidth * this.progress;
    if (this.visible) this.redrawRing();
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.bg.setVisible(visible);
    this.fill.setVisible(visible);
    this.label.setVisible(visible);
    if (!visible) {
      this.ring.clear();
    } else {
      this.redrawRing();
    }
  }

  destroy(): void {
    this.ring.destroy();
    this.label.destroy();
    this.bg.destroy();
    this.fill.destroy();
  }

  private applyThemeColors(): void {
    const theme = this.spellId ? SPELL_CHANNEL_THEME[this.spellId] : undefined;
    const fill = theme?.fill ?? CAST_BAR.fillColor;
    const border = theme?.ring ?? CAST_BAR.borderColor;
    this.fill.setFillStyle(fill, CAST_BAR.fillAlpha);
    this.bg.setStrokeStyle(1, border, 0.7);
  }

  private redrawRing(): void {
    this.ring.clear();
    const theme = this.spellId ? SPELL_CHANNEL_THEME[this.spellId] : undefined;
    const cx = this.worldX;
    const cy = this.worldY + CAST_BAR.ringYOffset;
    const r = CAST_BAR.ringRadius;
    const lw = CAST_BAR.ringLineWidth;

    this.ring.lineStyle(lw, theme?.track ?? CAST_BAR.bgColor, 0.45);
    this.ring.strokeCircle(cx, cy, r);

    if (this.progress <= 0.001) return;

    const start = -Math.PI / 2;
    const end = start + this.progress * Math.PI * 2;
    this.ring.lineStyle(lw + 1, theme?.ring ?? CAST_BAR.fillColor, 0.92);
    this.ring.beginPath();
    this.ring.arc(cx, cy, r, start, end, false);
    this.ring.strokePath();

    this.ring.fillStyle(theme?.ring ?? CAST_BAR.fillColor, 0.12);
    this.ring.beginPath();
    this.ring.arc(cx, cy, r, start, end, false);
    this.ring.lineTo(cx, cy);
    this.ring.closePath();
    this.ring.fillPath();
  }
}