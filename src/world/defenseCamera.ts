import Phaser from "phaser";
import { DEFENSE_FIELD_PX, defenseHalfWidth } from "../config/defense";
import type { DefensePlayArea } from "../ui/screenLayout";

type ScrollFactorObj = Phaser.GameObjects.GameObject & {
  scrollFactorX?: number;
  scrollFactorY?: number;
};

function isScreenFixed(go: Phaser.GameObjects.GameObject): boolean {
  const s = go as ScrollFactorObj;
  return (s.scrollFactorX ?? 1) === 0 && (s.scrollFactorY ?? 1) === 0;
}

function applyCameraLayer(
  worldCam: Phaser.Cameras.Scene2D.Camera,
  uiCam: Phaser.Cameras.Scene2D.Camera,
  go: Phaser.GameObjects.GameObject,
): void {
  const fixed = isScreenFixed(go);
  if (fixed) {
    worldCam.ignore(go);
  } else {
    uiCam.ignore(go);
  }
}

function walkCameraLayers(
  worldCam: Phaser.Cameras.Scene2D.Camera,
  uiCam: Phaser.Cameras.Scene2D.Camera,
  go: Phaser.GameObjects.GameObject,
): void {
  applyCameraLayer(worldCam, uiCam, go);
  const list = (go as Phaser.GameObjects.Container).list;
  if (!list?.length) return;
  for (const child of list) {
    if (child instanceof Phaser.GameObjects.GameObject) {
      walkCameraLayers(worldCam, uiCam, child);
    }
  }
}

/**
 * World camera uses a reduced viewport; a full-screen UI camera receives HUD input.
 */
export function wireDefenseDualCameras(
  scene: Phaser.Scene,
): Phaser.Cameras.Scene2D.Camera {
  const worldCam = scene.cameras.main;
  const uiCam = scene.cameras.add(
    0,
    0,
    scene.scale.width,
    scene.scale.height,
    false,
    "defenseUi",
  );
  uiCam.setScroll(0, 0);
  uiCam.setZoom(1);

  for (const child of scene.children.list) {
    if (child instanceof Phaser.GameObjects.GameObject) {
      walkCameraLayers(worldCam, uiCam, child);
    }
  }
  return uiCam;
}

/** Call for world objects created after {@link wireDefenseDualCameras}. */
export function markDefenseWorldObject(
  uiCam: Phaser.Cameras.Scene2D.Camera,
  go: Phaser.GameObjects.GameObject,
): void {
  const worldCam = uiCam.scene.cameras.main;
  uiCam.ignore(go);
  walkCameraLayers(worldCam, uiCam, go);
}

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
  camera.setBackgroundColor(0x0c0c0e);
  camera.startFollow(follow, true, 0.14, 0.14);
  camera.setDeadzone(0, 0);

  if (fieldW <= playArea.width) {
    const halfW = defenseHalfWidth();
    const padX = (playArea.width - fieldW) / 2;
    camera.setScroll(-halfW - padX, camera.scrollY);
  }
}