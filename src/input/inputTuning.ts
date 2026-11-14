import Phaser from "phaser";

/** Prefer topmost interactive; improves tap reliability on mobile web. */
export function configureSceneInput(scene: Phaser.Scene): void {
  scene.input.setTopOnly(true);
}