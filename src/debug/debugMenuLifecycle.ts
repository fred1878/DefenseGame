export const DEBUG_MENU_CLOSE = "debug-menu-close";

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