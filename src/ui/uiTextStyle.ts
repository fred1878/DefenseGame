import type Phaser from "phaser";
import { scaleUiX, scaleUiY, uiTextResolution } from "../core/displayScale";

/**
 * Pixel UI stack for every HUD / panel / overlay text. "DG Digits" (index.html and
 * `queueUiFonts`) is Departure Mono limited to 0-9 and %, so numbers render in it and
 * every other glyph falls through to Pixelify Sans.
 */
export const UI_FONT_FAMILY =
  '"DG Digits", "Pixelify Sans", system-ui, sans-serif';

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

type TextFactoryProto = {
  text: (
    this: unknown,
    x: number,
    y: number,
    text: string | string[],
    style?: Phaser.Types.GameObjects.Text.TextStyle,
  ) => Phaser.GameObjects.Text;
  __uiFontDefault?: boolean;
};

/**
 * Make `scene.add.text` default to the pixel UI stack (Phaser's own default is
 * Courier), so every text object uses Pixelify Sans / Departure Mono digits even
 * when its style omits `fontFamily`. Explicit families still win.
 */
export function installDefaultUiFont(factoryProto: unknown): void {
  const proto = factoryProto as TextFactoryProto | undefined;
  if (!proto?.text || proto.__uiFontDefault) return;
  proto.__uiFontDefault = true;
  const text = proto.text;
  proto.text = function (this: unknown, x, y, value, style) {
    return text.call(this, x, y, value, {
      fontFamily: UI_FONT_FAMILY,
      ...(style ?? {}),
    });
  };
}
