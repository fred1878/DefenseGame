import { GAME } from "../config/game";

/** Capped devicePixelRatio for crisp Phaser Text (extra sharpness when FIT scale is non-integer). */
export function clampRenderResolution(max = GAME.renderResolutionCap): number {
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
