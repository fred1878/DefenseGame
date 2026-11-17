import Phaser from "phaser";
import { DEFENSE_FIELD_PX, defenseHalfWidth } from "../config/defense";
import type { DefensePlayArea } from "../ui/screenLayout";

export const DEFENSE_UI_CAMERA_NAME = "defenseUi";

export type DefenseCameraRig = {
  worldCamera: Phaser.Cameras.Scene2D.Camera;
  uiCamera: Phaser.Cameras.Scene2D.Camera;
  registerUi: (go: Phaser.GameObjects.GameObject) => void;
  registerWorld: (go: Phaser.GameObjects.GameObject) => void;
};

/** World-space point → canvas coordinates (accounts for play-area viewport). */
export function defenseWorldToScreen(
  camera: Phaser.Cameras.Scene2D.Camera,
  worldX: number,
  worldY: number,
): { x: number; y: number } {
  return {
    x: (worldX - camera.scrollX) * camera.zoom + camera.x,
    y: (worldY - camera.scrollY) * camera.zoom + camera.y,
  };
}

/**
 * Play-area viewport on the main camera; full-canvas UI camera.
 * World draws only in the middle band — no per-sprite geometry mask.
 */
export function setupDefenseCameraRig(
  scene: Phaser.Scene,
  follow: Phaser.GameObjects.GameObject,
  playArea: DefensePlayArea,
): DefenseCameraRig {
  const worldCamera = scene.cameras.main;
  const uiCamera = scene.cameras.add(
    0,
    0,
    scene.scale.width,
    scene.scale.height,
  );
  uiCamera.setName(DEFENSE_UI_CAMERA_NAME);
  uiCamera.setScroll(0, 0);
  uiCamera.setZoom(1);

  worldCamera.setViewport(
    playArea.x,
    playArea.y,
    playArea.width,
    playArea.height,
  );
  worldCamera.setBackgroundColor(0x0c0c0e);

  configureDefenseFollowCamera(worldCamera, follow, playArea);

  const registerUi = (go: Phaser.GameObjects.GameObject): void => {
    worldCamera.ignore(go);
  };
  const registerWorld = (go: Phaser.GameObjects.GameObject): void => {
    uiCamera.ignore(go);
  };

  return { worldCamera, uiCamera, registerUi, registerWorld };
}

/**
 * Portrait defense: follow player; render target is the play-area viewport.
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