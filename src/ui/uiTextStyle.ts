import type Phaser from "phaser";
import { uiTextResolution } from "../core/displayScale";
import { scaleUiX, scaleUiY } from "../config/uiScale";

/** Clean sans stack for HUD / overlay text (avoid monospace / legacy canvas defaults). */
export const UI_FONT_FAMILY =
  'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

type RegistryScene = { registry: { get: (key: string) => unknown } };

export function parseUiFontSizePx(fontSize: string): number {
  const n = parseFloat(fontSize);
  return Number.isFinite(n) ? n : 0;
}

/** Textured Gothic buttons keep stroke only at larger label sizes (not spell bar, overlays). */
export function uiTextStrokeAllowed(fontSizePx: number): boolean {
  return fontSizePx > scaleUiX(14);
}

export function uiTextStyle(
  scene: RegistryScene,
  style: Phaser.Types.GameObjects.Text.TextStyle,
): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: UI_FONT_FAMILY,
    resolution: uiTextResolution(scene),
    ...style,
  };
}

/** Legibility over busy pixels without canvas text stroke. */
export function uiSmallLabelShadow(): NonNullable<
  Phaser.Types.GameObjects.Text.TextStyle["shadow"]
> {
  return {
    offsetX: 0,
    offsetY: Math.max(1, scaleUiY(1)),
    color: "#09090b",
    blur: Math.max(1, scaleUiX(1)),
    stroke: false,
    fill: true,
  };
}
