import type Phaser from "phaser";
import { GAME } from "../../config";
import { scaleUiX, scaleUiY } from "../../config/uiScale";
import { INPUT_MODALITY } from "../../input/inputModality";
import { openModalPanel, type ModalPanel } from "../../input/modalBackdrop";
import { uiTextStyle } from "../layout/uiTextStyle";
import { PALETTE, PALETTE_CSS } from "../theme/uiPalette";
import {
  createTouchButton,
  type TouchButtonHandle,
} from "../touch/touchButton";

export type FatalErrorOptions = {
  /** Short headline, e.g. "Could not load defense". */
  title: string;
  /** One-line hint under the title. */
  message?: string;
  /** Logged with the title (kept for bug reports). */
  error?: unknown;
  /** Retry the failed step; the panel closes first. */
  onRetry: () => void;
  /** Optional second button (closes the panel, then runs this). */
  onClose?: () => void;
  closeLabel?: string;
};

/** Above every other overlay, including the loading gates (900). */
const FATAL_ERROR_DEPTH = 950;

/**
 * Blocking error panel with Retry (and optionally Close). Use for load and
 * readiness failures the player can recover from by trying again.
 */
export class FatalErrorPanel {
  private readonly modal: ModalPanel;
  private readonly buttons: TouchButtonHandle[] = [];
  private closed = false;

  constructor(scene: Phaser.Scene, opts: FatalErrorOptions) {
    this.modal = openModalPanel(scene, {
      token: INPUT_MODALITY.fatalError,
      depth: FATAL_ERROR_DEPTH,
      dimColor: PALETTE.zinc950,
      dimAlpha: 0.92,
    });
    this.modal.root.setData("testid", "fatal-error");
    const cx = GAME.width / 2;
    const cy = GAME.height / 2;
    this.modal.root.add(
      scene.add
        .text(
          cx,
          cy - scaleUiY(70),
          opts.title,
          uiTextStyle(scene, {
            fontSize: `${scaleUiX(22)}px`,
            color: PALETTE_CSS.red400,
            align: "center",
            wordWrap: { width: GAME.width - scaleUiX(60) },
          }),
        )
        .setOrigin(0.5),
    );
    if (opts.message) {
      this.modal.root.add(
        scene.add
          .text(
            cx,
            cy - scaleUiY(30),
            opts.message,
            uiTextStyle(scene, {
              fontSize: `${scaleUiX(15)}px`,
              color: PALETTE_CSS.zinc400,
              align: "center",
              wordWrap: { width: GAME.width - scaleUiX(60) },
            }),
          )
          .setOrigin(0.5),
      );
    }

    const btn = {
      width: scaleUiX(200),
      height: scaleUiY(52),
      depth: FATAL_ERROR_DEPTH + 1,
    };
    const retry = createTouchButton(
      scene,
      cx,
      cy + scaleUiY(40),
      "Retry",
      () => this.finish(opts.onRetry),
      {
        ...btn,
        fontSize: `${scaleUiX(18)}px`,
        fillColor: PALETTE.green700,
        strokeColor: PALETTE.green400,
      },
    );
    retry.container.setData("testid", "fatal-error-retry");
    this.buttons.push(retry);
    const onClose = opts.onClose;
    if (onClose) {
      const close = createTouchButton(
        scene,
        cx,
        cy + scaleUiY(110),
        opts.closeLabel ?? "Close",
        () => this.finish(onClose),
        {
          ...btn,
          fontSize: `${scaleUiX(16)}px`,
          fillColor: PALETTE.zinc700,
          strokeColor: PALETTE.zinc400,
        },
      );
      close.container.setData("testid", "fatal-error-close");
      this.buttons.push(close);
    }
    scene.events.once("shutdown", () => this.destroy());
  }

  get isOpen(): boolean {
    return !this.closed;
  }

  private finish(then: () => void): void {
    if (this.closed) return;
    this.destroy();
    then();
  }

  destroy(): void {
    if (this.closed) return;
    this.closed = true;
    for (const b of this.buttons) {
      if (b.container.active !== false) b.container.destroy();
    }
    this.modal.close();
  }
}

/** Log a recoverable load failure and show the Retry panel. */
export function reportFatal(
  scene: Phaser.Scene,
  opts: FatalErrorOptions,
): FatalErrorPanel {
  console.error(opts.title, opts.error);
  return new FatalErrorPanel(scene, opts);
}
