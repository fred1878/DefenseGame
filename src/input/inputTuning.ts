import type Phaser from "phaser";

/** Mobile Phaser input defaults — topOnly off so container buttons reliably receive hits. */
export function configureSceneInput(scene: Phaser.Scene): void {
  scene.input.setTopOnly(false);
  scene.input.mouse?.disableContextMenu();
}

/**
 * Pixels of finger travel before the virtual stick claims the gesture (scaled in combat chrome).
 * Kept above typical button tap jitter so ATK/spell taps stay crisp.
 */
export const VIRTUAL_STICK_DRAG_THRESHOLD_PX = 24;

/**
 * After a stick drag ends, suppress tap-to-focus for this long (ms). Short so the next tap lands fast.
 */
export const STICK_POST_DRAG_TAP_SUPPRESS_MS = 48;

/** Extra hit slop when releasing on the same touch button (finger drift / drag leniency). */
export const TOUCH_BUTTON_RELEASE_SLOP_PX = 28;

/** Cooldown before another enemy focus tap after selecting a target. */
export const FOCUS_SELECT_LOCK_MS = 160;
