import Phaser from "phaser";
import { DEFENSE_FIELD_PX, defenseHalfWidth } from "../config/defense";
import type { DefensePlayArea } from "../ui/screenLayout";

/**
 * Portrait defense: camera follows the player inside the play-area viewport only.
 * HUD bands above/below stay screen-fixed (scrollFactor 0).
 */
export function configureDefenseFollowCamera(
  camera: Phaser.Cameras.Scene2D.Camera,
  follow: Phaser.GameObjects.GameObject,
  playArea: DefensePlayArea,
): void {
  const fieldW = DEFENSE_FIELD_PX.width;

  camera.setZoom(1);
  camera.setViewport(
    Math.round(playArea.x),
    Math.round(playArea.y),
    Math.round(playArea.width),
    Math.round(playArea.height),
  );
  camera.startFollow(follow, true, 0.14, 0.14);
  camera.setDeadzone(0, 0);

  if (fieldW <= playArea.width) {
    const halfW = defenseHalfWidth();
    const padX = (playArea.width - fieldW) / 2;
    camera.setScroll(-halfW - padX, camera.scrollY);
  }
}