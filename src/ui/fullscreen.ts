import type Phaser from "phaser";

/**
 * Fullscreen must be entered from a user gesture (use pointerup on buttons — not autoplay).
 * iOS Safari often lacks Fullscreen API for arbitrary elements; Phaser emits FULLSCREEN_UNSUPPORTED.
 */
export function fullscreenAvailable(scale: Phaser.Scale.ScaleManager): boolean {
  return scale.fullscreen.available;
}

export function fullscreenButtonLabel(scale: Phaser.Scale.ScaleManager): string {
  if (!fullscreenAvailable(scale)) return "Fullscreen: N/A (iOS)";
  return scale.isFullscreen ? "Exit fullscreen" : "Fullscreen";
}

export function toggleFullscreen(scale: Phaser.Scale.ScaleManager): void {
  if (!fullscreenAvailable(scale)) return;
  if (scale.isFullscreen) scale.stopFullscreen();
  else scale.startFullscreen();
}