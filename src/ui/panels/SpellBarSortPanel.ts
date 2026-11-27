import Phaser from "phaser";
import { SPELL_BAR, townSpellBarIconDisplayPx } from "../../config";
import {
  autoCastFlagsForSlots,
  pruneAutoCastSpellIdsForSlots,
  toggleAutoCastSpellId,
} from "../../content/spellBarAutoCast";
import {
  poolSpellIconAlpha,
  isSpellPoolSelectable,
} from "../../content/spellPoolReadiness";
import {
  clearAllDefenseBarSlots,
  toggleSpellOnDefenseBar,
} from "../../content/spellBarSortSlots";
import { spellById, type SpellId } from "../../content/spells";
import { spellIconTextureKey } from "../../content/assets";
import { INPUT_MODALITY } from "../../input/inputModality";
import { openModalPanel, type ModalPanel } from "../../input/modalBackdrop";
import type { createTouchButton } from "../touch/touchButton";
import {
  buildSpellBarSortPanelUi,
  type PoolChip,
  type SlotView,
} from "../spellBarSort/SpellBarSortPanelBuild";
import { SpellBarSortDrag } from "../spellBarSort/SpellBarSortDrag";
import {
  spellBarSortE2eSlotHitRects,
  spellBarSortE2eTapTargets,
  type SpellSortSlotHitRect,
} from "../spellBarSort/SpellBarSortPanelE2E";

export type SpellBarSortResult = {
  slots: SpellId[];
  autoCastSpellIds: SpellId[];
};

/**
 * Town overlay: drag spells between the 4-slot bar and the full catalog pool.
 * Build, drag-and-drop and e2e helpers live in `ui/spellBarSort/`.
 */
export class SpellBarSortPanel {
  private readonly root: Phaser.GameObjects.Container;
  private readonly scene: Phaser.Scene;
  private slots: SpellId[];
  private autoCastSpellIds: SpellId[];
  private readonly onDone: (result: SpellBarSortResult) => void;
  private readonly slotViews: SlotView[];
  private readonly poolChips: PoolChip[];
  private readonly dragCtl: SpellBarSortDrag;
  private clearAllBtn: ReturnType<typeof createTouchButton> | null = null;
  private readonly modal: ModalPanel;

  constructor(
    scene: Phaser.Scene,
    initialSlots: SpellId[],
    autoCastSpellIds: SpellId[],
    onDone: (result: SpellBarSortResult) => void,
  ) {
    this.scene = scene;
    this.onDone = onDone;
    this.slots = initialSlots.slice(0, SPELL_BAR.slotCount);
    while (this.slots.length < SPELL_BAR.slotCount) this.slots.push("");
    this.autoCastSpellIds = [...autoCastSpellIds];

    const modal = openModalPanel(scene, {
      token: INPUT_MODALITY.townSpellSort,
    });
    this.root = modal.root;
    this.modal = modal;

    const ui = buildSpellBarSortPanelUi(
      scene,
      this.root,
      this.slots,
      this.autoCastSpellIds,
      {
        onSlotTap: (slotIndex) => this.onDropOnSlot(slotIndex),
        onSlotLongPress: (slotIndex) => this.toggleAutoCast(slotIndex),
        onPoolPointerDown: (spellId, pointer) =>
          this.dragCtl.onPoolPointerDown(spellId, pointer),
        onClearAll: () => this.clearAllBar(),
        onDone: () => this.finish(),
      },
    );
    this.slotViews = ui.slotViews;
    this.poolChips = ui.poolChips;
    this.clearAllBtn = ui.clearAllBtn;
    this.dragCtl = new SpellBarSortDrag(scene, this.slotViews, {
      onDropOnSlot: (index) => this.onDropOnSlot(index),
      onPoolTap: (spellId) => this.togglePoolSpell(spellId),
    });

    this.refreshSlotDisplay();
    this.refreshAutoCastBorders();

    const { onPointerMove, onPointerUp } = this.dragCtl;
    scene.input.on("pointermove", onPointerMove);
    scene.input.on("pointerup", onPointerUp);
    this.finishCleanup = () => {
      scene.input.off("pointermove", onPointerMove);
      scene.input.off("pointerup", onPointerUp);
    };
  }

  private finishCleanup: () => void = () => {};

