import Phaser from "phaser";
import {
  SPELL_BAR,
  spellById,
  type SpellId,
} from "../config";
import { SpellCastController } from "../combat/SpellCastController";
import { createTouchButton } from "./touchButton";

export type SpellBarCallbacks = {
  onCastRequest: (spellId: SpellId) => void;
};

export class SpellBar {
  private readonly scene: Phaser.Scene;
  private readonly caster: SpellCastController;
  private readonly slots: SpellId[];
  private readonly buttons: ReturnType<typeof createTouchButton>[] = [];
  private readonly cooldownOverlays: Phaser.GameObjects.Rectangle[] = [];
  private readonly onCastRequest: (spellId: SpellId) => void;

  constructor(
    scene: Phaser.Scene,
    slotIds: SpellId[],
    caster: SpellCastController,
    callbacks: SpellBarCallbacks,
    depth = 200,
  ) {
    this.scene = scene;
    this.caster = caster;
    this.slots = slotIds.slice(0, SPELL_BAR.slotCount);
    this.onCastRequest = callbacks.onCastRequest;

    const totalWidth =
      this.slots.length * SPELL_BAR.slotSizePx +
      (this.slots.length - 1) * SPELL_BAR.slotGapPx;
    const startX = (scene.scale.width - totalWidth) / 2 + SPELL_BAR.slotSizePx / 2;
    const y = scene.scale.height - SPELL_BAR.bottomInsetPx;

    for (let i = 0; i < this.slots.length; i++) {
      const spellId = this.slots[i] ?? "";
      const def = spellById(spellId);
      const label = def?.shortLabel ?? "—";
      const x = startX + i * (SPELL_BAR.slotSizePx + SPELL_BAR.slotGapPx);

      const btn = createTouchButton(scene, x, y, label, () => {
        if (spellId) this.onCastRequest(spellId);
      }, {
        width: SPELL_BAR.slotSizePx,
        height: SPELL_BAR.slotSizePx,
        depth,
        fontSize: SPELL_BAR.fontSize,
        fillColor: 0x4c1d95,
        strokeColor: 0xa78bfa,
        tapPadding: SPELL_BAR.tapPaddingPx,
      });
      this.buttons.push(btn);

      const overlay = scene.add
        .rectangle(x, y, SPELL_BAR.slotSizePx, SPELL_BAR.slotSizePx, 0x000000, 0.55)
        .setScrollFactor(0)
        .setDepth(depth + 1)
        .setVisible(false);
      this.cooldownOverlays.push(overlay);
    }
  }

  getUiContainers(): Phaser.GameObjects.Container[] {
    return this.buttons.map((b) => b.container);
  }

  /** Screen rect covering the spell row for virtual-stick exclusion. */
  getScreenRect(): { x: number; y: number; width: number; height: number } {
    const h = this.scene.scale.height;
    const top = h - SPELL_BAR.bottomInsetPx - SPELL_BAR.slotSizePx / 2 - 24;
    return { x: 0, y: Math.max(0, top), width: this.scene.scale.width, height: 120 };
  }

  refreshCooldownOverlays(): void {
    for (let i = 0; i < this.slots.length; i++) {
      const id = this.slots[i];
      const remaining = id ? this.caster.getCooldownRemaining(id) : 0;
      const def = id ? spellById(id) : undefined;
      const show = remaining > 0 && !!def;
      this.cooldownOverlays[i]?.setVisible(show);
      if (show && def) {
        const alpha = 0.35 + 0.45 * (remaining / def.cooldownMs);
        this.cooldownOverlays[i]?.setFillStyle(0x000000, Math.min(0.75, alpha));
      }
    }
  }

  destroy(): void {
    for (const o of this.cooldownOverlays) o.destroy();
  }
}