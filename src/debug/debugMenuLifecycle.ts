import { ensureDebugMenuScene } from "../core/lazyScenes";
import { INPUT_MODALITY, pushInputModality } from "../input/inputModality";

export const DEBUG_MENU_CLOSE = "debug-menu-close";
export const DEBUG_MENU_SCENE_KEY = "DebugMenu";

export type OpenDebugMenuOptions = {
  /** Runs after modality push, before host pause and DebugMenu launch. */
  beforeLaunch?: () => void;
};

function launchDebugMenuOnHost(
  host: Phaser.Scene,
  options?: OpenDebugMenuOptions,
): void {
  pushInputModality(host, INPUT_MODALITY.debugMenu);
  options?.beforeLaunch?.();
  pauseForDebugMenu(host);

  const debug = host.scene.get(DEBUG_MENU_SCENE_KEY);
  if (debug?.scene.isActive()) {
    host.scene.stop(DEBUG_MENU_SCENE_KEY);
  }
  host.scene.launch(DEBUG_MENU_SCENE_KEY);
  host.scene.bringToTop(DEBUG_MENU_SCENE_KEY);
}

/** Open DebugMenu above the host scene (Town or Defense). */
export function openDebugMenuFromHost(
  host: Phaser.Scene,
  options?: OpenDebugMenuOptions,
): void {
  void ensureDebugMenuScene(host.game).then(() =>
    launchDebugMenuOnHost(host, options),
  );
}

/** Same as {@link openDebugMenuFromHost} when DebugMenu is already registered. */
export function launchDebugMenuFromHost(
  host: Phaser.Scene,
  options?: OpenDebugMenuOptions,
): void {
  launchDebugMenuOnHost(host, options);
}

/** Debug overlay was opened from a paused Defense night (not Town). */
export function isDefenseDebugHost(scene: Phaser.Scene): boolean {
  const defense = scene.scene.get("Defense");
  return defense?.scene.isPaused("Defense") === true;
}

/** Freeze the host scene (combat, timers, AI) while the debug overlay is open. */
export function pauseForDebugMenu(scene: Phaser.Scene): void {
  const key = scene.scene.key;
  if (!scene.scene.isPaused(key)) {
    scene.scene.pause(key);
  }
}

export function resumeFromDebugMenu(scene: Phaser.Scene): void {
  const key = scene.scene.key;
  if (scene.scene.isPaused(key)) {
    scene.scene.resume(key);
  }
}
