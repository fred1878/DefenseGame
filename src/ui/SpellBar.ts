import Phaser from "phaser";
import { DEFENSE_SPELL_BAR, defenseSpellBarIconDisplayPx } from "../config";
import { autoCastFlagsForSlots } from "../content/spellBarAutoCast";
import { spellById, type SpellId } from "../content/spells";
import { spellUsesManualGroundAim } from "../content/spellTargeting";
import { spellIconTextureKey } from "../content/assets";
import { scaleUiY } from "../core/displayScale";
import { SpellCastController } from "../combat/SpellCastController";
import {
  bindTapOrLongPress,
  createTouchButton,
  interactiveObjectScreenRect,
} from "./touchButton";
import { readSafeInsets, spellBarSlotCenter } from "./screenLayout";

export type SpellBarCallbacks = {
  onCastRequest: (spellId: SpellId, slotIndex: number) => void;
  onAutoCastToggle: (slotIndex: number) => void;
  onGroundCastArm: (spellId: SpellId, pointer: Phaser.Input.Pointer) => void;
  onGroundCastCancel: () => void;
};

type CooldownVisual = {
  overlay: Phaser.GameObjects.Rectangle;
};

type SlotChrome = {
  autoBorder: Phaser.GameObjects.Rectangle;
  button: ReturnType<typeof createTouchButton>;
};

export class SpellBar {
  private readonly caster: SpellCastController;
  private readonly slots: SpellId[];
  private readonly slotChrome: SlotChrome[] = [];
  private readonly cooldownVisuals: CooldownVisual[] = [];
  private readonly onCastRequest: (spellId: SpellId, slotIndex: number) => void;
  private readonly onAutoCastToggle: (slotIndex: number) => void;
  private readonly onGroundCastArm: (spellId: SpellId, pointer: Phaser.Input.Pointer) => void;
  private readonly onGroundCastCancel: () => void;

  constructor(
    scene: Phaser.Scene,
    slotIds: SpellId[],
    autoCastSpellIds: SpellId[],
    caster: SpellCastController,
    callbacks: SpellBarCallbacks,
    depth = 200,
  ) {
    this.caster = caster;
    this.slots = slotIds.slice(0, DEFENSE_SPELL_BAR.slotCount);
    while (this.slots.length < DEFENSE_SPELL_BAR.slotCount) this.slots.push("");
    const autoFlags = autoCastFlagsForSlots(this.slots, autoCastSpellIds);
    this.onCastRequest = callbacks.onCastRequest;
    this.onAutoCastToggle = callbacks.onAutoCastToggle;
    this.onGroundCastArm = callbacks.onGroundCastArm;
    this.onGroundCastCancel = callbacks.onGroundCastCancel;

    const safe = readSafeInsets();

    for (let i = 0; i < DEFENSE_SPELL_BAR.slotCount; i++) {
      const spellId = this.slots[i] ?? "";
      const iconKey = spellId ? spellIconTextureKey(spellId) : "";
      const hasIcon = Boolean(iconKey && scene.textures.exists(iconKey));
      const label = spellId && !hasIcon ? "" : spellId ? "" : "—";
      const { x, y } = spellBarSlotCenter(
        scene,
        safe,
        i,
        DEFENSE_SPELL_BAR.slotSizePx,
        DEFENSE_SPELL_BAR.slotGapPx,
        DEFENSE_SPELL_BAR.rowGapPx,
      );

      const btn = createTouchButton(scene, x, y, label, () => {}, {
        width: DEFENSE_SPELL_BAR.slotSizePx,
        height: DEFENSE_SPELL_BAR.slotSizePx,
        depth,
        fontSize: DEFENSE_SPELL_BAR.fontSize,
        fillColor: 0x312e81,
        strokeColor: 0x818cf8,
        tapPadding: DEFENSE_SPELL_BAR.tapPaddingPx,
        skipPressBinding: true,
      });
      if (hasIcon) {
        const iconSize = defenseSpellBarIconDisplayPx();
        const icon = scene.add
          .image(0, 0, iconKey!)
          .setDisplaySize(iconSize, iconSize);
        btn.container.add(icon);
        btn.container.bringToTop(icon);
        scene.textures.get(iconKey!).setFilter(Phaser.Textures.FilterMode.NEAREST);
        const textObj = btn.container.list.find(
          (o) => o instanceof Phaser.GameObjects.Text,
        ) as Phaser.GameObjects.Text | undefined;
        textObj?.setVisible(false);
      }

      const slotIndex = i;
      bindTapOrLongPress(
        scene,
        btn.container,
        {
          onTap: () => {
            const id = this.slots[slotIndex] ?? "";
            if (!id) return;
            const def = spellById(id);
            if (def && spellUsesManualGroundAim(def)) return;
            this.onCastRequest(id, slotIndex);
          },
          onLongPress: () => {
            this.onGroundCastCancel();
            this.onAutoCastToggle(slotIndex);
          },
          onPressStart: (pointer) => {
            const id = this.slots[slotIndex] ?? "";
            if (!id) return;
            const def = spellById(id);
            if (!def || !spellUsesManualGroundAim(def)) return;
            this.onGroundCastArm(id, pointer);
          },
          longPressMs: DEFENSE_SPELL_BAR.longPressMs,
        },
        {
          bg: btn.container.list[0] as Phaser.GameObjects.GameObject &
            Phaser.GameObjects.Rectangle,
          colors: { rest: 0x312e81, pressed: 0x232350 },
          pressScale: 0.88,
        },
      );

      const autoBorder = scene.add
        .rectangle(x, y, DEFENSE_SPELL_BAR.slotSizePx, DEFENSE_SPELL_BAR.slotSizePx)
        .setStrokeStyle(
          DEFENSE_SPELL_BAR.autoCastBorderWidthPx,
          DEFENSE_SPELL_BAR.autoCastBorderColor,
          1,
        )
        .setFillStyle(0x000000, 0)
        .setScrollFactor(0)
        .setDepth(depth + 2)
        .setVisible(autoFlags[i] ?? false);

      const overlay = scene.add
        .rectangle(
          x,
          y + DEFENSE_SPELL_BAR.slotSizePx / 2,
          DEFENSE_SPELL_BAR.slotSizePx,
          DEFENSE_SPELL_BAR.slotSizePx,
          0x101018,
          0.78,
        )
        .setScrollFactor(0)
        .setDepth(depth + 1)
        .setOrigin(0.5, 1)
        .setVisible(false);

      this.slotChrome.push({ autoBorder, button: btn });
      this.cooldownVisuals.push({ overlay });
    }
  }

