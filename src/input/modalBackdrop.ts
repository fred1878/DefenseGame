import Phaser from "phaser";
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
 * Full-screen dim that captures pointer hits (with topOnly off, still pair with base-layer disable).
 */
export function bindModalDimBackdrop(dim: Phaser.GameObjects.Rectangle): void {
  dim.setInteractive();
  dim.on(
    "pointerdown",
    (
      _pointer: Phaser.Input.Pointer,
      _x: number,
      _y: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation();
    },
  );
}