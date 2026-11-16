import Phaser from "phaser";
import { GAME } from "../config/game";
import { DEFENSE_FIELD_PX, defenseHalfWidth } from "../config/defense";

/**
 * Portrait defense: camera smoothly follows the player so they stay near screen center.
 * HUD uses screen-space layout and is unaffected.
 */
export function configureDefenseFollowCamera(
  camera: Phaser.Cameras.Scene2D.Camera,
  follow: Phaser.GameObjects.GameObject,
): void {
  const fieldW = DEFENSE_FIELD_PX.width;

  camera.setZoom(1);
  camera.startFollow(follow, true, 0.14, 0.14);
  camera.setDeadzone(0, 0);

  if (fieldW <= GAME.width) {
    const halfW = defenseHalfWidth();
    const padX = (GAME.width - fieldW) / 2;
    camera.setScroll(-halfW - padX, camera.scrollY);
  }
}