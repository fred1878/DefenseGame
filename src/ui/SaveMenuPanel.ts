import type Phaser from "phaser";
import { GAME } from "../config";
import type { SaveGame } from "../core/saveTypes";
import { scaleUiX, scaleUiY } from "../config/uiScale";
import {
  formatSaveSlotMeta,
  listSaveSlots,
  loadSaveSlot,
  writeSaveSlot,
  deleteSaveSlot,
} from "../core/saveSlots";
import { INPUT_MODALITY } from "../input/inputModality";
import {
  acquireModalInput,
  bindModalDimBackdrop,
  type ModalInputLease,
} from "../input/modalBackdrop";
import { createTouchButton, interactiveObjectScreenRect } from "./touchButton";
import { uiTextStyle } from "./uiTextStyle";
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
} from "./saveMenu/saveMenuLogic";

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
  private readonly root: Phaser.GameObjects.Container;
  private readonly modalLease: ModalInputLease;
  private readonly rows: SlotRow[] = [];
  private readonly promptText: Phaser.GameObjects.Text;
  private readonly saveBtn: ReturnType<typeof createTouchButton>;
  private readonly loadBtn: ReturnType<typeof createTouchButton>;
  private readonly deleteBtn: ReturnType<typeof createTouchButton>;
  private readonly confirmBtn: ReturnType<typeof createTouchButton>;
  private readonly cancelBtn: ReturnType<typeof createTouchButton>;
  private readonly closeBtn: ReturnType<typeof createTouchButton>;
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

    const root = scene.add.container(0, 0).setDepth(500).setScrollFactor(0);
    this.root = root;

    const dim = scene.add.rectangle(
      GAME.width / 2,
      GAME.height / 2,
      GAME.width,
      GAME.height,
      0x000000,
      0.72,
    );
    bindModalDimBackdrop(dim);
    root.add(dim);
    this.modalLease = acquireModalInput(scene, INPUT_MODALITY.townSaves);

    root.add(
      scene.add
        .text(
          GAME.width / 2,
          scaleUiY(64),
          "Saves",
          uiTextStyle(scene, {
            fontSize: `${scaleUiX(24)}px`,
            color: "#f4f4f5",
          }),
        )
        .setOrigin(0.5),
    );
    root.add(
      scene.add
        .text(
          GAME.width / 2,
          scaleUiY(98),
          "Copy the current game into a slot, or load one. Progress still autosaves as you play.",
          uiTextStyle(scene, {
            fontSize: `${scaleUiX(13)}px`,
            color: "#a1a1aa",
            align: "center",
            wordWrap: { width: GAME.width - scaleUiX(36) },
          }),
        )
        .setOrigin(0.5, 0),
    );

    const rowW = GAME.width - scaleUiX(48);
    const listLeft = (GAME.width - rowW) / 2;
    const rowH = scaleUiY(88);
    const gap = scaleUiY(10);
    const listTop = scaleUiY(176);

    for (const slot of this.state.slots) {
      const cy = listTop + slot.index * (rowH + gap) + rowH / 2;
      const bg = scene.add
        .rectangle(GAME.width / 2, cy, rowW, rowH, 0x3f3f46, 1)
        .setStrokeStyle(2, 0x71717a)
        .setInteractive();
      bg.on("pointerup", () =>
        this.dispatch({ type: "select", index: slot.index }),
      );
      const title = scene.add
        .text(
          listLeft + scaleUiX(16),
          cy - scaleUiY(18),
          slot.name,
          uiTextStyle(scene, {
            fontSize: `${scaleUiX(18)}px`,
            color: "#fafafa",
          }),
        )
        .setOrigin(0, 0.5);
      const meta = scene.add
        .text(
          listLeft + scaleUiX(16),
          cy + scaleUiY(16),
          formatSaveSlotMeta(slot),
          uiTextStyle(scene, {
            fontSize: `${scaleUiX(13)}px`,
            color: "#a1a1aa",
            lineSpacing: scaleUiY(2),
          }),
        )
        .setOrigin(0, 0.5);
      root.add([bg, title, meta]);
      this.rows.push({ index: slot.index, bg, title, meta });
    }

    this.promptText = scene.add
      .text(
        GAME.width / 2,
        GAME.height - scaleUiY(214),
        "",
        uiTextStyle(scene, {
          fontSize: `${scaleUiX(15)}px`,
          color: "#fbbf24",
          align: "center",
          wordWrap: { width: GAME.width - scaleUiX(40) },
        }),
      )
      .setOrigin(0.5);
    root.add(this.promptText);

    const actionY = GAME.height - scaleUiY(148);
    const btnW = scaleUiX(140);
    const btnH = scaleUiY(48);
    const mid = GAME.width / 2;
    const gapX = scaleUiX(154);

    this.saveBtn = createTouchButton(
      scene,
      mid - gapX,
      actionY,
      "Save",
      () => this.dispatch({ type: "requestSave" }),
      {
        width: btnW,
        height: btnH,
        depth: 510,
        fontSize: `${scaleUiX(16)}px`,
        fillColor: 0x15803d,
        strokeColor: 0x4ade80,
      },
    );
    this.loadBtn = createTouchButton(
      scene,
      mid,
      actionY,
      "Load",
      () => this.dispatch({ type: "requestLoad" }),
      {
        width: btnW,
        height: btnH,
        depth: 510,
        fontSize: `${scaleUiX(16)}px`,
        fillColor: 0x1d4ed8,
        strokeColor: 0x60a5fa,
      },
    );
    this.deleteBtn = createTouchButton(
      scene,
      mid + gapX,
      actionY,
      "Delete",
      () => this.dispatch({ type: "requestDelete" }),
      {
        width: btnW,
        height: btnH,
        depth: 510,
        fontSize: `${scaleUiX(16)}px`,
        fillColor: 0x9f1239,
        strokeColor: 0xfb7185,
      },
    );

    this.confirmBtn = createTouchButton(
      scene,
      mid - scaleUiX(80),
      actionY,
      "Confirm",
      () => this.dispatch({ type: "confirm" }),
      {
        width: scaleUiX(140),
        height: btnH,
        depth: 510,
        fontSize: `${scaleUiX(16)}px`,
        fillColor: 0x15803d,
        strokeColor: 0x4ade80,
      },
    );
    this.cancelBtn = createTouchButton(
      scene,
      mid + scaleUiX(80),
      actionY,
      "Cancel",
      () => this.dispatch({ type: "cancel" }),
      {
        width: scaleUiX(140),
        height: btnH,
        depth: 510,
        fontSize: `${scaleUiX(16)}px`,
        fillColor: 0x52525b,
        strokeColor: 0xa1a1aa,
      },
    );

    this.closeBtn = createTouchButton(
      scene,
      mid,
      GAME.height - scaleUiY(80),
      "Close",
      () => this.destroy(),
      {
        width: scaleUiX(120),
        height: scaleUiY(40),
        depth: 510,
        fontSize: `${scaleUiX(14)}px`,
        fillColor: 0x52525b,
        strokeColor: 0xa1a1aa,
      },
    );
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
      row.bg.setFillStyle(on ? 0x1e3a5f : 0x3f3f46);
      row.bg.setStrokeStyle(2, on ? 0x60a5fa : 0x71717a);
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

  private setButtonVisible(
    btn: ReturnType<typeof createTouchButton>,
    visible: boolean,
  ): void {
    btn.container.setVisible(visible);
    if (visible) btn.container.setInteractive();
    else btn.container.disableInteractive();
  }

  private setButtonEnabled(
    btn: ReturnType<typeof createTouchButton>,
    enabled: boolean,
  ): void {
    btn.container.setAlpha(enabled ? 1 : 0.45);
    if (enabled) btn.container.setInteractive();
    else btn.container.disableInteractive();
  }

  destroy(): void {
    if (this.tornDown) return;
    this.tornDown = true;
    this.modalLease.release();
    if (this.root.active) this.root.destroy();
    this.onDismiss?.();
  }

  e2eTapTargets(): Record<string, { x: number; y: number }> {
    const out: Record<string, { x: number; y: number }> = {};
    const add = (
      id: string,
      btn: ReturnType<typeof createTouchButton>,
    ): void => {
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
