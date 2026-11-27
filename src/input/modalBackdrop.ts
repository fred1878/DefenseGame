import { GAME } from "../config/game";
import type Phaser from "phaser";
import type { InputModalityToken } from "./inputModality";
import { popInputModality, pushInputModality } from "./inputModality";

export type ModalInputLease = {
  readonly token: InputModalityToken;
  release: () => void;
};

/** Push a modal token and return a lease; call `release` when the overlay closes. */
export function acquireModalInput(
  scene: Phaser.Scene,
  token: InputModalityToken,
): ModalInputLease {
  pushInputModality(scene, token);
  let released = false;
  return {
    token,
    release: () => {
      if (released) return;
      released = true;
      popInputModality(scene, token.id);
    },
  };
}

/**
 * Full-screen dim behind modal UI. Visual only — {@link acquireModalInput} plus the
 * host scene's base-layer disable blocks town/defense chrome. An interactive dim with
 * `stopPropagation` prevented child buttons and list viewports from receiving taps.
 */
export function bindModalDimBackdrop(_dim: Phaser.GameObjects.Rectangle): void {
  /* visual dim only */
}

export type ModalPanelOptions = {
  token: InputModalityToken;
  /** Container depth (default 500). */
  depth?: number;
  /** Full-screen dim colour and alpha (default black at 0.72). */
  dimColor?: number;
  dimAlpha?: number;
};

export type ModalPanel = {
  root: Phaser.GameObjects.Container;
  dim: Phaser.GameObjects.Rectangle;
  lease: ModalInputLease;
  /** Release the modal input lease and destroy the root container (idempotent). */
  close: () => void;
};

/**
 * Standard modal shell: screen-fixed root container, full-screen dim as its first
 * child, and a modal input lease. Panels build their content into `root`.
 */
export function openModalPanel(
  scene: Phaser.Scene,
  opts: ModalPanelOptions,
): ModalPanel {
  const lease = acquireModalInput(scene, opts.token);
  const root = scene.add
    .container(0, 0)
    .setDepth(opts.depth ?? 500)
    .setScrollFactor(0);
  const { width, height } = GAME;
  const dim = scene.add.rectangle(
    width / 2,
    height / 2,
    width,
    height,
    opts.dimColor ?? 0x000000,
    opts.dimAlpha ?? 0.72,
  );
  bindModalDimBackdrop(dim);
  root.add(dim);
  let closed = false;
  return {
    root,
    dim,
    lease,
    close: () => {
      if (closed) return;
      closed = true;
      lease.release();
      if (root.active) root.destroy();
    },
  };
}
