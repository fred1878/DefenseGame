import type Phaser from "phaser";
import { GAME } from "../config";
import { scaleUiX, scaleUiY } from "../core/displayScale";
import { INPUT_MODALITY } from "../input/inputModality";
import {
  acquireModalInput,
  bindModalDimBackdrop,
  type ModalInputLease,
} from "../input/modalBackdrop";
import { createTouchButton, interactiveObjectScreenRect } from "./touchButton";
import { uiTextStyle } from "./uiTextStyle";

/** Placeholder roster rows shown while endless panel data is still loading. */
export const ENDLESS_PANEL_LOADING_SKELETON_ROWS = 5;

/**
 * Dim overlay + roster skeleton while town → endless prefetch finishes.
 */
export class EndlessModePanelLoadingSkeleton {
  private readonly root: Phaser.GameObjects.Container;
  private readonly modalLease: ModalInputLease;
  private readonly statusText: Phaser.GameObjects.Text;
  private readonly closeBtn: ReturnType<typeof createTouchButton>;
  private readonly onDismiss: (() => void) | undefined;

  constructor(scene: Phaser.Scene, onDismiss?: () => void) {
    this.onDismiss = onDismiss;
    this.modalLease = acquireModalInput(scene, INPUT_MODALITY.townEndless);
    this.root = scene.add.container(0, 0).setDepth(500).setScrollFactor(0);

    const dim = scene.add.rectangle(
      GAME.width / 2,
      GAME.height / 2,
      GAME.width,
      GAME.height,
      0x000000,
      0.72,
    );
    bindModalDimBackdrop(dim);
    this.root.add(dim);

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
    this.root.add(title);

    const rowW = GAME.width - scaleUiX(48);
    const capColW = scaleUiX(96);
    const nameColW = rowW - capColW - scaleUiX(4);
    const listLeft = (GAME.width - rowW) / 2;
    const capColLeft = listLeft + nameColW + scaleUiX(4);
    const rowH = scaleUiY(44);
    const gap = scaleUiY(8);
    const rowStride = rowH + gap;
    const listTop = scaleUiY(148);

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
    const listBottom = GAME.height - footerBlockH;
    const crY =
      listBottom + scaleUiY(12) + infiniteRowH + gapAfterInfinite + crLineHalf;
    const startY = crY + crLineHalf + gapCrToStart + startBtnH / 2;
    const closeY = startY + scaleUiY(56);

    const hintSk = scene.add.rectangle(
      GAME.width / 2,
      scaleUiY(118),
      rowW,
      scaleUiY(14),
      0x3f3f46,
      0.85,
    );
    this.root.add(hintSk);

    for (let i = 0; i < ENDLESS_PANEL_LOADING_SKELETON_ROWS; i++) {
      const cy = listTop + i * rowStride + rowH / 2;
      const nameCx = listLeft + nameColW / 2;
      const capCx = capColLeft + capColW / 2;

      const nameSk = scene.add
        .rectangle(nameCx, cy, nameColW, rowH, 0x3f3f46, 0.9)
        .setStrokeStyle(2, 0x52525b);
      const capSk = scene.add
        .rectangle(capCx, cy, capColW, rowH, 0x27272a, 0.9)
        .setStrokeStyle(2, 0x52525b);
      this.root.add(nameSk);
      this.root.add(capSk);
    }

    const footerY =
      listTop + ENDLESS_PANEL_LOADING_SKELETON_ROWS * rowStride + scaleUiY(24);
    const footerSk = scene.add.rectangle(
      GAME.width / 2,
      footerY,
      rowW,
      scaleUiY(120),
      0x27272a,
      0.7,
    );
    this.root.add(footerSk);

    this.statusText = scene.add
      .text(
        GAME.width / 2,
        footerY + scaleUiY(72),
        "Loading roster…",
        uiTextStyle(scene, {
          fontSize: `${scaleUiX(14)}px`,
          color: "#a1a1aa",
        }),
      )
      .setOrigin(0.5);
    this.root.add(this.statusText);

    this.closeBtn = createTouchButton(
      scene,
      GAME.width / 2,
      closeY,
      "Close",
      () => this.dismiss(),
      {
        width: scaleUiX(120),
        height: closeBtnH,
        depth: 2,
        fontSize: `${scaleUiX(14)}px`,
        fillColor: 0x52525b,
        strokeColor: 0xa1a1aa,
      },
    );
    this.root.add(this.closeBtn.container);
  }

  e2eTapTargets(): Record<string, { x: number; y: number }> {
    const r = interactiveObjectScreenRect(this.closeBtn.container);
    if (!r) return {};
    return {
      "endless-close": {
        x: r.x + r.width / 2,
        y: r.y + r.height / 2,
      },
    };
  }

  private dismiss(): void {
    this.onDismiss?.();
    this.destroy();
  }

  showError(message: string): void {
    this.statusText.setText(message);
    this.statusText.setColor("#f87171");
  }

  destroy(): void {
    this.modalLease.release();
    this.root.destroy();
  }
}
