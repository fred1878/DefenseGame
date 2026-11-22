import Phaser from "phaser";
import {
  GAME,
  SPELL_BAR,
  TOWN_SPELL_SORT_BAR,
  TOWN_SPELL_SORT_PANEL,
  townSpellBarIconDisplayPx,
} from "../config";
import { spellIconTextureKey } from "../content/assets";
import {
  autoCastFlagsForSlots,
  pruneAutoCastSpellIdsForSlots,
  toggleAutoCastSpellId,
} from "../content/spellBarAutoCast";
import {
  isSpellPoolSelectable,
  poolSpellIconAlpha,
} from "../content/spellPoolReadiness";
import {
  clearAllDefenseBarSlots,
  toggleSpellOnDefenseBar,
} from "../content/spellBarSortSlots";
import {
  getSpellCatalog,
  spellById,
  type SpellDefinition,
  type SpellId,
} from "../content/spells";
import { scaleUiX, scaleUiY } from "../core/displayScale";
import { INPUT_MODALITY } from "../input/inputModality";
import { TOUCH_BUTTON_RELEASE_SLOP_PX } from "../input/inputTuning";
import {
  acquireModalInput,
  bindModalDimBackdrop,
  type ModalInputLease,
} from "../input/modalBackdrop";
import { bindTapOrLongPress, createTouchButton, interactiveObjectScreenRect } from "./touchButton";
import { releaseOnSameButton } from "./touchButtonGesture";
import { uiTextStyle } from "./uiTextStyle";

export type SpellBarSortResult = {
  slots: SpellId[];
  autoCastSpellIds: SpellId[];
};

type PoolPressState = {
  spellId: SpellId;
  startX: number;
  startY: number;
  dragAccumPx: number;
};

type DragState = {
  spellId: SpellId;
  ghost: Phaser.GameObjects.Container;
};

const POOL_TAP_DRAG_THRESHOLD_PX = 10;

type SlotView = {
  frame: Phaser.GameObjects.Rectangle;
  icon: Phaser.GameObjects.Image;
  nameLabel: Phaser.GameObjects.Text;
  indexLabel: Phaser.GameObjects.Text;
  autoBorder: Phaser.GameObjects.Rectangle;
};

type PoolChip = {
  spellId: SpellId;
  poolSelectable: boolean;
  frame: Phaser.GameObjects.Rectangle;
  icon: Phaser.GameObjects.Image | null;
  nameLabel: Phaser.GameObjects.Text;
};

const POOL_COLUMNS = 7;
const SLOT_NAME_FONT_PX = 10;
const POOL_NAME_FONT_PX = 9;
const POOL_LABEL_BELOW_ICON_Y = 30;

/**
 * Town overlay: drag spells between the 4-slot bar and the full catalog pool.
 */
export class SpellBarSortPanel {
  private readonly root: Phaser.GameObjects.Container;
  private readonly scene: Phaser.Scene;
  private slots: SpellId[];
  private autoCastSpellIds: SpellId[];
  private readonly onDone: (result: SpellBarSortResult) => void;
  private readonly slotViews: SlotView[] = [];
  private readonly poolChips: PoolChip[] = [];
  private poolPress: PoolPressState | null = null;
  private drag: DragState | null = null;
  private clearAllBtn: ReturnType<typeof createTouchButton> | null = null;
  private doneBtn: ReturnType<typeof createTouchButton> | null = null;
  private readonly modalLease: ModalInputLease;

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

    this.root = scene.add.container(0, 0).setDepth(500).setScrollFactor(0);

    const dim = scene.add
      .rectangle(GAME.width / 2, GAME.height / 2, GAME.width, GAME.height, 0x000000, 0.72);
    bindModalDimBackdrop(dim);
    this.root.add(dim);
    this.modalLease = acquireModalInput(scene, INPUT_MODALITY.townSpellSort);

    const panelLayout = TOWN_SPELL_SORT_PANEL;
    const title = scene.add
      .text(
        GAME.width / 2,
        scaleUiY(panelLayout.titleY),
        "Spell bar",
        uiTextStyle(scene, {
          fontSize: `${scaleUiX(24)}px`,
          color: "#f4f4f5",
        }),
      )
      .setOrigin(0.5);
    this.root.add(title);

    const hint = scene.add
      .text(
        GAME.width / 2,
        scaleUiY(panelLayout.hintY),
        "4×2 night bar — 8 slots, same order as defense. Labels name each spell. Tap or drag bright pool icons on; tap again to remove. Dim = already on bar; faded = coming soon. Long-press a filled slot for auto-cast (yellow ring).",
        uiTextStyle(scene, {
          fontSize: `${scaleUiX(13)}px`,
          color: "#a1a1aa",
          align: "center",
          wordWrap: { width: GAME.width - scaleUiX(36) },
        }),
      )
      .setOrigin(0.5, 0);
    this.root.add(hint);

