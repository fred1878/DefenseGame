import Phaser from "phaser";
import { GAME } from "../config/game";
import { DEFENSE_FIELD_PX, defenseHalfWidth } from "../config/defense";

/**
 * Portrait defense: narrow field fits horizontally; world scrolls vertically with the player.
 * HUD uses screen-space layout and is unaffected.
 */
export function configureDefenseFollowCamera(
  camera: Phaser.Cameras.Scene2D.Camera,
  follow: Phaser.GameObjects.GameObject,
): void {
  const halfW = defenseHalfWidth();
  const fieldW = DEFENSE_FIELD_PX.width;
  const padX = Math.max(0, (GAME.width - fieldW) / 2);

  camera.setZoom(1);
  camera.startFollow(follow, true, 0, 0.14);
  camera.setDeadzone(fieldW, Math.round(GAME.height * 0.42));
  camera.setScroll(-halfW - padX, camera.scrollY);
}