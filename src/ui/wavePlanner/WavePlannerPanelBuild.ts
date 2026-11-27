import Phaser from "phaser";
import { PALETTE, PALETTE_CSS } from "../theme/uiPalette";
import { GAME } from "../../config";
import type { DataStore } from "../../core/DataStore";
import { scaleUiX, scaleUiY } from "../../config/uiScale";
import { INPUT_MODALITY } from "../../input/inputModality";
import {
  openModalPanel,
  type ModalInputLease,
} from "../../input/modalBackdrop";
import {
  WAVE_PLANNER_COUNT_MIN,
  WAVE_PLANNER_DEFAULT_AT_MS,
  WAVE_PLANNER_DEFAULT_INTERVAL_MS,
} from "../../core/wavePlannerTiming";
import { addRosterListChrome } from "../rosterPanelShared";
import { createTouchButton } from "../touchButton";
import { uiTextStyle } from "../uiTextStyle";
import { createUiRoundedRect } from "../uiRoundedRect";

const MAX_VISIBLE_ROWS = 5;

export type NumField = "count" | "atMs" | "intervalMs";

export type PlannerRow = {
  enemyId: string;
  bg: Phaser.GameObjects.Rectangle;
  check: Phaser.GameObjects.Text;
  text: Phaser.GameObjects.Text;
  minus: Record<NumField, ReturnType<typeof createUiRoundedRect>>;
  plus: Record<NumField, ReturnType<typeof createUiRoundedRect>>;
  values: Record<NumField, Phaser.GameObjects.Text>;
};

/** Roster list geometry shared by the panel and its scroll controller. */
export type WavePlannerListLayout = {
  listTop: number;
  listViewportH: number;
  contentHeight: number;
  rowStride: number;
  numericColLeft: number;
  maxScroll: number;
};

export type WavePlannerPanelBuildHandlers = {
  onBumpField(enemyId: string, field: NumField, delta: number): void;
  /** Called right after the list mask is set (original drag wiring point). */
  wireListViewport(listViewport: Phaser.GameObjects.Rectangle): void;
  onStartPressed(): void;
  onClosePressed(): void;
};

export type WavePlannerPanelUi = {
  root: Phaser.GameObjects.Container;
  modalLease: ModalInputLease;
  listContent: Phaser.GameObjects.Container;
  rows: PlannerRow[];
  layout: WavePlannerListLayout;
  scrollTrack: Phaser.GameObjects.Rectangle;
  scrollThumb: Phaser.GameObjects.Rectangle;
  maskGraphics: Phaser.GameObjects.Graphics;
  challengeRatingText: Phaser.GameObjects.Text;
  startBtn: ReturnType<typeof createTouchButton>;
  closeBtn: ReturnType<typeof createTouchButton>;
};

/**
 * Builds the wave planner overlay (dim + modal lease, title, hint, roster rows
 * with count/at/interval steppers, scrollbar, mask, challenge rating,
 * Start/Close) in the original creation order. Seeds the per-enemy maps.
 */
