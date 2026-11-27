import type Phaser from "phaser";
import {
  areDamageNumbersEnabled,
  createDamageNumberState,
  damageNumberKindFromSource,
  damageNumberPose,
  damageNumberQueryFromLocation,
  expireDamageNumbers,
  formatDamageNumberText,
  spawnOrAggregateDamageNumber,
  styleForKind,
  type DamageNumberSource,
  type DamageNumberState,
} from "../../combat/damageNumbers";
import { DEFENSE_RENDER_DEPTH } from "../../config";
import {
  DAMAGE_NUMBERS,
  type DamageNumberKind,
} from "../../config/damageNumbers";
import { uiTextResolution } from "../../core/displayScale";
import { scaleUiX, scaleUiY } from "../../config/uiScale";

type TextObj = Phaser.GameObjects.Text;

type SpriteLike = {
  x: number;
  y: number;
  displayHeight: number;
};

/**
 * Pooled Phaser.Text floaters for Defense night. Logic lives in
 * `combat/damageNumbers.ts` so unit tests do not need a real scene.
 * The custom Phaser build includes Text but not BitmapText.
 */
export class DamageNumberFx {
  private state: DamageNumberState = createDamageNumberState();
  private readonly texts = new Map<number, TextObj>();
  private readonly pool: TextObj[] = [];
  private readonly enabled: boolean;

  constructor(private readonly scene: Phaser.Scene) {
    this.enabled = areDamageNumbersEnabled(
      damageNumberQueryFromLocation(
        typeof window === "undefined" ? undefined : window.location.href,
      ),
    );
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  floatFromSource(
    targetId: string,
    sprite: SpriteLike,
    amount: number,
    source: DamageNumberSource,
    isCrit?: boolean,
  ): void {
    this.float(
      targetId,
      sprite,
      amount,
      damageNumberKindFromSource(source),
      isCrit,
    );
  }

  float(
    targetId: string,
    sprite: SpriteLike,
    amount: number,
    kind: DamageNumberKind,
    isCrit?: boolean,
  ): void {
    if (!this.enabled || amount <= 0) return;
    const x = sprite.x;
    const y =
      sprite.y - sprite.displayHeight * 0.4 + scaleUiY(DAMAGE_NUMBERS.offsetY);
    const req =
      isCrit === true
        ? { targetId, x, y, amount, kind, isCrit: true as const }
        : { targetId, x, y, amount, kind };
    const result = spawnOrAggregateDamageNumber(this.state, req, this.now());
    this.state = result.state;
    for (const evicted of result.evictedIds) this.release(evicted);
    const entry = this.state.active.find((e) => e.id === result.id);
    if (!entry) return;
    const text =
      result.action === "aggregate" ? this.texts.get(entry.id) : this.acquire();
    if (!text) return;
    this.texts.set(entry.id, text);
    this.syncText(text, entry.kind, entry.amount, entry.isCrit);
    this.applyPose(entry.id);
  }

  update(): void {
    if (!this.enabled) return;
    const now = this.now();
    const expired = expireDamageNumbers(this.state, now);
    this.state = expired.state;
    for (const id of expired.expiredIds) this.release(id);
    for (const entry of this.state.active) this.applyPose(entry.id);
  }

  destroy(): void {
    for (const id of [...this.texts.keys()]) this.release(id);
    for (const text of this.pool) text.destroy();
    this.pool.length = 0;
    this.state = createDamageNumberState();
  }

  private now(): number {
    return this.scene.time.now;
  }

  private acquire(): TextObj {
    const reused = this.pool.pop();
    if (reused) {
      reused.setActive(true).setVisible(true);
      return reused;
    }
    const text = this.scene.add
      .text(0, 0, "", {
        fontFamily: DAMAGE_NUMBERS.fontFamily,
        fontSize: `${scaleUiX(DAMAGE_NUMBERS.styles.physical.fontSize)}px`,
        color: DAMAGE_NUMBERS.styles.physical.fill,
        stroke: DAMAGE_NUMBERS.styles.physical.stroke,
        strokeThickness: Math.max(
          2,
          scaleUiX(DAMAGE_NUMBERS.styles.physical.strokeThickness),
        ),
        resolution: uiTextResolution(this.scene),
        align: "center",
        fontStyle: "bold",
      })
      .setOrigin(0.5, 0.5)
      .setDepth(DEFENSE_RENDER_DEPTH.damageNumber)
      .setScrollFactor(1);
    return text;
  }

  private release(id: number): void {
    const text = this.texts.get(id);
    if (!text) return;
    this.texts.delete(id);
    text.setActive(false).setVisible(false);
    this.pool.push(text);
  }

  private syncText(
    text: TextObj,
    kind: DamageNumberKind,
    amount: number,
    isCrit: boolean,
  ): void {
    const style = styleForKind(kind);
    const size = isCrit ? style.critFontSize : style.fontSize;
    text.setText(formatDamageNumberText(amount, kind));
    text.setStyle({
      fontFamily: DAMAGE_NUMBERS.fontFamily,
      fontSize: `${scaleUiX(size)}px`,
      color: style.fill,
      stroke: style.stroke,
      strokeThickness: Math.max(2, scaleUiX(style.strokeThickness)),
      resolution: uiTextResolution(this.scene),
      align: "center",
      fontStyle: "bold",
    });
  }

  private applyPose(id: number): void {
    const text = this.texts.get(id);
    const entry = this.state.active.find((e) => e.id === id);
    if (!text || !entry) return;
    const pose = damageNumberPose(entry, this.now());
    text.setPosition(pose.x, pose.y);
    text.setAlpha(pose.alpha);
    text.setScale(pose.scale);
  }
}
