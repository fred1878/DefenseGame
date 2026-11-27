import type Phaser from "phaser";
import { PALETTE, PALETTE_CSS } from "../theme/uiPalette";
import { GAME } from "../../config";
import type { SaveGame } from "../../core/save/saveTypes";
import {
  formatSaveSlotMeta,
  listSaveSlots,
  loadSaveSlot,
  writeSaveSlot,
  deleteSaveSlot,
} from "../../core/save/saveSlots";
import { INPUT_MODALITY } from "../../input/inputModality";
import { openModalPanel, type ModalPanel } from "../../input/modalBackdrop";
import {
  createTouchButton,
  interactiveObjectScreenRect,
} from "../touch/touchButton";
import { uiTextStyle } from "../layout/uiTextStyle";
import {
  applyDeleteResult,
  applyWriteResult,
  canDeleteSelected,
  canLoadSelected,
  canSaveToSelected,
  createSaveMenuState,
  reduceSaveMenu,
  saveMenuPrompt,
  type SaveMenuState,
} from "../saveMenu/saveMenuLogic";
import {
  type SaveMenuButtonId,
  saveMenuLayout,
  saveMenuRowCenterY,
} from "../saveMenu/saveMenuLayout";

type SaveMenuButton = ReturnType<typeof createTouchButton>;

type SlotRow = {
  index: number;
  bg: Phaser.GameObjects.Rectangle;
  title: Phaser.GameObjects.Text;
  meta: Phaser.GameObjects.Text;
};

/**
 * Town overlay: copy the current game into a manual slot, or load / delete one.
 * Incompatible slot versions are purged when the list is read.
 */
export class SaveMenuPanel {
  private readonly modal: ModalPanel;
  private readonly rows: SlotRow[] = [];
  private readonly promptText: Phaser.GameObjects.Text;
  private readonly saveBtn: SaveMenuButton;
  private readonly loadBtn: SaveMenuButton;
  private readonly deleteBtn: SaveMenuButton;
  private readonly confirmBtn: SaveMenuButton;
  private readonly cancelBtn: SaveMenuButton;
  private readonly closeBtn: SaveMenuButton;
  private readonly onLoad: (save: SaveGame) => void;
  private readonly onDismiss: (() => void) | undefined;
  private readonly getSave: () => SaveGame;
  private state: SaveMenuState;
  private tornDown = false;

  constructor(
    scene: Phaser.Scene,
    getSave: () => SaveGame,
    onLoad: (save: SaveGame) => void,
    onDismiss?: () => void,
  ) {
    this.getSave = getSave;
    this.onLoad = onLoad;
    this.onDismiss = onDismiss;
    this.state = createSaveMenuState(listSaveSlots());

    const modal = openModalPanel(scene, { token: INPUT_MODALITY.townSaves });
    const root = modal.root;
    this.modal = modal;

    const l = saveMenuLayout();
    root.add(
      scene.add
        .text(
          GAME.width / 2,
          l.titleY,
          "Saves",
          uiTextStyle(scene, {
            fontSize: `${l.titleFontPx}px`,
            color: PALETTE_CSS.zinc100,
          }),
        )
        .setOrigin(0.5),
    );
    root.add(
      scene.add
        .text(
          GAME.width / 2,
          l.introY,
          "Copy the current game into a slot, or load one. Progress still autosaves as you play.",
          uiTextStyle(scene, {
            fontSize: `${l.introFontPx}px`,
            color: PALETTE_CSS.zinc400,
            align: "center",
            wordWrap: { width: l.introWrapW },
          }),
        )
        .setOrigin(0.5, 0),
    );

    for (const slot of this.state.slots) {
      const cy = saveMenuRowCenterY(l, slot.index);
      const bg = scene.add
        .rectangle(GAME.width / 2, cy, l.rowW, l.rowH, PALETTE.zinc700, 1)
        .setStrokeStyle(2, PALETTE.zinc500)
        .setInteractive();
      bg.on("pointerup", () =>
        this.dispatch({ type: "select", index: slot.index }),
      );
      const title = scene.add
        .text(
          l.listLeft + l.rowTextInsetX,
          cy + l.rowTitleOffsetY,
          slot.name,
          uiTextStyle(scene, {
            fontSize: `${l.rowTitleFontPx}px`,
            color: PALETTE_CSS.zinc50,
          }),
        )
        .setOrigin(0, 0.5);
      const meta = scene.add
        .text(
          l.listLeft + l.rowTextInsetX,
          cy + l.rowMetaOffsetY,
          formatSaveSlotMeta(slot),
          uiTextStyle(scene, {
            fontSize: `${l.rowMetaFontPx}px`,
            color: PALETTE_CSS.zinc400,
            lineSpacing: l.rowMetaLineSpacing,
          }),
        )
        .setOrigin(0, 0.5);
      root.add([bg, title, meta]);
      this.rows.push({ index: slot.index, bg, title, meta });
    }

    this.promptText = scene.add
      .text(
        GAME.width / 2,
        l.promptY,
        "",
        uiTextStyle(scene, {
          fontSize: `${l.promptFontPx}px`,
          color: PALETTE_CSS.amber400,
          align: "center",
          wordWrap: { width: l.promptWrapW },
        }),
      )
      .setOrigin(0.5);
    root.add(this.promptText);

    const onTap: Record<SaveMenuButtonId, () => void> = {
      save: () => this.dispatch({ type: "requestSave" }),
      load: () => this.dispatch({ type: "requestLoad" }),
      delete: () => this.dispatch({ type: "requestDelete" }),
      confirm: () => this.dispatch({ type: "confirm" }),
      cancel: () => this.dispatch({ type: "cancel" }),
      close: () => this.destroy(),
    };
    const btns = {} as Record<SaveMenuButtonId, SaveMenuButton>;
    for (const b of l.buttons) {
      btns[b.id] = createTouchButton(scene, b.x, b.y, b.label, onTap[b.id], {
        width: b.width,
        height: b.height,
        depth: l.buttonDepth,
        fontSize: `${b.fontSizePx}px`,
        fillColor: b.fill,
        strokeColor: b.stroke,
      });
    }
    this.saveBtn = btns.save;
    this.loadBtn = btns.load;
    this.deleteBtn = btns.delete;
    this.confirmBtn = btns.confirm;
    this.cancelBtn = btns.cancel;
    this.closeBtn = btns.close;
    root.add([
      this.saveBtn.container,
      this.loadBtn.container,
      this.deleteBtn.container,
      this.confirmBtn.container,
      this.cancelBtn.container,
      this.closeBtn.container,
    ]);
    this.refresh();
  }

