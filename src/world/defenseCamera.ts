import Phaser from "phaser";
import { GAME } from "../config/game";
import { DEFENSE_FIELD_PX, defenseHalfWidth } from "../config/defense";

/**
 * Portrait defense: world scrolls when the player leaves the camera deadzone.
 * HUD uses screen-space layout and is unaffected.
 */
export function configureDefenseFollowCamera(
  camera: Phaser.Cameras.Scene2D.Camera,
  follow: Phaser.GameObjects.GameObject,
): void {
  const fieldW = DEFENSE_FIELD_PX.width;
  const deadW = Math.min(fieldW, Math.round(GAME.width * 0.88));
  const deadH = Math.round(GAME.height * 0.42);

  camera.setZoom(1);
  camera.startFollow(follow, true, 0.14, 0.14);
  camera.setDeadzone(deadW, deadH);

  if (fieldW <= GAME.width) {
    const halfW = defenseHalfWidth();
    const padX = (GAME.width - fieldW) / 2;
    camera.setScroll(-halfW - padX, camera.scrollY);
  }
}