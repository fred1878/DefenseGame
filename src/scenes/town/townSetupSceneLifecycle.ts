import type Phaser from "phaser";
import {
  ensureEndlessModeSetupScene,
  ensureWavePlannerSetupScene,
} from "../loading/lazyScenes";
import type { WaveGroup } from "../../core/DataStore";
import type { EndlessRunSelection } from "../../core/defenseRunMode";

export const TOWN_ENDLESS_SETUP_SCENE_KEY = "TownEndlessSetup";
export const TOWN_WAVE_PLANNER_SETUP_SCENE_KEY = "TownWavePlannerSetup";

export type EndlessModeSetupLaunchData = {
  onStart: (selections: EndlessRunSelection[], infiniteHp: boolean) => void;
};

export type WavePlannerSetupLaunchData = {
  onStart: (groups: WaveGroup[]) => void;
};

/** Freeze Town chrome so its interactives stay out of the input stack. */
export function pauseTownForSetup(town: Phaser.Scene): void {
  const key = town.scene.key;
  const paused = town.scene.isPaused?.(key) === true;
  if (!paused) {
    town.scene.pause(key);
  }
}

export function resumeTownFromSetup(town: Phaser.Scene): void {
  const key = town.scene.key;
  if (town.scene.isPaused?.(key) === true) {
    town.scene.resume(key);
  }
}

function launchSetupScene(
  host: Phaser.Scene,
  setupKey: string,
  data: object,
): void {
  pauseTownForSetup(host);
  const existing = host.scene.get(setupKey);
  if (existing?.scene.isActive()) {
    host.scene.stop(setupKey);
  }
  host.scene.launch(setupKey, data);
  host.scene.bringToTop(setupKey);
}

export function openEndlessModeSetupScene(
  host: Phaser.Scene,
  data: EndlessModeSetupLaunchData,
): void {
  void ensureEndlessModeSetupScene(host.game).then(() =>
    launchSetupScene(host, TOWN_ENDLESS_SETUP_SCENE_KEY, data),
  );
}

export function openWavePlannerSetupScene(
  host: Phaser.Scene,
  data: WavePlannerSetupLaunchData,
): void {
  void ensureWavePlannerSetupScene(host.game).then(() =>
    launchSetupScene(host, TOWN_WAVE_PLANNER_SETUP_SCENE_KEY, data),
  );
}

export function isEndlessModeSetupActive(game: Phaser.Game): boolean {
  return (
    game.scene.getScene(TOWN_ENDLESS_SETUP_SCENE_KEY)?.scene.isActive() === true
  );
}

export function isWavePlannerSetupActive(game: Phaser.Game): boolean {
  return (
    game.scene.getScene(TOWN_WAVE_PLANNER_SETUP_SCENE_KEY)?.scene.isActive() ===
    true
  );
}

export function isAnyTownSetupSceneActive(game: Phaser.Game): boolean {
  return isEndlessModeSetupActive(game) || isWavePlannerSetupActive(game);
}

/** Stop setup overlays before campaign defense or when abandoning roster UI. */
export function dismissTownSetupScenes(game: Phaser.Game): void {
  for (const key of [
    TOWN_ENDLESS_SETUP_SCENE_KEY,
    TOWN_WAVE_PLANNER_SETUP_SCENE_KEY,
  ]) {
    const scene = game.scene.getScene(key);
    if (scene?.scene.isActive()) {
      game.scene.stop(key);
    }
  }
  const town = game.scene.getScene("Town");
  if (town) {
    resumeTownFromSetup(town);
  }
}

/** Tear down a setup scene and return Town to the interactive stack. */
export function closeTownSetupScene(
  setup: Phaser.Scene,
  afterTownResume?: () => void,
): void {
  const town = setup.scene.get("Town");
  const key = setup.scene.key;
  setup.scene.stop(key);
  if (town) {
    resumeTownFromSetup(town);
  }
  afterTownResume?.();
}
