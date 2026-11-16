import Phaser from "phaser";
import { GAME, SPELL_BAR, spellBarIconDisplayPx } from "../config";
import { spellIconTextureKey } from "../content/assets";
import {
  getSpellCatalog,
  spellById,
  type SpellDefinition,
  type SpellId,
} from "../content/spells";
import { scaleUiX, scaleUiY } from "../core/displayScale";
import { bindTapOrLongPress, createTouchButton } from "./touchButton";
import { uiTextStyle } from "./uiTextStyle";

export type SpellBarSortResult = {
  slots: SpellId[];
  autoCast: boolean[];
};

type DragState = {
  spellId: SpellId;
  ghost: Phaser.GameObjects.Container;
};

type SlotView = {
  frame: Phaser.GameObjects.Rectangle;
  icon: Phaser.GameObjects.Image;
  indexLabel: Phaser.GameObjects.Text;
  autoBorder: Phaser.GameObjects.Rectangle;
};

type PoolChip = {
  spellId: SpellId;
  castable: boolean;
  frame: Phaser.GameObjects.Rectangle;
  icon: Phaser.GameObjects.Image | null;
};

const POOL_COLUMNS = 7;
const SLOTTED_POOL_ALPHA = 0.5;
const COMING_SOON_ALPHA = 0.48;

/**
 * Town overlay: drag spells between the 4-slot bar and the full catalog pool.
 */
export class SpellBarSortPanel {
  private readonly root: Phaser.GameObjects.Container;
  private readonly scene: Phaser.Scene;
  private slots: SpellId[];
  private autoCast: boolean[];
  private readonly onDone: (result: SpellBarSortResult) => void;
  private readonly slotViews: SlotView[] = [];
  private readonly poolChips: PoolChip[] = [];
  private drag: DragState | null = null;

