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
import { addRosterListChrome } from "../rosterPanelShared";
import { createTouchButton, hitAreaLocalPointToScreen } from "../touchButton";
import { uiTextStyle } from "../uiTextStyle";
import { createUiRoundedRect, type UiRoundedRect } from "../uiRoundedRect";

/** Max roster rows visible before scrolling. */
export const MAX_VISIBLE_ROWS = 6;
/** Lenient top edge for the invisible list hit layer (matches HUD tap padding). */
export const LIST_VIEWPORT_TOP_HIT_SLOP_PX = 4;

export type EnemyRow = {
  enemyId: string;
  label: string;
  bg: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
  check: Phaser.GameObjects.Text;
  capBg: Phaser.GameObjects.Rectangle;
  capMinus: UiRoundedRect;
  capPlus: UiRoundedRect;
  capValue: Phaser.GameObjects.Text;
  capLocalY: number;
};

/** Roster list geometry shared by the panel, scroll/drag and e2e helpers. */
export type EndlessListLayout = {
  listTop: number;
  listViewportH: number;
  contentHeight: number;
  rowH: number;
  rowStride: number;
  rowW: number;
  nameColW: number;
  capColW: number;
  listLeft: number;
  /** Screen x where the concurrent-cap column begins (taps right of this do not toggle selection). */
  capColLeft: number;
  maxScroll: number;
};

type HitTest = (
  hitArea: Phaser.Geom.Rectangle,
  x: number,
  y: number,
  gameObject: Phaser.GameObjects.GameObject,
) => boolean;

/** Panel callbacks wired while building (all invoked later, on input). */
export type EndlessModePanelBuildHandlers = {
  listViewportHitForScroll: (screenX: number, screenY: number) => boolean;
  rowNameHitTest: (row: EnemyRow) => HitTest;
  rowCapHitTest: (row: EnemyRow) => HitTest;
  listViewportPointerToScreen: (
    viewport: Phaser.GameObjects.Rectangle,
    localX: number,
    localY: number,
  ) => { screenX: number; screenY: number } | null;
  onBumpCap: (enemyId: string, delta: number) => void;
  onRowPointerDown: (pointer: Phaser.Input.Pointer, enemyId: string) => void;
  onCapPointerDown: (pointer: Phaser.Input.Pointer) => void;
  onViewportPointerDown: (pointer: Phaser.Input.Pointer) => void;
  onToggleInfiniteHp: () => void;
  onStartPressed: () => void;
  onClosePressed: () => void;
};

export type EndlessModePanelUi = {
  root: Phaser.GameObjects.Container;
  modalLease: ModalInputLease;
  listViewport: Phaser.GameObjects.Rectangle;
  listContent: Phaser.GameObjects.Container;
  rows: EnemyRow[];
  layout: EndlessListLayout;
  scrollTrack: Phaser.GameObjects.Rectangle;
  scrollThumb: Phaser.GameObjects.Rectangle;
  maskGraphics: Phaser.GameObjects.Graphics;
  infiniteHpRowY: number;
  infiniteHpBg: UiRoundedRect;
  infiniteHpCheck: Phaser.GameObjects.Text;
  challengeRatingY: number;
  challengeRatingText: Phaser.GameObjects.Text;
  startButtonY: number;
  startBtn: ReturnType<typeof createTouchButton>;
  closeBtn: ReturnType<typeof createTouchButton>;
};

/**
 * Build the endless modal: dim + modal lease, title, roster rows with cap steppers,
 * scroll track, Infinite HP toggle, challenge rating and Start / Close buttons.
 * Seeds `caps` with the default concurrent cap for each roster row.
 */