export function buildWavePlannerPanelUi(
  scene: Phaser.Scene,
  store: DataStore,
  enemyIds: readonly string[],
  fields: {
    counts: Map<string, number>;
    atMs: Map<string, number>;
    intervalMs: Map<string, number>;
  },
  handlers: WavePlannerPanelBuildHandlers,
): WavePlannerPanelUi {
  const { counts, atMs, intervalMs } = fields;
  const rows: PlannerRow[] = [];
  const modal = openModalPanel(scene, {
    token: INPUT_MODALITY.townWavePlanner,
  });
  const root = modal.root;
  const modalLease = modal.lease;

  root.add(
    scene.add
      .text(
        GAME.width / 2,
        scaleUiY(64),
        "Wave planner",
        uiTextStyle(scene, {
          fontSize: `${scaleUiX(24)}px`,
          color: PALETTE_CSS.zinc100,
        }),
      )
      .setOrigin(0.5),
  );

  root.add(
    scene.add
      .text(
        GAME.width / 2,
        scaleUiY(98),
        "Rows: count · spawn at (ms) · interval (ms) — timing adjusts by 100. Simulated night; no gold or night advance.",
        uiTextStyle(scene, {
          fontSize: `${scaleUiX(13)}px`,
          color: PALETTE_CSS.zinc400,
          align: "center",
          wordWrap: { width: GAME.width - scaleUiX(36) },
        }),
      )
      .setOrigin(0.5, 0),
  );

  const rowW = GAME.width - scaleUiX(48);
  const nameColW = scaleUiX(152);
  const listLeft = (GAME.width - rowW) / 2;
  const numericColLeft = listLeft + nameColW;
  const rowH = scaleUiY(50);
  const gap = scaleUiY(8);
  const rowStride = rowH + gap;

  const footerBlockH =
    scaleUiY(22) + scaleUiY(48) + scaleUiY(56) + scaleUiY(36);
  const listTop = scaleUiY(156);
  const listBottom = GAME.height - footerBlockH;
  const listBudget = Math.max(scaleUiY(100), listBottom - listTop);
  const cappedByRows = MAX_VISIBLE_ROWS * rowStride - gap;
  const listViewportH = Math.min(listBudget, cappedByRows);

  const listViewport = scene.add
    .rectangle(
      GAME.width / 2,
      listTop + listViewportH / 2,
      rowW,
      listViewportH,
      PALETTE.black,
      0,
    )
    .setInteractive({ draggable: false });
  root.add(listViewport);

  const listContent = scene.add.container(0, listTop);
  root.add(listContent);

  const numColW = (rowW - nameColW) / 3;
  const colCenters = [0, 1, 2].map(
    (i) => numericColLeft + numColW * i + numColW / 2,
  );

  let localY = 0;
  const seedCount = Math.max(
    WAVE_PLANNER_COUNT_MIN,
    store.player.endlessPanelDefaultConcurrent,
  );
  for (const enemyId of enemyIds) {
    const def = store.enemies[enemyId];
    const label = def?.displayName ?? enemyId;
    const cy = localY + rowH / 2;
    const nameCx = listLeft + nameColW / 2;

    const bg = scene.add
      .rectangle(nameCx, cy, nameColW, rowH, PALETTE.zinc700, 1)
      .setStrokeStyle(2, PALETTE.zinc500);
    const check = scene.add
      .text(
        listLeft + scaleUiX(12),
        cy,
        "☐",
        uiTextStyle(scene, {
          fontSize: `${scaleUiX(16)}px`,
          color: PALETTE_CSS.zinc400,
        }),
      )
      .setOrigin(0.5);
    const text = scene.add
      .text(
        nameCx + scaleUiX(6),
        cy,
        label,
        uiTextStyle(scene, {
          fontSize: `${scaleUiX(13)}px`,
          color: PALETTE_CSS.zinc50,
        }),
      )
      .setOrigin(0.5);

    counts.set(enemyId, seedCount);
    atMs.set(enemyId, WAVE_PLANNER_DEFAULT_AT_MS);
    intervalMs.set(enemyId, WAVE_PLANNER_DEFAULT_INTERVAL_MS);

    const minus: PlannerRow["minus"] = {
      count: null!,
      atMs: null!,
      intervalMs: null!,
    };
    const plus: PlannerRow["plus"] = {
      count: null!,
      atMs: null!,
      intervalMs: null!,
    };
    const values: PlannerRow["values"] = {
      count: null!,
      atMs: null!,
      intervalMs: null!,
    };

    const fields: { key: NumField; centerIndex: number }[] = [
      { key: "count", centerIndex: 0 },
      { key: "atMs", centerIndex: 1 },
      { key: "intervalMs", centerIndex: 2 },
    ];
    for (const { key, centerIndex } of fields) {
      const cx = colCenters[centerIndex]!;
      const btnW = scaleUiX(22);
      const btnH = scaleUiY(26);
      const m = createUiRoundedRect(
        scene,
        btnW,
        btnH,
        PALETTE.zinc700,
        PALETTE.zinc500,
      );
      m.setPosition(cx - scaleUiX(22), cy).setInteractive(
        new Phaser.Geom.Rectangle(-btnW / 2, -btnH / 2, btnW, btnH),
        Phaser.Geom.Rectangle.Contains,
      );
      const p = createUiRoundedRect(
        scene,
        btnW,
        btnH,
        PALETTE.zinc700,
        PALETTE.zinc500,
      );
      p.setPosition(cx + scaleUiX(22), cy).setInteractive(
        new Phaser.Geom.Rectangle(-btnW / 2, -btnH / 2, btnW, btnH),
        Phaser.Geom.Rectangle.Contains,
      );
      m.on("pointerup", (pointer: Phaser.Input.Pointer) => {
        pointer.event.stopPropagation();
        handlers.onBumpField(enemyId, key, -1);
      });
      p.on("pointerup", (pointer: Phaser.Input.Pointer) => {
        pointer.event.stopPropagation();
        handlers.onBumpField(enemyId, key, 1);
      });
      minus[key] = m;
      plus[key] = p;
      const initial =
        key === "count"
          ? String(counts.get(enemyId))
          : key === "atMs"
            ? String(atMs.get(enemyId))
            : String(intervalMs.get(enemyId));
      values[key] = scene.add
        .text(
          cx,
          cy,
          initial ?? "0",
          uiTextStyle(scene, {
            fontSize: `${scaleUiX(12)}px`,
            color: PALETTE_CSS.zinc200,
          }),
        )
        .setOrigin(0.5);
    }

    const row: PlannerRow = {
      enemyId,
      bg,
      check,
      text,
      minus,
      plus,
      values,
    };
    rows.push(row);
    listContent.add([
      bg,
      check,
      text,
      minus.count,
      plus.count,
      values.count,
      minus.atMs,
      plus.atMs,
      values.atMs,
      minus.intervalMs,
      plus.intervalMs,
      values.intervalMs,
    ]);
    localY += rowStride;
  }

  const contentHeight = Math.max(localY - gap, rowH);
  const maxScroll = Math.max(0, contentHeight - listViewportH);

  const { scrollTrack, scrollThumb, maskGraphics } = addRosterListChrome(
    scene,
    root,
    listContent,
    { listLeft, listTop, rowW, listViewportH, maxScroll },
  );

  handlers.wireListViewport(listViewport);

  const footerAnchorY = listBottom + scaleUiY(11);
  const crTextY = footerAnchorY - scaleUiY(9);
  const challengeRatingText = scene.add
    .text(
      GAME.width / 2,
      crTextY,
      "Challenge rating: 0",
      uiTextStyle(scene, {
        fontSize: `${scaleUiX(14)}px`,
        color: PALETTE_CSS.amber400,
      }),
    )
    .setOrigin(0.5);
  root.add(challengeRatingText);

  const startY = footerAnchorY + scaleUiY(26);
  const startBtn = createTouchButton(
    scene,
    GAME.width / 2,
    startY,
    "Start wave",
    () => handlers.onStartPressed(),
    {
      width: scaleUiX(200),
      height: scaleUiY(48),
      depth: 510,
      fontSize: `${scaleUiX(16)}px`,
      fillColor: PALETTE.green700,
      strokeColor: PALETTE.green400,
    },
  );
  const closeBtn = createTouchButton(
    scene,
    GAME.width / 2,
    startY + scaleUiY(56),
    "Close",
    () => handlers.onClosePressed(),
    {
      width: scaleUiX(120),
      height: scaleUiY(40),
      depth: 510,
      fontSize: `${scaleUiX(14)}px`,
      fillColor: PALETTE.zinc600,
      strokeColor: PALETTE.zinc400,
    },
  );
  root.add([startBtn.container, closeBtn.container]);

  return {
    root,
    modalLease,
    listContent,
    rows,
    layout: {
      listTop,
      listViewportH,
      contentHeight,
      rowStride,
      numericColLeft,
      maxScroll,
    },
    scrollTrack,
    scrollThumb,
    maskGraphics,
    challengeRatingText,
    startBtn,
    closeBtn,
  };
}