  private refreshSlotDisplay(): void {
    const iconSize = townSpellBarIconDisplayPx();
    for (let i = 0; i < this.slotViews.length; i++) {
      const view = this.slotViews[i]!;
      const id = this.slots[i] ?? "";
      if (id) {
        const def = spellById(id);
        const key = spellIconTextureKey(id);
        if (this.scene.textures.exists(key)) {
          view.icon
            .setTexture(key)
            .setDisplaySize(iconSize, iconSize)
            .setVisible(true);
          view.icon.setAlpha(1);
          this.scene.textures
            .get(key)
            .setFilter(Phaser.Textures.FilterMode.NEAREST);
        } else {
          view.icon.setVisible(false);
        }
        view.nameLabel
          .setVisible(true)
          .setText(def?.shortLabel || def?.name || "");
        view.indexLabel.setVisible(false);
      } else {
        view.icon.setVisible(false);
        view.nameLabel.setVisible(false).setText("");
        view.indexLabel.setVisible(true).setText(`${i + 1}`);
      }
    }
    this.refreshPoolAssignmentState();
    this.refreshAutoCastBorders();
  }

  private refreshAutoCastBorders(): void {
    const flags = autoCastFlagsForSlots(this.slots, this.autoCastSpellIds);
    for (let i = 0; i < this.slotViews.length; i++) {
      const border = this.slotViews[i]!.autoBorder;
      border.setVisible(Boolean(flags[i]));
      if (flags[i]) this.root.bringToTop(border);
    }
  }

  private toggleAutoCast(slotIndex: number): void {
    const id = this.slots[slotIndex] ?? "";
    if (!id) return;
    this.autoCastSpellIds = toggleAutoCastSpellId(this.autoCastSpellIds, id);
    this.refreshAutoCastBorders();
  }

  private refreshPoolAssignmentState(): void {
    for (const chip of this.poolChips) {
      const alpha = poolSpellIconAlpha(
        chip.spellId,
        this.slots,
        chip.poolSelectable,
      );
      chip.icon?.setAlpha(alpha);
      chip.frame.setAlpha(chip.poolSelectable ? 1 : 0.72);
    }
  }

  private clearAllBar(): void {
    this.slots = clearAllDefenseBarSlots();
    this.autoCastSpellIds = pruneAutoCastSpellIdsForSlots(
      this.autoCastSpellIds,
      this.slots,
    );
    this.refreshSlotDisplay();
  }

  private togglePoolSpell(spellId: SpellId): void {
    const def = spellById(spellId);
    if (!def || !isSpellPoolSelectable(def)) return;
    const wasOnBar = this.slots.includes(spellId);
    this.slots = toggleSpellOnDefenseBar(this.slots, spellId);
    if (wasOnBar) {
      this.autoCastSpellIds = pruneAutoCastSpellIdsForSlots(
        this.autoCastSpellIds,
        this.slots,
      );
    }
    this.refreshSlotDisplay();
  }

  private onDropOnSlot(index: number): void {
    const incoming = this.dragCtl.takeDraggedSpell();
    if (incoming === null) {
      const id = this.slots[index] ?? "";
      if (id) {
        this.slots[index] = "";
        this.refreshSlotDisplay();
      }
      return;
    }

    const existingAt = this.slots.indexOf(incoming);
    if (existingAt >= 0) this.slots[existingAt] = "";
    const displaced = this.slots[index] ?? "";
    this.slots[index] = incoming;
    if (displaced && displaced !== incoming) {
      const empty = this.slots.indexOf("");
      if (empty >= 0) this.slots[empty] = displaced;
    }
    this.refreshSlotDisplay();
  }

  private finish(): void {
    this.finishCleanup();
    this.onDone({
      slots: [...this.slots],
      autoCastSpellIds: [...this.autoCastSpellIds],
    });
    this.destroy();
  }

  destroy(): void {
    this.dragCtl.reset();
    this.finishCleanup();
    this.modal.close();
  }

  /** E2E: slot centers in game coords (540×1200). */
  e2eTapTargets(): Record<string, { x: number; y: number }> {
    return spellBarSortE2eTapTargets(
      this.slotViews,
      this.poolChips,
      this.clearAllBtn,
    );
  }

  e2eSlotHitRects(): SpellSortSlotHitRect[] {
    return spellBarSortE2eSlotHitRects(this.slotViews);
  }

  e2eBarSlots(): SpellId[] {
    return [...this.slots];
  }
}
