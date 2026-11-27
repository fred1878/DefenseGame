/**
 * High-DPI backing store for the fixed 540×1200 game canvas.
 *
 * Phaser keeps the logical game size (scale manager, cameras, input, layout) at
 * `GAME.width × GAME.height`. Left alone, the canvas backing store is also 540×1200
 * and the browser stretches it to the screen, which smears or drops thin glyph stems
 * at non-integer factors (e.g. 2.625×).
 *
 * This module resizes only the canvas *backing store* to the on-screen CSS size × DPR
 * (DPR capped at `GAME.renderResolutionCap`) and scales the main WebGL drawing
 * context's viewport and scissor to match. The projection matrix stays in logical
 * units, so every game coordinate, camera and pointer mapping is unchanged; the GPU
 * simply rasterises the same scene with more pixels. Pixel-art textures keep NEAREST
 * sampling (see `configurePixelArtTextures`), so they stay blocky, while Text is drawn
 * at the backing resolution 1:1.
 *
 * Off-screen framebuffers (filters, masks, dynamic textures) keep their logical size.
 */
import type Phaser from "phaser";
import { GAME } from "../config/game";
import { setVertexSnapScale } from "./phaser3PixelParity";

/** Largest backing-store multiplier vs the logical size (5.4k×12k would exceed GPU limits). */
const MAX_BACKING_SCALE = 4;
const MIN_BACKING_SCALE = 0.5;

export type BackingSize = { width: number; height: number; scale: number };

/**
 * Backing-store pixel size for a canvas shown at `cssWidth × cssHeight` CSS px.
 * Keeps the logical aspect ratio and returns the effective scale (backing px per game unit).
 */
export function computeBackingSize(
  cssWidth: number,
  cssHeight: number,
  devicePixelRatio: number,
  dprCap: number = GAME.renderResolutionCap,
  logicalWidth: number = GAME.width,
  logicalHeight: number = GAME.height,
): BackingSize {
  const dpr = Math.min(Math.max(devicePixelRatio || 1, 1), dprCap);
  const fit =
    cssWidth > 0 && cssHeight > 0
      ? Math.min(cssWidth / logicalWidth, cssHeight / logicalHeight)
      : 1;
  const raw = Math.min(
    Math.max(fit * dpr, MIN_BACKING_SCALE),
    MAX_BACKING_SCALE,
  );
  const width = Math.max(1, Math.round(logicalWidth * raw));
  const height = Math.max(1, Math.round(logicalHeight * raw));
  return { width, height, scale: width / logicalWidth };
}

type CanvasDrawingContext = {
  useCanvas: boolean;
  width: number;
  height: number;
  state: {
    scissor: { box: number[] };
    viewport: number[];
  };
  resize(width: number, height: number): void;
  setScissorBox(x: number, y: number, width: number, height: number): void;
};

type PatchedProto = CanvasDrawingContext & { __hiDpiPatched?: boolean };

/** Backing px per logical unit on each axis (main canvas only). */
const backing = { sx: 1, sy: 1 };

function patchDrawingContext(proto: PatchedProto): void {
  if (proto.__hiDpiPatched) return;
  proto.__hiDpiPatched = true;
  const resize = proto.resize;
  proto.resize = function (
    this: CanvasDrawingContext,
    width: number,
    height: number,
  ): void {
    resize.call(this, width, height);
    if (!this.useCanvas) return;
    const w = Math.round(this.width * backing.sx);
    const h = Math.round(this.height * backing.sy);
    this.state.scissor.box = [0, 0, w, h];
    this.state.viewport = [0, 0, w, h];
  };
  const setScissorBox = proto.setScissorBox;
  proto.setScissorBox = function (
    this: CanvasDrawingContext,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    setScissorBox.call(this, x, y, width, height);
    if (!this.useCanvas) return;
    const [bx = 0, by = 0, bw = 0, bh = 0] = this.state.scissor.box;
    const x0 = Math.round(bx * backing.sx);
    const y0 = Math.round(by * backing.sy);
    this.state.scissor.box = [
      x0,
      y0,
      Math.round((bx + bw) * backing.sx) - x0,
      Math.round((by + bh) * backing.sy) - y0,
    ];
  };
}

