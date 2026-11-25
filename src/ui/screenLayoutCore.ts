import type Phaser from "phaser";
import { scaleUiX, scaleUiY } from "../core/displayScale";

/** Shared screen layout primitives: safe-area insets, HUD band, viewport/camera helpers. */

export type SafeInsets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type ScreenRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export const HUD_SIDE = scaleUiX(12);

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

/** Top HUD band height (text lines + minimap clearance). */
export function hudBandHeight(safeTop = 0): number {
  return scaleUiY(96) + safeTop;
}

/** Align Phaser FIT parent with the visible viewport (mobile URL bar / dynamic island). */
export function bindViewportToScale(game: Phaser.Game): () => void {
  const parentEl =
    typeof document !== "undefined"
      ? (document.getElementById(game.config.parent as string) ??
        document.getElementById("game"))
      : null;

  const apply = () => {
    const vv = window.visualViewport;
    const w = vv?.width ?? window.innerWidth;
    const h = vv?.height ?? window.innerHeight;
    game.scale.setParentSize(w, h);
    if (parentEl && vv) {
      parentEl.style.position = "fixed";
      parentEl.style.left = `${vv.offsetLeft}px`;
      parentEl.style.top = `${vv.offsetTop}px`;
      parentEl.style.width = `${w}px`;
      parentEl.style.height = `${h}px`;
    }
    game.scale.updateBounds();
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
