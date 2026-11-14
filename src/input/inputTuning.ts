import Phaser from "phaser";

/** Mobile Phaser input defaults — topOnly off so container buttons reliably receive hits. */
export function configureSceneInput(scene: Phaser.Scene): void {
  scene.input.setTopOnly(false);
  scene.input.mouse?.disableContextMenu();
}