type TextLike = {
  type?: string;
  style?: { resolution: number };
  setResolution?: (r: number) => unknown;
  list?: unknown[];
};

function retuneTextResolution(objects: unknown[], resolution: number): void {
  for (const raw of objects) {
    const obj = raw as TextLike;
    if (
      obj.type === "Text" &&
      obj.setResolution &&
      obj.style &&
      obj.style.resolution !== resolution
    ) {
      obj.setResolution(resolution);
    }
    if (Array.isArray(obj.list)) retuneTextResolution(obj.list, resolution);
  }
}

/** Text resolution that maps one Text texel to one backing-store pixel. */
export function textResolutionForBackingScale(scale: number): number {
  return Math.round(scale * 1000) / 1000;
}

/**
 * Keep the canvas backing store at CSS size × DPR. Call once after `new Phaser.Game`.
 * Returns a disposer (tests / hot reload).
 */
export function installHiDpiCanvas(game: Phaser.Game): () => void {
  const renderer = game.renderer as unknown as {
    baseDrawingContext?: CanvasDrawingContext & {
      constructor: { prototype: PatchedProto };
    };
    gl?: WebGLRenderingContext;
    drawingBufferHeight?: number;
  };
  if (!renderer?.gl || typeof window === "undefined") return () => {};
  const base = renderer.baseDrawingContext;
  if (!base) {
    // The WebGL renderer builds its drawing contexts once the default textures load.
    let dispose = (): void => {};
    let cancelled = false;
    game.textures.once("ready", () => {
      if (!cancelled) dispose = installHiDpiCanvas(game);
    });
    return () => {
      cancelled = true;
      dispose();
    };
  }
  patchDrawingContext(Object.getPrototypeOf(base) as PatchedProto);

  const canvas = game.canvas;
  let lastKey = "";

  const apply = (): void => {
    const rect = canvas.getBoundingClientRect();
    const cssW = rect.width || game.scale.displaySize.width;
    const cssH = rect.height || game.scale.displaySize.height;
    const size = computeBackingSize(cssW, cssH, window.devicePixelRatio);
    const key = `${size.width}x${size.height}`;
    if (key === lastKey) return;
    lastKey = key;
    if (canvas.width !== size.width) canvas.width = size.width;
    if (canvas.height !== size.height) canvas.height = size.height;
    backing.sx = size.width / GAME.width;
    backing.sy = size.height / GAME.height;
    setVertexSnapScale(backing.sx);
    base.resize(GAME.width, GAME.height);
    if (renderer.gl)
      renderer.drawingBufferHeight = renderer.gl.drawingBufferHeight;
    const resolution = textResolutionForBackingScale(backing.sx);
    game.registry.set("renderResolution", resolution);
    for (const scene of game.scene.scenes) {
      const list = scene.sys?.displayList?.list;
      if (list) retuneTextResolution(list, resolution);
    }
  };

  const scale = game.scale as Phaser.Scale.ScaleManager & {
    updateScale: () => void;
  };
  const updateScale = scale.updateScale;
  scale.updateScale = function (this: Phaser.Scale.ScaleManager): void {
    updateScale.call(this);
    apply();
  };

  let dprQuery: MediaQueryList | null = null;
  const watchDpr = (): void => {
    dprQuery?.removeEventListener("change", onDprChange);
    dprQuery = window.matchMedia?.(
      `(resolution: ${window.devicePixelRatio}dppx)`,
    );
    dprQuery?.addEventListener("change", onDprChange);
  };
  function onDprChange(): void {
    watchDpr();
    apply();
  }
  watchDpr();
  apply();

  return () => {
    scale.updateScale = updateScale;
    dprQuery?.removeEventListener("change", onDprChange);
  };
}
