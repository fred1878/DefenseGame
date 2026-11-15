import Phaser from "phaser";
import { GAME, SPELL_BAR } from "../config";
import {
  SPELL_CATALOG,
  spellById,
  type SpellId,
} from "../content/spells";
import { scaleUiX, scaleUiY } from "../core/displayScale";
import { createTouchButton } from "./touchButton";
export type SpellBarSortResult = {
  slots: SpellId[];
  autoCast: boolean[];
};

type DragState = {
  spellId: SpellId;
  ghost: Phaser.GameObjects.Container;
};

/**
 * Town overlay: drag spells between the bar grid and the spell pool.
 */
export class SpellBarSortPanel {
  private readonly root: Phaser.GameObjects.Container;
  private slots: SpellId[];
  private autoCast: boolean[];
  private readonly onDone: (result: SpellBarSortResult) => void;
  private slotLabels: Phaser.GameObjects.Text[] = [];
  private drag: DragState | null = null;

  constructor(
    scene: Phaser.Scene,
    initialSlots: SpellId[],
    autoCast: boolean[],
    onDone: (result: SpellBarSortResult) => void,
  ) {
    this.onDone = onDone;
    this.slots = initialSlots.slice(0, SPELL_BAR.slotCount);
    while (this.slots.length < SPELL_BAR.slotCount) this.slots.push("");
    this.autoCast = autoCast.slice(0, SPELL_BAR.slotCount);
    while (this.autoCast.length < SPELL_BAR.slotCount) this.autoCast.push(false);

    this.root = scene.add.container(0, 0).setDepth(500).setScrollFactor(0);

    const dim = scene.add
      .rectangle(GAME.width / 2, GAME.height / 2, GAME.width, GAME.height, 0x000000, 0.72);
    this.root.add(dim);

    const title = scene.add
      .text(GAME.width / 2, scaleUiY(80), "Spell bar", {
        fontSize: `${scaleUiX(24)}px`,
        color: "#f4f4f5",
      })
      .setOrigin(0.5);
    this.root.add(title);

    const hint = scene.add
      .text(GAME.width / 2, scaleUiY(118), "Drag spells on or off the bar · same 2×3 order as night", {
        fontSize: `${scaleUiX(14)}px`,
        color: "#a1a1aa",
        align: "center",
        wordWrap: { width: GAME.width - scaleUiX(40) },
      })
      .setOrigin(0.5, 0);
    this.root.add(hint);

    const gridTop = scaleUiY(200);
    const cell = scaleUiX(56);
    const gap = scaleUiX(8);
    const rowGap = scaleUiY(10);
    const gridW = SPELL_BAR.columnCount * cell + (SPELL_BAR.columnCount - 1) * gap;
    const gridLeft = GAME.width / 2 - gridW / 2 + cell / 2;

    for (let i = 0; i < SPELL_BAR.slotCount; i++) {
      const col = i % SPELL_BAR.columnCount;
      const row = Math.floor(i / SPELL_BAR.columnCount);
      const x = gridLeft + col * (cell + gap);
      const y = gridTop + row * (cell + rowGap);
      const frame = scene.add
        .rectangle(x, y, cell, cell, 0x1e1b4b, 0.9)
        .setStrokeStyle(2, 0x6366f1);
      frame.setInteractive({ draggable: false, useHandCursor: true });
      frame.on("pointerup", () => this.onDropOnSlot(i));
      const label = scene.add.text(x, y, this.slotLabel(i), {
        fontSize: `${scaleUiX(13)}px`,
        color: "#e0e7ff",
      }).setOrigin(0.5);
      this.slotLabels.push(label);
      this.root.add([frame, label]);
    }

    const poolY = gridTop + rowGap + cell * 2 + scaleUiY(48);
    scene.add
      .text(GAME.width / 2, poolY - scaleUiY(28), "Spell pool", {
        fontSize: `${scaleUiX(16)}px`,
        color: "#d4d4d8",
      })
      .setOrigin(0.5);

    const poolIds = SPELL_CATALOG.map((s) => s.id);
    const poolW = poolIds.length * (cell + gap) - gap;
    let poolX = GAME.width / 2 - poolW / 2 + cell / 2;
    for (const id of poolIds) {
      const chip = scene.add
        .rectangle(poolX, poolY, cell, cell, 0x312e81, 1)
        .setStrokeStyle(2, 0x818cf8)
        .setInteractive({ useHandCursor: true });
      chip.setData("spellId", id);
      chip.on("pointerdown", (p: Phaser.Input.Pointer) => this.beginDrag(id, p));
      const def = spellById(id);
      const t = scene.add.text(poolX, poolY, def?.shortLabel ?? id, {
        fontSize: `${scaleUiX(12)}px`,
        color: "#fef9c3",
      }).setOrigin(0.5);
      this.root.add([chip, t]);
      poolX += cell + gap;
    }

    const done = createTouchButton(
      scene,
      GAME.width / 2,
      GAME.height - scaleUiY(80),
      "Done",
      () => this.finish(),
      { width: scaleUiX(200), height: scaleUiY(44), depth: 510 },
    );
    this.root.add(done.container);

    scene.input.on("pointermove", this.onPointerMove);
    scene.input.on("pointerup", this.onPointerUp);
    this.finishCleanup = () => {
      scene.input.off("pointermove", this.onPointerMove);
      scene.input.off("pointerup", this.onPointerUp);
    };
  }

  private finishCleanup: () => void = () => {};

  private slotLabel(index: number): string {
    const id = this.slots[index] ?? "";
    if (!id) return `${index + 1}`;
    const def = spellById(id);
    return def?.shortLabel ?? id;
  }

  private refreshSlotLabels(): void {
    for (let i = 0; i < this.slotLabels.length; i++) {
      this.slotLabels[i]!.setText(this.slotLabel(i));
    }
  }

  private beginDrag(spellId: SpellId, pointer: Phaser.Input.Pointer): void {
    if (this.drag) return;
    const scene = this.root.scene;
    const ghost = scene.add.container(pointer.x, pointer.y).setDepth(600).setScrollFactor(0);
    const def = spellById(spellId);
    const bg = scene.add
      .rectangle(0, 0, scaleUiX(56), scaleUiX(56), 0x4c1d95, 0.92)
      .setStrokeStyle(2, 0xe879f9);
    const t = scene.add.text(0, 0, def?.shortLabel ?? spellId, {
      fontSize: `${scaleUiX(12)}px`,
      color: "#fafafa",
    }).setOrigin(0.5);
    ghost.add([bg, t]);
    this.drag = { spellId, ghost };
  }

  private onPointerMove = (pointer: Phaser.Input.Pointer): void => {
    if (!this.drag) return;
    this.drag.ghost.setPosition(pointer.x, pointer.y);
  };

  private onPointerUp = (): void => {
    if (!this.drag) return;
    this.drag.ghost.destroy();
    this.drag = null;
  };

  private onDropOnSlot(index: number): void {
    if (!this.drag) {
      const id = this.slots[index] ?? "";
      if (id) {
        this.slots[index] = "";
        this.refreshSlotLabels();
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
    this.refreshSlotLabels();
  }

  private finish(): void {
    this.finishCleanup();
    this.onDone({ slots: [...this.slots], autoCast: [...this.autoCast] });
    this.destroy();
  }

  destroy(): void {
    if (this.drag) {
      this.drag.ghost.destroy();
      this.drag = null;
    }
    this.finishCleanup();
    this.root.destroy();
  }
}