  getUiContainers(): Phaser.GameObjects.Container[] {
    return this.slotChrome.map((s) => s.button.container);
  }

  refreshAutoCastBorders(
    slots: readonly SpellId[],
    autoCastSpellIds: readonly SpellId[],
  ): void {
    const flags = autoCastFlagsForSlots(slots, autoCastSpellIds);
    for (let i = 0; i < this.slotChrome.length; i++) {
      this.slotChrome[i]!.autoBorder.setVisible(Boolean(flags[i]));
    }
  }

  /** Screen rect covering the spell row for virtual-stick exclusion. */
  getScreenRect(): { x: number; y: number; width: number; height: number } {
    const pad = scaleUiY(8);
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const { button } of this.slotChrome) {
      const r = interactiveObjectScreenRect(button.container);
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
    for (let i = 0; i < this.slotChrome.length; i++) {
      const r = interactiveObjectScreenRect(this.slotChrome[i]!.button.container);
      if (!r) continue;
      centers.push({
        index: i,
        x: r.x + r.width / 2,
        y: r.y + r.height / 2,
      });
    }
    return centers;
  }

  e2eSlotHitRects(): Array<{
    index: number;
    x: number;
    y: number;
    width: number;
    height: number;
  }> {
    const rects: Array<{
      index: number;
      x: number;
      y: number;
      width: number;
      height: number;
    }> = [];
    for (let i = 0; i < this.slotChrome.length; i++) {
      const r = interactiveObjectScreenRect(this.slotChrome[i]!.button.container);
      if (!r) continue;
      rects.push({ index: i, ...r });
    }
    return rects;
  }

  refreshCooldownOverlays(): void {
    const slotH = DEFENSE_SPELL_BAR.slotSizePx;
    for (let i = 0; i < this.slots.length; i++) {
      const id = this.slots[i];
      const remaining = id ? this.caster.getCooldownRemaining(id) : 0;
      const def = id ? spellById(id) : undefined;
      const onCd = remaining > 0 && !!def;
      const btn = this.slotChrome[i]?.button;
      const visual = this.cooldownVisuals[i];
      if (!btn || !visual) continue;

      btn.container.setAlpha(onCd ? 0.45 : 1);

      visual.overlay.setVisible(onCd);
      if (!onCd || !def) continue;

      const ratio = Phaser.Math.Clamp(remaining / def.cooldownMs, 0, 1);
      const coverH = slotH * ratio;
      const bottomY = btn.container.y + slotH / 2;
      visual.overlay.setPosition(btn.container.x, bottomY);
      visual.overlay.setSize(DEFENSE_SPELL_BAR.slotSizePx, coverH);
    }
  }

  destroy(): void {
    for (const v of this.cooldownVisuals) v.overlay.destroy();
    for (const s of this.slotChrome) s.autoBorder.destroy();
  }
}