import type Phaser from "phaser";
import { PALETTE_CSS } from "./theme/uiPalette";
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
    color: PALETTE_CSS.zinc950,
    blur: Math.max(1, scaleUiX(1)),
    stroke: false,
    fill: true,
  };
}

/**
 * Re-rasterise `texts` once a web font (CSS font shorthand, e.g. `700 16px "Pixelify Sans"`)
 * has loaded. Text drawn before the font arrives keeps the fallback face otherwise:
 * `setFontFamily` with the same family string is a no-op in Phaser.
 * `onReady` runs after the re-render (re-fit / re-layout text that depends on width).
 */
export function rerenderTextsWhenFontReady(
  font: string,
  texts: () => readonly Phaser.GameObjects.Text[],
  onReady?: () => void,
): void {
  const fonts = typeof document !== "undefined" ? document.fonts : undefined;
  if (!fonts?.load) return;
  if (fonts.check?.(font)) return;
  void fonts
    .load(font)
    .then(() => {
      let alive = false;
      for (const t of texts()) {
        if (!t.active || !t.scene) continue;
        alive = true;
        t.style.update(true);
      }
      if (alive) onReady?.();
    })
    .catch(() => undefined);
}
