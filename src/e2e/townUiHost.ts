import type Phaser from "phaser";
import type { EndlessModeSetupScene } from "../scenes/EndlessModeSetupScene";
import type { TownScene } from "../scenes/TownScene";
import type { WavePlannerSetupScene } from "../scenes/WavePlannerSetupScene";
import {
  isAnyTownSetupSceneActive,
  TOWN_ENDLESS_SETUP_SCENE_KEY,
  TOWN_WAVE_PLANNER_SETUP_SCENE_KEY,
} from "../scenes/town/townSetupSceneLifecycle";

export type TownUiE2EHost =
  | TownScene
  | EndlessModeSetupScene
  | WavePlannerSetupScene;

/** Active Town or a Town setup scene that owns roster / planner UI for e2e. */
export function activeTownUiHost(game: Phaser.Game): TownUiE2EHost | null {
  const endless = game.scene.getScene(
    TOWN_ENDLESS_SETUP_SCENE_KEY,
  ) as EndlessModeSetupScene | null;
  if (endless?.scene.isActive()) return endless;

  const wave = game.scene.getScene(
    TOWN_WAVE_PLANNER_SETUP_SCENE_KEY,
  ) as WavePlannerSetupScene | null;
  if (wave?.scene.isActive()) return wave;

  const town = game.scene.getScene("Town") as TownScene | null;
  const townPaused = town?.scene.isPaused?.() === true;
  if (town && (town.scene.isActive() || townPaused)) return town;
  return null;
}

export function e2eReportsTownScene(game: Phaser.Game): boolean {
  const town = game.scene.getScene("Town") as TownScene | null;
  if (town?.scene.isActive() || town?.scene.isPaused?.() === true) return true;
  return isAnyTownSetupSceneActive(game);
}

/** The Endless setup scene when it is the active Town UI host (roster e2e hooks). */
export function activeEndlessSetupScene(
  game: Phaser.Game,
): EndlessModeSetupScene | null {
  const host = activeTownUiHost(game);
  return host?.scene.key === TOWN_ENDLESS_SETUP_SCENE_KEY
    ? (host as EndlessModeSetupScene)
    : null;
}
