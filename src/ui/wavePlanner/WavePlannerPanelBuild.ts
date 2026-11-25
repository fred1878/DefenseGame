import Phaser from "phaser";
import { GAME } from "../../config";
import type { DataStore } from "../../core/DataStore";
import { scaleUiX, scaleUiY } from "../../core/displayScale";
import { INPUT_MODALITY } from "../../input/inputModality";
import {
  acquireModalInput,
  bindModalDimBackdrop,
  type ModalInputLease,
} from "../../input/modalBackdrop";
import {
  WAVE_PLANNER_COUNT_MIN,
  WAVE_PLANNER_DEFAULT_AT_MS,
  WAVE_PLANNER_DEFAULT_INTERVAL_MS,
} from "../../systems/wavePlannerTiming";
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
  const root = scene.add.container(0, 0).setDepth(500).setScrollFactor(0);

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
  const modalLease = acquireModalInput(scene, INPUT_MODALITY.townWavePlanner);

  root.add(
    scene.add
      .text(
        GAME.width / 2,
        scaleUiY(64),
        "Wave planner",
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
        "Rows: count · spawn at (ms) · interval (ms) — timing adjusts by 100. Simulated night; no gold or night advance.",
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
  const nameColW = scaleUiX(152);
  const listLeft = (GAME.width - rowW) / 2;
  const numericColLeft = listLeft + nameColW;
  const rowH = scaleUiY(50);
  const gap = scaleUiY(8);
  const rowStride = rowH + gap;

  const footerBlockH = scaleUiY(22) + scaleUiY(48) + scaleUiY(56) + scaleUiY(36);
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
      0x000000,
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
      .rectangle(nameCx, cy, nameColW, rowH, 0x3f3f46, 1)
      .setStrokeStyle(2, 0x71717a);
    const check = scene.add
      .text(
        listLeft + scaleUiX(12),
        cy,
        "☐",
        uiTextStyle(scene, { fontSize: `${scaleUiX(16)}px`, color: "#a1a1aa" }),
      )
      .setOrigin(0.5);
    const text = scene.add
      .text(nameCx + scaleUiX(6), cy, label, uiTextStyle(scene, {
        fontSize: `${scaleUiX(13)}px`,
        color: "#fafafa",
      }))
      .setOrigin(0.5);

    counts.set(enemyId, seedCount);
    atMs.set(enemyId, WAVE_PLANNER_DEFAULT_AT_MS);
    intervalMs.set(enemyId, WAVE_PLANNER_DEFAULT_INTERVAL_MS);

    const minus: PlannerRow["minus"] = {
      count: null!,
      atMs: null!,
      intervalMs: null!,
    };
    const plus: PlannerRow["plus"] = { count: null!, atMs: null!, intervalMs: null! };
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
      const m = createUiRoundedRect(scene, btnW, btnH, 0x3f3f46, 0x71717a);
      m.setPosition(cx - scaleUiX(22), cy)
        .setInteractive(
          new Phaser.Geom.Rectangle(-btnW / 2, -btnH / 2, btnW, btnH),
          Phaser.Geom.Rectangle.Contains,
        );
      const p = createUiRoundedRect(scene, btnW, btnH, 0x3f3f46, 0x71717a);
      p.setPosition(cx + scaleUiX(22), cy)
        .setInteractive(
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
        .text(cx, cy, initial ?? "0", uiTextStyle(scene, {
          fontSize: `${scaleUiX(12)}px`,
          color: "#e4e4e7",
        }))
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

  const trackW = scaleUiX(6);
  const trackX = (GAME.width + rowW) / 2 + scaleUiX(4) + trackW / 2;
  const scrollTrack = scene.add
    .rectangle(
      trackX,
      listTop + listViewportH / 2,
      trackW,
      listViewportH,
      0x3f3f46,
      0.85,
    )
    .setOrigin(0.5)
    .setVisible(maxScroll > 0);
  const scrollThumb = scene.add
    .rectangle(trackX, listTop, trackW, scaleUiY(32), 0x71717a, 1)
    .setOrigin(0.5, 0)
    .setVisible(maxScroll > 0);
  root.add([scrollTrack, scrollThumb]);

  const maskGraphics = scene.make.graphics({ x: 0, y: 0 }, false);
  maskGraphics.fillStyle(0xffffff);
  maskGraphics.fillRect(
    listLeft,
    listTop,
    rowW,
    listViewportH,
  );
  listContent.setMask(maskGraphics.createGeometryMask());

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
        color: "#fbbf24",
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
      fillColor: 0x15803d,
      strokeColor: 0x4ade80,
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
      fillColor: 0x52525b,
      strokeColor: 0xa1a1aa,
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
