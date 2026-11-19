export const DEBUG_MENU_CLOSE = "debug-menu-close";

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