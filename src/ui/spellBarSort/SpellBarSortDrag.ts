import type Phaser from "phaser";
import { TOWN_SPELL_SORT_BAR } from "../../config";
import { spellIconTextureKey } from "../../content/assets";
import { isSpellPoolSelectable } from "../../content/spellPoolReadiness";
import { spellById, type SpellId } from "../../content/spells";
import { scaleUiX } from "../../config/uiScale";
import { TOUCH_BUTTON_RELEASE_SLOP_PX } from "../../input/inputTuning";
import { interactiveObjectScreenRect } from "../touch/touchButton";
import { releaseOnSameButton } from "../touch/touchButtonGesture";
import type { SlotView } from "./SpellBarSortPanelBuild";

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

export type SpellBarSortDragHandlers = {
  /** Released over bar slot `index` while dragging (call `takeDraggedSpell`). */
  onDropOnSlot(index: number): void;
  /** Pool icon tapped (press released under the drag threshold). */
  onPoolTap(spellId: SpellId): void;
};

/**
 * Pool press → tap or drag (ghost icon follows the pointer) → drop on a bar slot.
 */
export class SpellBarSortDrag {
  private poolPress: PoolPressState | null = null;
  private drag: DragState | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly slotViews: readonly SlotView[],
    private readonly handlers: SpellBarSortDragHandlers,
  ) {}

  onPoolPointerDown(spellId: SpellId, pointer: Phaser.Input.Pointer): void {
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

  /** Ends an active drag (destroys the ghost) and returns its spell, or null. */
  takeDraggedSpell(): SpellId | null {
    if (!this.drag) return null;
    const incoming = this.drag.spellId;
    this.drag.ghost.destroy();
    this.drag = null;
    return incoming;
  }

  reset(): void {
    this.poolPress = null;
    if (this.drag) {
      this.drag.ghost.destroy();
      this.drag = null;
    }
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

  readonly onPointerMove = (pointer: Phaser.Input.Pointer): void => {
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

  readonly onPointerUp = (pointer: Phaser.Input.Pointer): void => {
    if (this.drag) {
      const slotIndex = this.slotIndexAtPointer(pointer);
      if (slotIndex >= 0) {
        this.handlers.onDropOnSlot(slotIndex);
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
      this.handlers.onPoolTap(spellId);
    }
  };
}