export function buildEndlessModePanelUi(
  scene: Phaser.Scene,
  store: DataStore,
  enemyIds: readonly string[],
  caps: Map<string, number>,
  h: EndlessModePanelBuildHandlers,
): EndlessModePanelUi {
  const root = scene.add.container(0, 0).setDepth(500).setScrollFactor(0);

  const dim = scene.add
    .rectangle(GAME.width / 2, GAME.height / 2, GAME.width, GAME.height, 0x000000, 0.72);
  bindModalDimBackdrop(dim);
  root.add(dim);
  const modalLease = acquireModalInput(scene, INPUT_MODALITY.townEndless);

  const title = scene.add
    .text(
      GAME.width / 2,
      scaleUiY(64),
      "Endless training",
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
      scaleUiY(98),
      "Pick one or more foes — set on-screen caps — train until you fall or leave. No gold, no night advance.",
      uiTextStyle(scene, {
        fontSize: `${scaleUiX(13)}px`,
        color: "#a1a1aa",
        align: "center",
        wordWrap: { width: GAME.width - scaleUiX(36) },
      }),
    )
    .setOrigin(0.5, 0);
  root.add(hint);

  const rowW = GAME.width - scaleUiX(48);
  const capColW = scaleUiX(96);
  const nameColW = rowW - capColW - scaleUiX(4);
  const listLeft = (GAME.width - rowW) / 2;
  const capColLeft = listLeft + nameColW + scaleUiX(4);
  const rowH = scaleUiY(44);
  const gap = scaleUiY(8);
  const rowStride = rowH + gap;

  const infiniteRowH = scaleUiY(44);
  const crLineHalf = scaleUiY(11);
  const gapAfterInfinite = scaleUiY(16);
  const gapCrToStart = scaleUiY(12);
  const startBtnH = scaleUiY(48);
  const closeBtnH = scaleUiY(40);
  const footerBlockH =
    scaleUiY(12) +
    infiniteRowH +
    gapAfterInfinite +
    crLineHalf * 2 +
    gapCrToStart +
    startBtnH +
    scaleUiY(56) +
    closeBtnH +
    scaleUiY(28);
  const listTop = scaleUiY(148);
  const listBottom = GAME.height - footerBlockH;
  const listBudget = Math.max(scaleUiY(120), listBottom - listTop);
  const cappedByRows =
    MAX_VISIBLE_ROWS * rowStride - gap;
  const listViewportH = Math.min(listBudget, cappedByRows);

  const listHitTopSlop = scaleUiY(LIST_VIEWPORT_TOP_HIT_SLOP_PX);
  const listViewport = scene.add
    .rectangle(
      GAME.width / 2,
      listTop + listViewportH / 2,
      rowW,
      listViewportH,
      0x000000,
      0,
    );
  const listHitW = rowW;
  const listHitH = listViewportH + listHitTopSlop;
  const listViewportHit = new Phaser.Geom.Rectangle(
    -listHitW / 2,
    -listHitH / 2 - listHitTopSlop,
    listHitW,
    listHitH,
  );
  listViewport.setInteractive(
    listViewportHit,
    (hitArea, x, y, gameObject) => {
      if (!Phaser.Geom.Rectangle.Contains(hitArea, x, y)) return false;
      const viewport = gameObject as Phaser.GameObjects.Rectangle;
      const mapped = h.listViewportPointerToScreen(viewport, x, y);
      const pt =
        mapped != null
          ? { x: mapped.screenX, y: mapped.screenY }
          : hitAreaLocalPointToScreen(viewport, x, y);
      if (!pt) return false;
      return h.listViewportHitForScroll(pt.x, pt.y);
    },
  );
  root.add(listViewport);

  const listContent = scene.add.container(0, listTop);
  root.add(listContent);

  const rows: EnemyRow[] = [];
  let localY = 0;
  for (const enemyId of enemyIds) {
    const def = store.enemies[enemyId];
    const label = def?.displayName ?? enemyId;
    const cy = localY + rowH / 2;
    const nameCx = listLeft + nameColW / 2;
    const capCx = listLeft + nameColW + scaleUiX(4) + capColW / 2;

    const bg = scene.add
      .rectangle(nameCx, cy, nameColW, rowH, 0x3f3f46, 1)
      .setStrokeStyle(2, 0x71717a);
    const check = scene.add
      .text(
        listLeft + scaleUiX(14),
        cy,
        "☐",
        uiTextStyle(scene, {
          fontSize: `${scaleUiX(18)}px`,
          color: "#a1a1aa",
        }),
      )
      .setOrigin(0.5);
    const text = scene.add
      .text(nameCx + scaleUiX(8), cy, label, uiTextStyle(scene, {
        fontSize: `${scaleUiX(15)}px`,
        color: "#fafafa",
      }))
      .setOrigin(0.5);

    const capBg = scene.add
      .rectangle(capCx, cy, capColW, rowH, 0x27272a, 1)
      .setStrokeStyle(2, 0x52525b);

    const capBtnW = scaleUiX(28);
    const capBtnH = scaleUiY(30);
    const minusX = capCx - scaleUiX(24);
    const plusX = capCx + scaleUiX(24);
    const capMinus = createUiRoundedRect(
      scene,
      capBtnW,
      capBtnH,
      0x3f3f46,
      0x71717a,
    );
    capMinus.setPosition(minusX, cy);
    const capPlus = createUiRoundedRect(
      scene,
      capBtnW,
      capBtnH,
      0x3f3f46,
      0x71717a,
    );
    capPlus.setPosition(plusX, cy);
    /** UI seed from `player.json` only — defense spawns use `buildSelections()` caps. */
    const capDefault = store.player.endlessPanelDefaultConcurrent;
    caps.set(enemyId, capDefault);
    const capValue = scene.add
      .text(capCx, cy, `${capDefault}`, uiTextStyle(scene, {
        fontSize: `${scaleUiX(15)}px`,
        color: "#e4e4e7",
      }))
      .setOrigin(0.5);

    capMinus.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      pointer.event.stopPropagation();
      h.onBumpCap(enemyId, -1);
    });
    capPlus.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      pointer.event.stopPropagation();
      h.onBumpCap(enemyId, 1);
    });

    bg.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      pointer.event.stopPropagation();
      h.onRowPointerDown(pointer, enemyId);
    });
    capBg.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      pointer.event.stopPropagation();
      h.onCapPointerDown(pointer);
    });

    const row: EnemyRow = {
      enemyId,
      label,
      bg,
      text,
      check,
      capBg,
      capMinus,
      capPlus,
      capValue,
      capLocalY: localY,
    };
    bg.setInteractive(
      new Phaser.Geom.Rectangle(-nameColW / 2, -rowH / 2, nameColW, rowH),
      h.rowNameHitTest(row),
    );
    capBg.setInteractive(
      new Phaser.Geom.Rectangle(-capColW / 2, -rowH / 2, capColW, rowH),
      h.rowCapHitTest(row),
    );
    const capBtnHit = new Phaser.Geom.Rectangle(
      -capBtnW / 2,
      -capBtnH / 2,
      capBtnW,
      capBtnH,
    );
    capMinus.setInteractive(capBtnHit, h.rowCapHitTest(row));
    capPlus.setInteractive(capBtnHit, h.rowCapHitTest(row));
    rows.push(row);
    listContent.add([
      bg,
      check,
      text,
      capBg,
      capMinus,
      capValue,
      capPlus,
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

  listViewport.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
    h.onViewportPointerDown(pointer);
  });

  const infiniteHpRowY = listBottom + scaleUiY(12) + infiniteRowH / 2;
  const infiniteHpBg = createUiRoundedRect(
    scene,
    rowW,
    infiniteRowH,
    0x27272a,
    0x52525b,
  );
  const footerDepth = 502;
  infiniteHpBg
    .setPosition(GAME.width / 2, infiniteHpRowY)
    .setDepth(footerDepth)
    .setInteractive(
      new Phaser.Geom.Rectangle(
        -rowW / 2,
        -infiniteRowH / 2,
        rowW,
        infiniteRowH,
      ),
      Phaser.Geom.Rectangle.Contains,
    );
  infiniteHpBg.on("pointerup", () => h.onToggleInfiniteHp());
  const infiniteHpCheck = scene.add
    .text(
      listLeft + scaleUiX(14),
      infiniteHpRowY,
      "☐",
      uiTextStyle(scene, {
        fontSize: `${scaleUiX(18)}px`,
        color: "#a1a1aa",
      }),
    )
    .setOrigin(0.5)
    .setDepth(footerDepth + 1);
  const infiniteLabel = scene.add
    .text(
      listLeft + scaleUiX(36),
      infiniteHpRowY,
      "Infinite HP",
      uiTextStyle(scene, {
        fontSize: `${scaleUiX(15)}px`,
        color: "#fafafa",
      }),
    )
    .setOrigin(0, 0.5)
    .setDepth(footerDepth + 1);
  root.add([
    infiniteHpBg,
    infiniteHpCheck,
    infiniteLabel,
  ]);

  const crY =
    listBottom +
    scaleUiY(12) +
    infiniteRowH +
    gapAfterInfinite +
    crLineHalf;
  const challengeRatingText = scene.add
    .text(
      GAME.width / 2,
      crY,
      "Challenge rating: 0",
      uiTextStyle(scene, {
        fontSize: `${scaleUiX(14)}px`,
        color: "#fbbf24",
      }),
    )
    .setOrigin(0.5)
    .setDepth(footerDepth + 4);
  root.add(challengeRatingText);

  const startY = crY + crLineHalf + gapCrToStart + startBtnH / 2;
  const startBtn = createTouchButton(
    scene,
    GAME.width / 2,
    startY,
    "Start endless",
    () => h.onStartPressed(),
    {
      width: scaleUiX(200),
      height: startBtnH,
      depth: footerDepth + 2,
      fontSize: `${scaleUiX(16)}px`,
      fillColor: 0x1d4ed8,
      strokeColor: 0x93c5fd,
    },
  );
  const closeBtn = createTouchButton(
    scene,
    GAME.width / 2,
    startY + scaleUiY(56),
    "Close",
    () => h.onClosePressed(),
    {
      width: scaleUiX(120),
      height: closeBtnH,
      depth: footerDepth + 2,
      fontSize: `${scaleUiX(14)}px`,
      fillColor: 0x52525b,
      strokeColor: 0xa1a1aa,
    },
  );
  root.add([startBtn.container, closeBtn.container]);
  root.bringToTop(challengeRatingText);

  return {
    root,
    modalLease,
    listViewport,
    listContent,
    rows,
    layout: {
      listTop,
      listViewportH,
      contentHeight,
      rowH,
      rowStride,
      rowW,
      nameColW,
      capColW,
      listLeft,
      capColLeft,
      maxScroll,
    },
    scrollTrack,
    scrollThumb,
    maskGraphics,
    infiniteHpRowY,
    infiniteHpBg,
    infiniteHpCheck,
    challengeRatingY: crY,
    challengeRatingText,
    startButtonY: startY,
    startBtn,
    closeBtn,
  };
}