    const bar = TOWN_SPELL_SORT_BAR;
    const barCell = bar.slotSizePx;
    const barGap = bar.slotGapPx;
    const barRowGap = bar.rowGapPx;
    const gridTop = scaleUiY(panelLayout.barGridTopY);
    const gridW = bar.columnCount * barCell + (bar.columnCount - 1) * barGap;
    const gridLeft = GAME.width / 2 - gridW / 2 + barCell / 2;

    for (let i = 0; i < SPELL_BAR.slotCount; i++) {
      const col = i % bar.columnCount;
      const row = Math.floor(i / bar.columnCount);
      const x = gridLeft + col * (barCell + barGap);
      const y = gridTop + row * (barCell + barRowGap);
      const frame = scene.add
        .rectangle(x, y, barCell, barCell, 0x1e1b4b, 0.92)
        .setStrokeStyle(2, 0x6366f1);
      frame.setInteractive({ useHandCursor: true });

      const autoBorder = scene.add
        .rectangle(x, y, barCell, barCell)
        .setStrokeStyle(
          bar.autoCastBorderWidthPx,
          bar.autoCastBorderColor,
          1,
        )
        .setFillStyle(0x000000, 0)
        .setVisible(autoCastFlagsForSlots(this.slots, this.autoCastSpellIds)[i] ?? false);

      const slotIndex = i;
      bindTapOrLongPress(
        scene,
        frame,
        {
          onTap: () => this.onDropOnSlot(slotIndex),
          onLongPress: () => this.toggleAutoCast(slotIndex),
          longPressMs: bar.longPressMs,
        },
        {
          bg: frame,
          colors: { rest: 0x1e1b4b, pressed: 0x2e2b5b },
        },
      );

      const icon = scene.add.image(x, y, "spell_icon_fire_bolt").setVisible(false);
      const nameLabel = scene.add
        .text(
          x,
          y + barCell * 0.36,
          "",
          uiTextStyle(scene, {
            fontSize: `${scaleUiX(SLOT_NAME_FONT_PX)}px`,
            color: "#e4e4e7",
          }),
        )
        .setOrigin(0.5, 0);
      const indexLabel = scene.add
        .text(
          x,
          y,
          `${i + 1}`,
          uiTextStyle(scene, {
            fontSize: `${scaleUiX(22)}px`,
            color: "#6366f1",
          }),
        )
        .setOrigin(0.5);

      this.slotViews.push({ frame, icon, nameLabel, indexLabel, autoBorder });
      // Auto-cast ring drawn above the icon so it is not covered.
      this.root.add([frame, icon, nameLabel, indexLabel, autoBorder]);
    }

    const barRows =
      bar.rowCount > 0
        ? bar.rowCount
        : Math.ceil(SPELL_BAR.slotCount / bar.columnCount);
    const poolHeaderY =
      gridTop +
      barRows * barCell +
      (barRows - 1) * barRowGap +
      scaleUiY(panelLayout.poolBelowBarGapY);
    scene.add
      .text(
        GAME.width / 2,
        poolHeaderY,
        `Spell pool (${getSpellCatalog().length})`,
        uiTextStyle(scene, {
          fontSize: `${scaleUiX(16)}px`,
          color: "#d4d4d8",
        }),
      )
      .setOrigin(0.5);

    const poolCell = scaleUiX(44);
    const poolGap = scaleUiX(4);
    const poolTop = poolHeaderY + scaleUiY(panelLayout.poolHeaderToGridGapY);
    const poolGridW = POOL_COLUMNS * poolCell + (POOL_COLUMNS - 1) * poolGap;
    const poolLeft = GAME.width / 2 - poolGridW / 2 + poolCell / 2;

