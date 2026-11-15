import Phaser from "phaser";
import {
  SPELL_BAR,
  spellById,
  type SpellId,
} from "../config";
import { scaleUiY } from "../core/displayScale";
import { SpellCastController } from "../combat/SpellCastController";
import { createTouchButton, interactiveObjectScreenRect } from "./touchButton";
import { readSafeInsets, spellBarSlotOrigin } from "./screenLayout";

export type SpellBarCallbacks = {
  onCastRequest: (spellId: SpellId) => void;
};

type CooldownVisual = {
  overlay: Phaser.GameObjects.Rectangle;
};

export class SpellBar {
  private readonly caster: SpellCastController;
  private readonly slots: SpellId[];
  private readonly buttons: ReturnType<typeof createTouchButton>[] = [];
  private readonly cooldownVisuals: CooldownVisual[] = [];
  private readonly onCastRequest: (spellId: SpellId) => void;

  constructor(
    scene: Phaser.Scene,
    slotIds: SpellId[],
    caster: SpellCastController,
    callbacks: SpellBarCallbacks,
    depth = 200,
  ) {
    this.caster = caster;
    this.slots = slotIds.slice(0, SPELL_BAR.slotCount);
    this.onCastRequest = callbacks.onCastRequest;

    const safe = readSafeInsets();
    const { centerY, firstSlotCenterX } = spellBarSlotOrigin(
      scene,
      safe,
      this.slots.length,
      SPELL_BAR.slotSizePx,
      SPELL_BAR.slotGapPx,
    );

    for (let i = 0; i < this.slots.length; i++) {
      const spellId = this.slots[i] ?? "";
      const def = spellById(spellId);
      const label = def?.shortLabel ?? "—";
      const x =
        firstSlotCenterX + i * (SPELL_BAR.slotSizePx + SPELL_BAR.slotGapPx);

      const btn = createTouchButton(scene, x, centerY, label, () => {
        if (spellId) this.onCastRequest(spellId);
      }, {
        width: SPELL_BAR.slotSizePx,
        height: SPELL_BAR.slotSizePx,
        depth,
        fontSize: SPELL_BAR.fontSize,
        fillColor: 0x312e81,
        strokeColor: 0x818cf8,
        tapPadding: SPELL_BAR.tapPaddingPx,
      });
      this.buttons.push(btn);

      const overlay = scene.add
        .rectangle(
          x,
          centerY - SPELL_BAR.slotSizePx / 2,
          SPELL_BAR.slotSizePx,
          SPELL_BAR.slotSizePx,
          0x101018,
          0.78,
        )
        .setScrollFactor(0)
        .setDepth(depth + 1)
        .setOrigin(0.5, 0)
        .setVisible(false);

      this.cooldownVisuals.push({ overlay });
    }
  }

  getUiContainers(): Phaser.GameObjects.Container[] {
    return this.buttons.map((b) => b.container);
  }

  /** Screen rect covering the spell row for virtual-stick exclusion. */
  getScreenRect(): { x: number; y: number; width: number; height: number } {
    const pad = scaleUiY(8);
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const btn of this.buttons) {
      const r = interactiveObjectScreenRect(btn.container);
      if (!r) continue;
      minX = Math.min(minX, r.x);
      maxX = Math.max(maxX, r.x + r.width);
      minY = Math.min(minY, r.y);
      maxY = Math.max(maxY, r.y + r.height);
    }
    if (!Number.isFinite(minX)) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }
    return {
      x: minX - pad,
      y: minY - pad,
      width: maxX - minX + pad * 2,
      height: maxY - minY + pad * 2,
    };
  }

  e2eSlotTapCenters(): { index: number; x: number; y: number }[] {
    const centers: { index: number; x: number; y: number }[] = [];
    for (let i = 0; i < this.buttons.length; i++) {
      const r = interactiveObjectScreenRect(this.buttons[i]!.container);
      if (!r) continue;
      centers.push({
        index: i,
        x: r.x + r.width / 2,
        y: r.y + r.height / 2,
      });
    }
    return centers;
  }

  refreshCooldownOverlays(): void {
    const slotH = SPELL_BAR.slotSizePx;
    for (let i = 0; i < this.slots.length; i++) {
      const id = this.slots[i];
      const remaining = id ? this.caster.getCooldownRemaining(id) : 0;
      const def = id ? spellById(id) : undefined;
      const onCd = remaining > 0 && !!def;
      const btn = this.buttons[i];
      const visual = this.cooldownVisuals[i];
      if (!btn || !visual) continue;

      btn.container.setAlpha(onCd ? 0.45 : 1);

      visual.overlay.setVisible(onCd);
      if (!onCd || !def) continue;

      const ratio = Phaser.Math.Clamp(remaining / def.cooldownMs, 0, 1);
      const coverH = slotH * ratio;
      const topY = btn.container.y - slotH / 2;
      visual.overlay.setPosition(btn.container.x, topY);
      visual.overlay.setSize(SPELL_BAR.slotSizePx, coverH);
    }
  }

  destroy(): void {
    for (const v of this.cooldownVisuals) v.overlay.destroy();
  }
}