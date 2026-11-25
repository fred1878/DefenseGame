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