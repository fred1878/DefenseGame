/**
 * Phaser 3 pixel-snapping parity for Phaser 4.
 *
 * DefenseGame is pixel art rendered with `roundPixels: true`. Phaser 4 changed what
 * that means (see the v4 migration guide, "Round Pixels"):
 *
 * 1. Vertex rounding: v4's default `vertexRoundMode` ("safeAuto") only snaps objects
 *    whose transform is a pure translation. Scaled sprites (64px icons drawn at 2x,
 *    world sprites at the world pixel scale) are no longer snapped, so nearest-neighbour
 *    sampling lands on half texels and the art shifts by a pixel here and there.
 *    Phaser 3 snapped every quad, which is v4's "fullAuto".
 * 2. Camera scroll: Phaser 3 floored a roundPixels camera's scroll each frame and
 *    snapped the viewport origin (`floor(y + height / 2 + 0.5) - height / 2`), so an
 *    odd-height viewport (the Defense play area) sat half a pixel lower. Phaser 4 keeps
 *    fractional scroll and an exact origin, which moves the whole world view by 1px.
 *
 * Both helpers restore the Phaser 3 output exactly (verified by the visual e2e
 * baselines in e2e/visual-screens.spec.ts, which were captured on Phaser 3.90).
 */
import type Phaser from "phaser";

type RoundingGameObject = {
  vertexRoundMode?: string;
  willRoundVertices(camera: { roundPixels: boolean }, onlyTranslated: boolean): boolean;
};

/**
 * Treat the default "safeAuto" vertex round mode as "fullAuto" (Phaser 3 behaviour).
 * Objects that set another mode explicitly keep it.
 */
export function installPhaser3VertexRounding(phaser: typeof Phaser): void {
  const proto = phaser.GameObjects.GameObject.prototype as unknown as RoundingGameObject & {
    __phaser3Rounding?: boolean;
  };
  if (proto.__phaser3Rounding) return;
  const original = proto.willRoundVertices;
  proto.willRoundVertices = function (
    this: RoundingGameObject,
    camera: { roundPixels: boolean },
    onlyTranslated: boolean,
  ): boolean {
    if (this.vertexRoundMode === "safeAuto") return camera.roundPixels;
    return original.call(this, camera, onlyTranslated);
  };
  proto.__phaser3Rounding = true;
}

type ViewMatrix = {
  applyITRS(x: number, y: number, rotation: number, scaleX: number, scaleY: number): unknown;
  translate(x: number, y: number): unknown;
  multiply(rhs: ViewMatrix, out: ViewMatrix): unknown;
};

/** The parts of Phaser 4's Camera that `snapCameraLikePhaser3` touches. */
export type SnappableCamera = {
  x: number;
  y: number;
  width: number;
  height: number;
  originX: number;
  originY: number;
  scrollX: number;
  scrollY: number;
  zoomX: number;
  zoomY: number;
  roundPixels: boolean;
  matrix: ViewMatrix;
  matrixExternal: ViewMatrix;
  matrixCombined: ViewMatrix;
  preRender(): void;
};

/**
 * Wrap a camera's `preRender` so a roundPixels camera renders like Phaser 3:
 * scroll floored to whole pixels and the viewport origin snapped the v3 way.
 * Follow/lerp keeps running from the floored scroll, as it did in v3.
 * Rotation is not supported (the game never rotates cameras).
 */
export function snapCameraLikePhaser3(camera: Phaser.Cameras.Scene2D.Camera): void {
  const cam = camera as unknown as SnappableCamera & { __phaser3Snap?: boolean };
  if (cam.__phaser3Snap) return;
  cam.__phaser3Snap = true;
  const original = cam.preRender;
  /** Floored scroll that follow/lerp continues from, and the offset scroll last rendered. */
  let logical: { x: number; y: number } | null = null;
  let shown: { x: number; y: number } | null = null;

  cam.preRender = function (this: SnappableCamera): void {
    // Undo last frame's render offset unless game code moved the camera since.
    if (logical && shown && this.scrollX === shown.x && this.scrollY === shown.y) {
      this.scrollX = logical.x;
      this.scrollY = logical.y;
    }
    original.call(this);
    if (!this.roundPixels) {
      logical = null;
      shown = null;
      return;
    }
    const ox = this.width * this.originX;
    const oy = this.height * this.originY;
    const lx = Math.floor(this.scrollX);
    const ly = Math.floor(this.scrollY);
    // Phaser 3 positioned the view at floor(x + origin + 0.5) - origin.
    const sx = lx - (Math.floor(this.x + ox + 0.5) - ox - this.x);
    const sy = ly - (Math.floor(this.y + oy + 0.5) - oy - this.y);
    logical = { x: lx, y: ly };
    shown = { x: sx, y: sy };
    this.scrollX = sx;
    this.scrollY = sy;
    // Rebuild the view matrices exactly as Camera#preRender does (no rotation).
    this.matrix.applyITRS(ox, oy, 0, this.zoomX, this.zoomY);
    this.matrix.translate(-sx - ox, -sy - oy);
    this.matrixExternal.applyITRS(this.x, this.y, 0, 1, 1);
    this.matrixExternal.multiply(this.matrix, this.matrixCombined);
  };
}