    const catalog = [...getSpellCatalog()].sort((a, b) => {
      const aReady = isSpellPoolSelectable(a);
      const bReady = isSpellPoolSelectable(b);
      if (aReady !== bReady) return aReady ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    const poolRowStride = poolCell + scaleUiY(POOL_LABEL_BELOW_ICON_Y);

    for (let i = 0; i < catalog.length; i++) {
      const def = catalog[i]!;
      const col = i % POOL_COLUMNS;
      const row = Math.floor(i / POOL_COLUMNS);
      const x = poolLeft + col * (poolCell + poolGap);
      const y = poolTop + row * poolRowStride;
      const poolSelectable = isSpellPoolSelectable(def);
      const frame = scene.add
        .rectangle(
          x,
          y,
          poolCell,
          poolCell,
          poolSelectable ? 0x312e81 : 0x27272a,
          poolSelectable ? 1 : 0.85,
        )
        .setStrokeStyle(2, poolSelectable ? 0x818cf8 : 0x52525b);
      const icon = this.tryAddSpellIcon(scene, x, y, def, poolCell);
      const nameLabel = scene.add
        .text(
          x,
          y + poolCell / 2 + scaleUiY(4),
          def.shortLabel || def.name,
          uiTextStyle(scene, {
            fontSize: `${scaleUiX(POOL_NAME_FONT_PX)}px`,
            color: poolSelectable ? "#e4e4e7" : "#71717a",
          }),
        )
        .setOrigin(0.5, 0);
      if (poolSelectable) {
        frame.setInteractive({ useHandCursor: true });
        frame.on("pointerdown", (p: Phaser.Input.Pointer) =>
          this.onPoolPointerDown(def.id, p),
        );
        icon?.setInteractive({ useHandCursor: true });
        icon?.on("pointerdown", (p: Phaser.Input.Pointer) =>
          this.onPoolPointerDown(def.id, p),
        );
      }
      this.poolChips.push({
        spellId: def.id,
        poolSelectable,
        frame,
        icon,
        nameLabel,
      });
      this.root.add(frame);
      if (icon) this.root.add(icon);
      this.root.add(nameLabel);
    }

    const poolRows = Math.ceil(catalog.length / POOL_COLUMNS);
    const footerY =
      poolTop +
      poolRows * poolRowStride +
      scaleUiY(panelLayout.doneBelowPoolGapY);
    const footerBtnY = Math.min(footerY, GAME.height - scaleUiY(56));
    const footerBtnW = scaleUiX(panelLayout.footerButtonWidthPx);
    const footerBtnH = scaleUiY(44);
    const footerGap = scaleUiX(panelLayout.footerButtonGapPx);
    const footerRowW = footerBtnW * 2 + footerGap;
    const clearAllX = GAME.width / 2 - footerRowW / 2 + footerBtnW / 2;
    const doneX = GAME.width / 2 + footerRowW / 2 - footerBtnW / 2;

    this.clearAllBtn = createTouchButton(
      scene,
      clearAllX,
      footerBtnY,
      "Clear all",
      () => this.clearAllBar(),
      {
        width: footerBtnW,
        height: footerBtnH,
        depth: 510,
        fontSize: `${scaleUiX(14)}px`,
        fillColor: 0x52525b,
        strokeColor: 0xa1a1aa,
      },
    );
    this.doneBtn = createTouchButton(
      scene,
      doneX,
      footerBtnY,
      "Done",
      () => this.finish(),
      { width: footerBtnW, height: footerBtnH, depth: 510 },
    );
    this.root.add(this.clearAllBtn.container);
    this.root.add(this.doneBtn.container);

    this.refreshSlotDisplay();
    this.refreshAutoCastBorders();

    scene.input.on("pointermove", this.onPointerMove);
    scene.input.on("pointerup", this.onPointerUp);
    this.finishCleanup = () => {
      scene.input.off("pointermove", this.onPointerMove);
      scene.input.off("pointerup", this.onPointerUp);
    };
  }

  private finishCleanup: () => void = () => {};

  private tryAddSpellIcon(
    scene: Phaser.Scene,
    x: number,
    y: number,
    def: SpellDefinition,
    cell: number,
  ): Phaser.GameObjects.Image | null {
    const key = spellIconTextureKey(def.id);
    if (!scene.textures.exists(key)) return null;
    const pad = Math.round(cell * 0.1);
    const size = cell - pad;
    const icon = scene.add.image(x, y, key).setDisplaySize(size, size);
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    return icon;
  }

  private refreshSlotDisplay(): void {
    const iconSize = townSpellBarIconDisplayPx();
    for (let i = 0; i < this.slotViews.length; i++) {
      const view = this.slotViews[i]!;
      const id = this.slots[i] ?? "";
      if (id) {
        const def = spellById(id);
        const key = spellIconTextureKey(id);
        if (this.scene.textures.exists(key)) {
          view.icon.setTexture(key).setDisplaySize(iconSize, iconSize).setVisible(true);
          view.icon.setAlpha(1);
          this.scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
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

  private onPoolPointerDown(spellId: SpellId, pointer: Phaser.Input.Pointer): void {
    if (this.poolPress || this.drag) return;
    const def = spellById(spellId);
    if (!def || !isSpellPoolSelectable(def)) return;
    this.poolPress = {
      spellId,
      startX: pointer.x,
      startY: pointer.y,
      dragAccumPx: 0,
    };
  }

  private createDragGhost(
    spellId: SpellId,
    pointer: Phaser.Input.Pointer,
  ): Phaser.GameObjects.Container {
    const ghost = this.scene.add
      .container(pointer.x, pointer.y)
      .setDepth(600)
      .setScrollFactor(0);
    const cell = TOWN_SPELL_SORT_BAR.slotSizePx;
    const bg = this.scene.add
      .rectangle(0, 0, cell, cell, 0x4c1d95, 0.92)
      .setStrokeStyle(2, 0xe879f9);
    ghost.add(bg);
    const key = spellIconTextureKey(spellId);
    if (this.scene.textures.exists(key)) {
      const icon = this.scene.add
        .image(0, 0, key)
        .setDisplaySize(Math.round(cell * 0.82), Math.round(cell * 0.82));
      ghost.add(icon);
    }
    return ghost;
  }

  private promotePoolPressToDrag(pointer: Phaser.Input.Pointer): void {
    if (!this.poolPress) return;
    const { spellId } = this.poolPress;
    const ghost = this.createDragGhost(spellId, pointer);
    this.drag = { spellId, ghost };
    this.poolPress = null;
  }

  private onPointerMove = (pointer: Phaser.Input.Pointer): void => {
    if (this.drag) {
      this.drag.ghost.setPosition(pointer.x, pointer.y);
      return;
    }
    if (!this.poolPress) return;
    const dx = pointer.x - this.poolPress.startX;
    const dy = pointer.y - this.poolPress.startY;
    this.poolPress.dragAccumPx = Math.max(
      this.poolPress.dragAccumPx,
      Math.hypot(dx, dy),
    );
    const threshold = scaleUiX(POOL_TAP_DRAG_THRESHOLD_PX);
    if (this.poolPress.dragAccumPx >= threshold) {
      this.promotePoolPressToDrag(pointer);
    }
  };

  private slotIndexAtPointer(pointer: Phaser.Input.Pointer): number {
    const slopPx = scaleUiX(TOUCH_BUTTON_RELEASE_SLOP_PX);
    for (let i = 0; i < this.slotViews.length; i++) {
      const rect = interactiveObjectScreenRect(this.slotViews[i]!.frame);
      if (rect && releaseOnSameButton(rect, pointer.x, pointer.y, slopPx)) {
        return i;
      }
    }
    return -1;
  }

  private onPointerUp = (pointer: Phaser.Input.Pointer): void => {
    if (this.drag) {
      const slotIndex = this.slotIndexAtPointer(pointer);
      if (slotIndex >= 0) {
        this.onDropOnSlot(slotIndex);
      } else {
        this.drag.ghost.destroy();
        this.drag = null;
      }
      return;
    }
    if (!this.poolPress) return;
    const { spellId, dragAccumPx } = this.poolPress;
    this.poolPress = null;
    const threshold = scaleUiX(POOL_TAP_DRAG_THRESHOLD_PX);
    if (dragAccumPx < threshold) {
      this.togglePoolSpell(spellId);
    }
  };

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
    if (!this.drag) {
      const id = this.slots[index] ?? "";
      if (id) {
        this.slots[index] = "";
        this.refreshSlotDisplay();
      }
      return;
    }
    const incoming = this.drag.spellId;
    this.drag.ghost.destroy();
    this.drag = null;

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
    this.poolPress = null;
    if (this.drag) {
      this.drag.ghost.destroy();
      this.drag = null;
    }
    this.finishCleanup();
    this.modalLease.release();
    this.root.destroy();
  }

  /** E2E: slot centers in game coords (540×1200). */
  e2eTapTargets(): Record<string, { x: number; y: number }> {
    const out: Record<string, { x: number; y: number }> = {};
    for (let i = 0; i < this.slotViews.length; i++) {
      const r = interactiveObjectScreenRect(this.slotViews[i]!.frame);
      if (!r) continue;
      out[`spell-sort-slot-${i}`] = {
        x: r.x + r.width / 2,
        y: r.y + r.height / 2,
      };
    }
    for (const chip of this.poolChips) {
      if (!chip.poolSelectable) continue;
      const r = interactiveObjectScreenRect(chip.frame);
      if (!r) continue;
      out[`spell-sort-pool-${chip.spellId}`] = {
        x: r.x + r.width / 2,
        y: r.y + r.height / 2,
      };
    }
    if (this.clearAllBtn) {
      const r = interactiveObjectScreenRect(this.clearAllBtn.container);
      if (r) {
        out["spell-sort-clear-all"] = {
          x: r.x + r.width / 2,
          y: r.y + r.height / 2,
        };
      }
    }
    return out;
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
    for (let i = 0; i < this.slotViews.length; i++) {
      const r = interactiveObjectScreenRect(this.slotViews[i]!.frame);
      if (!r) continue;
      rects.push({ index: i, ...r });
    }
    return rects;
  }

  e2eBarSlots(): SpellId[] {
    return [...this.slots];
  }

}