  constructor(
    scene: Phaser.Scene,
    initialSlots: SpellId[],
    autoCast: boolean[],
    onDone: (result: SpellBarSortResult) => void,
  ) {
    this.scene = scene;
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
      .text(
        GAME.width / 2,
        scaleUiY(64),
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
        scaleUiY(98),
        "4×2 night bar — 8 slots, same order as defense. Drag bright icons on; dim = on bar; faded = coming soon. Long-press a filled slot for auto-cast (yellow ring).",
        uiTextStyle(scene, {
          fontSize: `${scaleUiX(13)}px`,
          color: "#a1a1aa",
          align: "center",
          wordWrap: { width: GAME.width - scaleUiX(36) },
        }),
      )
      .setOrigin(0.5, 0);
    this.root.add(hint);

    const barCell = SPELL_BAR.slotSizePx;
    const barGap = SPELL_BAR.slotGapPx;
    const barRowGap = SPELL_BAR.rowGapPx;
    const gridTop = scaleUiY(168);
    const gridW = SPELL_BAR.columnCount * barCell + (SPELL_BAR.columnCount - 1) * barGap;
    const gridLeft = GAME.width / 2 - gridW / 2 + barCell / 2;

    for (let i = 0; i < SPELL_BAR.slotCount; i++) {
      const col = i % SPELL_BAR.columnCount;
      const row = Math.floor(i / SPELL_BAR.columnCount);
      const x = gridLeft + col * (barCell + barGap);
      const y = gridTop + row * (barCell + barRowGap);
      const frame = scene.add
        .rectangle(x, y, barCell, barCell, 0x1e1b4b, 0.92)
        .setStrokeStyle(2, 0x6366f1);
      frame.setInteractive({ useHandCursor: true });

      const autoBorder = scene.add
        .rectangle(x, y, barCell, barCell)
        .setStrokeStyle(
          SPELL_BAR.autoCastBorderWidthPx,
          SPELL_BAR.autoCastBorderColor,
          1,
        )
        .setFillStyle(0x000000, 0)
        .setVisible(this.autoCast[i] ?? false);

      const slotIndex = i;
      bindTapOrLongPress(
        scene,
        frame,
        {
          onTap: () => this.onDropOnSlot(slotIndex),
          onLongPress: () => this.toggleAutoCast(slotIndex),
          longPressMs: SPELL_BAR.longPressMs,
        },
        {
          bg: frame,
          colors: { rest: 0x1e1b4b, pressed: 0x2e2b5b },
        },
      );

      const icon = scene.add.image(x, y, "spell_icon_fire_bolt").setVisible(false);
      const indexLabel = scene.add
        .text(
          x,
          y,
          `${i + 1}`,
          uiTextStyle(scene, {
            fontSize: `${scaleUiX(18)}px`,
            color: "#6366f1",
          }),
        )
        .setOrigin(0.5);

      this.slotViews.push({ frame, icon, indexLabel, autoBorder });
      // Auto-cast ring drawn above the icon so it is not covered.
      this.root.add([frame, icon, indexLabel, autoBorder]);
    }

    const barRows =
      SPELL_BAR.rowCount > 0
        ? SPELL_BAR.rowCount
        : Math.ceil(SPELL_BAR.slotCount / SPELL_BAR.columnCount);
    const poolHeaderY =
      gridTop + barRows * barCell + (barRows - 1) * barRowGap + scaleUiY(36);
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
    const poolTop = poolHeaderY + scaleUiY(24);
    const poolGridW = POOL_COLUMNS * poolCell + (POOL_COLUMNS - 1) * poolGap;
    const poolLeft = GAME.width / 2 - poolGridW / 2 + poolCell / 2;

    const catalog = [...getSpellCatalog()].sort((a, b) => {
      if (a.castableInDefense !== b.castableInDefense) {
        return a.castableInDefense ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    for (let i = 0; i < catalog.length; i++) {
      const def = catalog[i]!;
      const col = i % POOL_COLUMNS;
      const row = Math.floor(i / POOL_COLUMNS);
      const x = poolLeft + col * (poolCell + poolGap);
      const y = poolTop + row * (poolCell + poolGap);
      const castable = def.castableInDefense;
      const frame = scene.add
        .rectangle(
          x,
          y,
          poolCell,
          poolCell,
          castable ? 0x312e81 : 0x27272a,
          castable ? 1 : 0.85,
        )
        .setStrokeStyle(2, castable ? 0x818cf8 : 0x52525b);
      const icon = this.tryAddSpellIcon(scene, x, y, def, poolCell);
      if (castable) {
        frame.setInteractive({ useHandCursor: true });
        frame.on("pointerdown", (p: Phaser.Input.Pointer) => this.beginDrag(def.id, p));
        icon?.setInteractive({ useHandCursor: true });
        icon?.on("pointerdown", (p: Phaser.Input.Pointer) => this.beginDrag(def.id, p));
      }
      this.poolChips.push({ spellId: def.id, castable, frame, icon });
      this.root.add(frame);
      if (icon) this.root.add(icon);
    }

    const poolRows = Math.ceil(catalog.length / POOL_COLUMNS);
    const doneY =
      poolTop + poolRows * (poolCell + poolGap) + scaleUiY(28);

    const done = createTouchButton(
      scene,
      GAME.width / 2,
      Math.min(doneY, GAME.height - scaleUiY(56)),
      "Done",
      () => this.finish(),
      { width: scaleUiX(200), height: scaleUiY(44), depth: 510 },
    );
    this.root.add(done.container);

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
    const iconSize = spellBarIconDisplayPx();
    for (let i = 0; i < this.slotViews.length; i++) {
      const view = this.slotViews[i]!;
      const id = this.slots[i] ?? "";
      if (id) {
        const key = spellIconTextureKey(id);
        if (this.scene.textures.exists(key)) {
          view.icon.setTexture(key).setDisplaySize(iconSize, iconSize).setVisible(true);
          view.icon.setAlpha(1);
          this.scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
        } else {
          view.icon.setVisible(false);
        }
        view.indexLabel.setVisible(false);
      } else {
        view.icon.setVisible(false);
        view.indexLabel.setVisible(true).setText(`${i + 1}`);
      }
    }
    this.refreshPoolAssignmentState();
    this.refreshAutoCastBorders();
  }

  private refreshAutoCastBorders(): void {
    for (let i = 0; i < this.slotViews.length; i++) {
      const border = this.slotViews[i]!.autoBorder;
      border.setVisible(Boolean(this.autoCast[i]));
      if (this.autoCast[i]) this.root.bringToTop(border);
    }
  }

  private toggleAutoCast(slotIndex: number): void {
    const id = this.slots[slotIndex] ?? "";
    if (!id) return;
    this.autoCast[slotIndex] = !this.autoCast[slotIndex];
    this.refreshAutoCastBorders();
  }

  private refreshPoolAssignmentState(): void {
    for (const chip of this.poolChips) {
      const onBar = this.slots.includes(chip.spellId);
      const base = chip.castable ? 1 : COMING_SOON_ALPHA;
      const alpha = onBar ? base * SLOTTED_POOL_ALPHA : base;
      chip.icon?.setAlpha(alpha);
      chip.frame.setAlpha(chip.castable ? 1 : 0.72);
    }
  }

  private beginDrag(spellId: SpellId, pointer: Phaser.Input.Pointer): void {
    if (this.drag) return;
    const def = spellById(spellId);
    if (!def?.castableInDefense) return;
    const ghost = this.scene.add.container(pointer.x, pointer.y).setDepth(600).setScrollFactor(0);
    const cell = scaleUiX(48);
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