import Phaser from "phaser";

export type SafeInsets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

const HUD_SIDE = 12;

/** Read CSS env(safe-area-inset-*) in pixels (0 when unsupported). */
export function readSafeInsets(): SafeInsets {
  if (typeof document === "undefined") {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }
  const el = document.createElement("div");
  el.style.cssText = [
    "position: fixed",
    "top: env(safe-area-inset-top, 0px)",
    "right: env(safe-area-inset-right, 0px)",
    "bottom: env(safe-area-inset-bottom, 0px)",
    "left: env(safe-area-inset-left, 0px)",
    "visibility: hidden",
    "pointer-events: none",
  ].join(";");
  document.body.appendChild(el);
  const s = getComputedStyle(el);
  const px = (v: string) => parseFloat(v) || 0;
  const insets: SafeInsets = {
    top: px(s.top),
    right: px(s.right),
    bottom: px(s.bottom),
    left: px(s.left),
  };
  el.remove();
  return insets;
}

/** Top HUD band height (text lines + debug clearance on small screens). */
export function hudBandHeight(safeTop = 0): number {
  return 112 + safeTop;
}

export function hudTextPosition(safe: SafeInsets): { x: number; y: number } {
  return { x: HUD_SIDE + safe.left, y: HUD_SIDE + safe.top };
}

/** Bottom-left debug control — keeps the top HUD readable. */
export function debugButtonPosition(
  scene: Phaser.Scene,
  safe: SafeInsets,
): { x: number; y: number } {
  const margin = 12;
  return {
    x: margin + safe.left + 44,
    y: scene.scale.height - margin - safe.bottom - 22,
  };
}

/** Align Phaser FIT parent with the visible viewport (mobile URL bar / dynamic island). */
export function bindViewportToScale(game: Phaser.Game): () => void {
  const apply = () => {
    const w = window.visualViewport?.width ?? window.innerWidth;
    const h = window.visualViewport?.height ?? window.innerHeight;
    game.scale.setParentSize(w, h);
  };
  apply();
  window.addEventListener("resize", apply);
  const vv = window.visualViewport;
  if (vv) {
    vv.addEventListener("resize", apply);
    vv.addEventListener("scroll", apply);
  }
  return () => {
    window.removeEventListener("resize", apply);
    if (vv) {
      vv.removeEventListener("resize", apply);
      vv.removeEventListener("scroll", apply);
    }
  };
}

export function cameraWorldPoint(
  camera: Phaser.Cameras.Scene2D.Camera,
  screenX: number,
  screenY: number,
): Phaser.Math.Vector2 {
  return camera.getWorldPoint(screenX, screenY);
}