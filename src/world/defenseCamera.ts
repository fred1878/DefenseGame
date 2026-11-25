import type Phaser from "phaser";
import {
  DEFENSE_FIELD_PX,
  defenseFieldPx,
  defenseHalfWidth,
} from "../config/defense";
import type { DefensePlayArea } from "../ui/screenLayout";
import { snapCameraLikePhaser3 } from "../core/phaser3PixelParity";
import {
  adoptDefenseWorldObject,
  isInDefenseWorldLayer,
} from "./defenseWorldLayer";

export const DEFENSE_UI_CAMERA_NAME = "defenseUi";

export type DefenseCameraRig = {
  worldCamera: Phaser.Cameras.Scene2D.Camera;
  uiCamera: Phaser.Cameras.Scene2D.Camera;
  /** Scene-graph root for combat field coordinates; excluded from the UI camera once. */
  worldLayer: Phaser.GameObjects.Layer;
  registerUi: (go: Phaser.GameObjects.GameObject) => void;
  /** Reparent legacy/pre-hook objects into {@link worldLayer}. */
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
 * Play-area viewport on the main camera; full-canvas UI camera for HUD-only roots.
 * Combat art lives under `worldLayer` so the UI camera does not paint world coordinates
 * as screen coordinates (in-band ghost duplicates inside the play band).
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

  const worldLayer = scene.add.layer();

  worldCamera.setViewport(
    playArea.x,
    playArea.y,
    playArea.width,
    playArea.height,
  );
  worldCamera.setBackgroundColor(0x0c0c0e);
  // Odd-height play area + follow lerp: keep Phaser 3's whole-pixel world view.
  snapCameraLikePhaser3(worldCamera);

  configureDefenseFollowCamera(worldCamera, follow, playArea, scene.registry);

  uiCamera.ignore(worldLayer);

  const registerUi = (go: Phaser.GameObjects.GameObject): void => {
    if (isInDefenseWorldLayer(go, worldLayer)) {
      worldLayer.remove(go);
    }
    worldCamera.ignore(go);
  };
  const registerWorld = (go: Phaser.GameObjects.GameObject): void => {
    adoptDefenseWorldObject(go, worldLayer);
  };

  return { worldCamera, uiCamera, worldLayer, registerUi, registerWorld };
}

/**
 * Portrait defense: follow player; render target is the play-area viewport.
 */
export function configureDefenseFollowCamera(
  camera: Phaser.Cameras.Scene2D.Camera,
  follow: Phaser.GameObjects.GameObject,
  playArea: DefensePlayArea,
  registry?: Phaser.Data.DataManager,
): void {
  const fieldW = registry
    ? defenseFieldPx(registry).width
    : DEFENSE_FIELD_PX.width;

  const fitsHorizontally = fieldW <= playArea.width;

  camera.setZoom(1);
  camera.setBackgroundColor(0x0c0c0e);
  /** Portrait: follow on Y only when the full field fits the play-area width (no horizontal pan). */
  camera.startFollow(follow, true, fitsHorizontally ? 0 : 0.14, 0.14);
  camera.setDeadzone(fitsHorizontally ? playArea.width + 1 : 0, 0);

  if (fitsHorizontally) {
    const halfW = defenseHalfWidth(registry);
    const padX = (playArea.width - fieldW) / 2;
    camera.setScroll(-halfW - padX, camera.scrollY);
  }
}
