import type Phaser from "phaser";
import {
  UI_FRAMES,
  type UiFrameName,
  type UiPartName,
  uiPartKey,
} from "../content/uiParts";

/** True once the UI part texture is in the cache (tests / early boot may lack it). */
export function hasUiPart(scene: Phaser.Scene, part: UiPartName): boolean {
  return !!scene.textures?.exists?.(uiPartKey(part));
}

/**
 * Lay a nine-slice frame over the box `x, y, w, h` (logical px). The frame is drawn at
 * its spec scale (whole source pixels stay square) and a crest extends above the box.
 */
export function layoutUiFrame(
  ns: Phaser.GameObjects.NineSlice,
  name: UiFrameName,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const f = UI_FRAMES[name];
  const ext = "extendTop" in f ? f.extendTop : 0;
  const minW = (f.left + f.right) * f.scale;
  const minH = (f.top + f.bottom) * f.scale;
  const dw = Math.max(w, minW);
  const dh = Math.max(h + ext, minH);
  ns.setScale(f.scale);
  ns.setSize(dw / f.scale, dh / f.scale);
  ns.setPosition(x, y - ext);
}

/** Nine-slice frame object (origin top-left), or null without the texture. */
export function addUiFrame(
  scene: Phaser.Scene,
  name: UiFrameName,
  x: number,
  y: number,
  w: number,
  h: number,
): Phaser.GameObjects.NineSlice | null {
  const f = UI_FRAMES[name];
  if (!hasUiPart(scene, f.part) || !scene.add?.nineslice) return null;
  const ns = scene.add
    .nineslice(
      x,
      y,
      uiPartKey(f.part),
      undefined,
      Math.max(1, w / f.scale),
      Math.max(1, h / f.scale),
      f.left,
      f.right,
      f.top,
      f.bottom,
    )
    .setOrigin(0, 0);
  layoutUiFrame(ns, name, x, y, w, h);
  return ns;
}

/** Swap a frame's texture and slices (e.g. dark → green button). */
export function setUiFrame(
  ns: Phaser.GameObjects.NineSlice,
  name: UiFrameName,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const f = UI_FRAMES[name];
  ns.setTexture(uiPartKey(f.part));
  ns.setSlices(
    Math.max(1, w / f.scale),
    Math.max(1, h / f.scale),
    f.left,
    f.right,
    f.top,
    f.bottom,
  );
  layoutUiFrame(ns, name, x, y, w, h);
}

/**
 * Put a pixel-art frame behind a `createTouchButton` label (above its vector fill),
 * sized to the button. No-op without the texture.
 */
export function frameTouchButton(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  name: UiFrameName,
  w: number,
  h: number,
): Phaser.GameObjects.NineSlice | null {
  const ns = addUiFrame(scene, name, -w / 2, -h / 2, w, h);
  if (!ns) return null;
  container.addAt(ns, 1);
  return ns;
}
