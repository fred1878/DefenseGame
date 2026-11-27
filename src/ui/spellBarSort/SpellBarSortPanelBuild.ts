import Phaser from "phaser";
import {
  GAME,
  SPELL_BAR,
  TOWN_SPELL_SORT_BAR,
  TOWN_SPELL_SORT_PANEL,
} from "../../config";
import { spellIconTextureKey } from "../../content/assets";
import { autoCastFlagsForSlots } from "../../content/spellBarAutoCast";
import { isSpellPoolSelectable } from "../../content/spellPoolReadiness";
import {
  getSpellCatalog,
  type SpellDefinition,
  type SpellId,
} from "../../content/spells";
import { scaleUiX, scaleUiY } from "../../config/uiScale";
import { bindTapOrLongPress, createTouchButton } from "../touchButton";
import { uiTextStyle } from "../uiTextStyle";

export type SlotView = {
  frame: Phaser.GameObjects.Rectangle;
  icon: Phaser.GameObjects.Image;
  nameLabel: Phaser.GameObjects.Text;
  indexLabel: Phaser.GameObjects.Text;
  autoBorder: Phaser.GameObjects.Rectangle;
};

export type PoolChip = {
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

export type SpellBarSortPanelHandlers = {
  onSlotTap(slotIndex: number): void;
  onSlotLongPress(slotIndex: number): void;
  onPoolPointerDown(spellId: SpellId, pointer: Phaser.Input.Pointer): void;
  onClearAll(): void;
  onDone(): void;
};

export type SpellBarSortPanelUi = {
  slotViews: SlotView[];
  poolChips: PoolChip[];
  clearAllBtn: ReturnType<typeof createTouchButton>;
  doneBtn: ReturnType<typeof createTouchButton>;
};

/**
 * Builds the spell sort overlay contents (title, hint, 4×2 bar, spell pool,
 * Clear all / Done) into `root`, in the original creation order.
 */
export function buildSpellBarSortPanelUi(
  scene: Phaser.Scene,
  root: Phaser.GameObjects.Container,
  slots: readonly SpellId[],
  autoCastSpellIds: readonly SpellId[],
  handlers: SpellBarSortPanelHandlers,
): SpellBarSortPanelUi {
  const slotViews: SlotView[] = [];
  const poolChips: PoolChip[] = [];
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
  root.add(title);

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
  root.add(hint);

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
      .setStrokeStyle(bar.autoCastBorderWidthPx, bar.autoCastBorderColor, 1)
      .setFillStyle(0x000000, 0)
      .setVisible(autoCastFlagsForSlots(slots, autoCastSpellIds)[i] ?? false);

    const slotIndex = i;
    bindTapOrLongPress(
      scene,
      frame,
      {
        onTap: () => handlers.onSlotTap(slotIndex),
        onLongPress: () => handlers.onSlotLongPress(slotIndex),
        longPressMs: bar.longPressMs,
      },
      {
        bg: frame,
        colors: { rest: 0x1e1b4b, pressed: 0x2e2b5b },
      },
    );

    const icon = scene.add
      .image(x, y, "spell_icon_fire_bolt")
      .setVisible(false);
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

    slotViews.push({ frame, icon, nameLabel, indexLabel, autoBorder });
    // Auto-cast ring drawn above the icon so it is not covered.
    root.add([frame, icon, nameLabel, indexLabel, autoBorder]);
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
    const icon = tryAddSpellIcon(scene, x, y, def, poolCell);
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
        handlers.onPoolPointerDown(def.id, p),
      );
      icon?.setInteractive({ useHandCursor: true });
      icon?.on("pointerdown", (p: Phaser.Input.Pointer) =>
        handlers.onPoolPointerDown(def.id, p),
      );
    }
    poolChips.push({
      spellId: def.id,
      poolSelectable,
      frame,
      icon,
      nameLabel,
    });
    root.add(frame);
    if (icon) root.add(icon);
    root.add(nameLabel);
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

  const clearAllBtn = createTouchButton(
    scene,
    clearAllX,
    footerBtnY,
    "Clear all",
    () => handlers.onClearAll(),
    {
      width: footerBtnW,
      height: footerBtnH,
      depth: 510,
      fontSize: `${scaleUiX(14)}px`,
      fillColor: 0x52525b,
      strokeColor: 0xa1a1aa,
    },
  );
  const doneBtn = createTouchButton(
    scene,
    doneX,
    footerBtnY,
    "Done",
    () => handlers.onDone(),
    { width: footerBtnW, height: footerBtnH, depth: 510 },
  );
  root.add(clearAllBtn.container);
  root.add(doneBtn.container);

  return { slotViews, poolChips, clearAllBtn, doneBtn };
}

function tryAddSpellIcon(
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