  private dispatch(command: Parameters<typeof reduceSaveMenu>[1]): void {
    const { state, effect } = reduceSaveMenu(this.state, command);
    this.state = state;
    if (effect.type === "write") {
      const written = writeSaveSlot(effect.index, this.getSave());
      this.state = applyWriteResult(this.state, written);
    } else if (effect.type === "delete") {
      deleteSaveSlot(effect.index);
      this.state = applyDeleteResult(this.state, effect.index);
    } else if (effect.type === "load") {
      const save = loadSaveSlot(effect.index);
      if (save) {
        this.onLoad(save);
        this.destroy();
        return;
      }
      this.state = createSaveMenuState(listSaveSlots());
      this.state.status = "That save is no longer available.";
    }
    this.refresh();
  }

  private refresh(): void {
    for (const row of this.rows) {
      const slot = this.state.slots[row.index];
      if (!slot) continue;
      const on = this.state.selected === row.index;
      row.bg.setFillStyle(on ? PALETTE.deepNavy : PALETTE.zinc700);
      row.bg.setStrokeStyle(2, on ? PALETTE.blue400 : PALETTE.zinc500);
      row.title.setText(slot.name);
      row.meta.setText(formatSaveSlotMeta(slot));
    }
    this.promptText.setText(saveMenuPrompt(this.state));
    const confirming = this.state.confirm !== null;
    this.setButtonVisible(this.saveBtn, !confirming);
    this.setButtonVisible(this.loadBtn, !confirming);
    this.setButtonVisible(this.deleteBtn, !confirming);
    this.setButtonVisible(this.confirmBtn, confirming);
    this.setButtonVisible(this.cancelBtn, confirming);
    if (!confirming) {
      this.setButtonEnabled(this.saveBtn, canSaveToSelected(this.state));
      this.setButtonEnabled(this.loadBtn, canLoadSelected(this.state));
      this.setButtonEnabled(this.deleteBtn, canDeleteSelected(this.state));
    }
  }

  private setButtonVisible(btn: SaveMenuButton, visible: boolean): void {
    btn.container.setVisible(visible);
    if (visible) btn.container.setInteractive();
    else btn.container.disableInteractive();
  }

  private setButtonEnabled(btn: SaveMenuButton, enabled: boolean): void {
    btn.container.setAlpha(enabled ? 1 : 0.45);
    if (enabled) btn.container.setInteractive();
    else btn.container.disableInteractive();
  }

  destroy(): void {
    if (this.tornDown) return;
    this.tornDown = true;
    this.modal.close();
    this.onDismiss?.();
  }

  e2eTapTargets(): Record<string, { x: number; y: number }> {
    const out: Record<string, { x: number; y: number }> = {};
    const add = (id: string, btn: SaveMenuButton): void => {
      if (!btn.container.visible) return;
      const r = interactiveObjectScreenRect(btn.container);
      if (!r) return;
      out[id] = { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    };
    add("save-menu-save", this.saveBtn);
    add("save-menu-load", this.loadBtn);
    add("save-menu-delete", this.deleteBtn);
    add("save-menu-confirm", this.confirmBtn);
    add("save-menu-cancel", this.cancelBtn);
    add("save-menu-close", this.closeBtn);
    for (const row of this.rows) {
      out[`save-menu-slot-${row.index}`] = { x: row.bg.x, y: row.bg.y };
    }
    return out;
  }

  e2eSlotMeta(index: number): string {
    const slot = this.state.slots[index];
    return slot ? formatSaveSlotMeta(slot) : "";
  }
}
