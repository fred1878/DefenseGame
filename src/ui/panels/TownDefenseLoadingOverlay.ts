import type Phaser from "phaser";
import { PALETTE_CSS } from "../theme/uiPalette";
import { GAME } from "../../config";
import { scaleUiX, scaleUiY } from "../../config/uiScale";
import { INPUT_MODALITY } from "../../input/inputModality";
import { openModalPanel, type ModalPanel } from "../../input/modalBackdrop";
import { uiTextStyle } from "../layout/uiTextStyle";

const BOOT_BG = 0x0f1014;

/**
 * Full-screen gate while town → defense prefetch finishes (assets, JSON, lazy scene).
 */
export class TownDefenseLoadingOverlay {
  private readonly root: Phaser.GameObjects.Container;
  private readonly modal: ModalPanel;

  constructor(scene: Phaser.Scene) {
    const modal = openModalPanel(scene, {
      token: INPUT_MODALITY.townDefenseLoading,
      depth: 900,
      dimColor: BOOT_BG,
      dimAlpha: 1,
    });
    this.root = modal.root;
    this.modal = modal;

    const title = scene.add
      .text(
        GAME.width / 2,
        GAME.height / 2 - scaleUiY(24),
        "Preparing defense…",
        uiTextStyle(scene, {
          fontSize: `${scaleUiX(22)}px`,
          color: PALETTE_CSS.zinc100,
        }),
      )
      .setOrigin(0.5);
    this.root.add(title);

    const statusText = scene.add
      .text(
        GAME.width / 2,
        GAME.height / 2 + scaleUiY(28),
        "Loading…",
        uiTextStyle(scene, {
          fontSize: `${scaleUiX(16)}px`,
          color: PALETTE_CSS.zinc400,
        }),
      )
      .setOrigin(0.5);
    this.root.add(statusText);
  }

  destroy(): void {
    this.modal.close();
  }
}
