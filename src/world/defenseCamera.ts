import Phaser from "phaser";
import { DEFENSE_FIELD_PX, defenseHalfWidth } from "../config/defense";
import type { DefensePlayArea } from "../ui/screenLayout";

/** Screen-fixed mask: world sprites draw only in the middle play band. */
export function createDefenseWorldDisplayMask(
  scene: Phaser.Scene,
  playArea: DefensePlayArea,
): {
  mask: Phaser.Display.Masks.GeometryMask;
  maskShape: Phaser.GameObjects.Graphics;
} {
  const g = scene.add.graphics();
  g.fillStyle(0xffffff, 1);
  g.fillRect(playArea.x, playArea.y, playArea.width, playArea.height);
  g.setScrollFactor(0);
  g.setVisible(false);
  g.setDepth(-1000);
  return { mask: g.createGeometryMask(), maskShape: g };
}

/**
 * Portrait defense: follow player on full canvas; world is clipped with a play-area mask.
 */
export function configureDefenseFollowCamera(
  camera: Phaser.Cameras.Scene2D.Camera,
  follow: Phaser.GameObjects.GameObject,
  playArea: DefensePlayArea,
): void {
  const fieldW = DEFENSE_FIELD_PX.width;

  camera.setZoom(1);
  camera.setBackgroundColor(0x0c0c0e);
  camera.startFollow(follow, true, 0.14, 0.14);
  camera.setDeadzone(0, 0);

  if (fieldW <= playArea.width) {
    const halfW = defenseHalfWidth();
    const padX = (playArea.width - fieldW) / 2;
    camera.setScroll(-halfW - padX, camera.scrollY);
  }
}