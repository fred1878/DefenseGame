import type Phaser from "phaser";
import { GAME } from "../config";
import { scaleUiX, scaleUiY } from "../config/uiScale";
import { INPUT_MODALITY } from "../input/inputModality";
import {
  acquireModalInput,
  bindModalDimBackdrop,
  type ModalInputLease,
} from "../input/modalBackdrop";
import { uiTextStyle } from "./uiTextStyle";

const BOOT_BG = 0x0f1014;

/**
 * Full-screen gate while town → defense prefetch finishes (assets, JSON, lazy scene).
 */
export class TownDefenseLoadingOverlay {
  private readonly root: Phaser.GameObjects.Container;
  private readonly modalLease: ModalInputLease;
  private readonly statusText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.modalLease = acquireModalInput(
      scene,
      INPUT_MODALITY.townDefenseLoading,
    );
    this.root = scene.add.container(0, 0).setDepth(900).setScrollFactor(0);

    const bg = scene.add.rectangle(
      GAME.width / 2,
      GAME.height / 2,
      GAME.width,
      GAME.height,
      BOOT_BG,
      1,
    );
    bindModalDimBackdrop(bg);
    this.root.add(bg);

    const title = scene.add
      .text(
        GAME.width / 2,
        GAME.height / 2 - scaleUiY(24),
        "Preparing defense…",
        uiTextStyle(scene, {
          fontSize: `${scaleUiX(22)}px`,
          color: "#f4f4f5",
        }),
      )
      .setOrigin(0.5);
    this.root.add(title);

    this.statusText = scene.add
      .text(
        GAME.width / 2,
        GAME.height / 2 + scaleUiY(28),
        "Loading…",
        uiTextStyle(scene, {
          fontSize: `${scaleUiX(16)}px`,
          color: "#a1a1aa",
        }),
      )
      .setOrigin(0.5);
    this.root.add(this.statusText);
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
