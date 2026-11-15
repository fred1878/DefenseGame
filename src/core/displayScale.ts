import { GAME } from "../config/game";

const LEGACY_WIDTH = 390;
const LEGACY_HEIGHT = 844;

/** Horizontal scale vs original 390-wide layout. */
export function uiScaleX(): number {
  return GAME.width / LEGACY_WIDTH;
}

/** Vertical scale vs original 844-tall layout. */
export function uiScaleY(): number {
  return GAME.height / LEGACY_HEIGHT;
}

export function scaleUiX(px: number): number {
  return Math.round(px * uiScaleX());
}

export function scaleUiY(px: number): number {
  return Math.round(px * uiScaleY());
}

/** Capped devicePixelRatio for crisp Phaser Text (extra sharpness when FIT scale is non-integer). */
export function clampRenderResolution(
  max = GAME.renderResolutionCap,
): number {
  if (typeof window === "undefined") return 1;
  const dpr = window.devicePixelRatio ?? 1;
  return Math.min(Math.max(dpr, 1), max);
}

type RegistryScene = { registry: { get: (key: string) => unknown } };

/** Registry `renderResolution` with DPR cap — use on all HUD / overlay Text. */
export function uiTextResolution(scene: RegistryScene): number {
  return (
    (scene.registry.get("renderResolution") as number | undefined) ??
    clampRenderResolution()
  );
}