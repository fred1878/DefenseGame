import Phaser from "phaser";

type TransformGo = Phaser.GameObjects.GameObject & {
  getWorldTransformMatrix?: (
    tempMatrix?: Phaser.GameObjects.Components.TransformMatrix,
    parentMatrix?: Phaser.GameObjects.Components.TransformMatrix,
  ) => Phaser.GameObjects.Components.TransformMatrix;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  displayOriginX: number;
  displayOriginY: number;
  input?: {
    hitArea?: Phaser.Geom.Rectangle | Phaser.Geom.Circle;
  };
};

/** Mirror InputManager hit-test: input space → pointer (screen) coords. */
function inputSpaceToScreen(
  px: number,
  py: number,
  sfx: number,
  sfy: number,
  cam: Phaser.Cameras.Scene2D.Camera,
): { x: number; y: number } {
  const csx = cam.scrollX;
  const csy = cam.scrollY;
  const worldPtrX = px - csx * sfx + csx;
  const worldPtrY = py - csy * sfy + csy;
  return cameraWorldToScreen(worldPtrX, worldPtrY, {
    x: cam.x,
    y: cam.y,
    width: cam.width,
    height: cam.height,
    originX: cam.originX,
    originY: cam.originY,
    scrollX: csx,
    scrollY: csy,
    zoomX: cam.zoomX,
    zoomY: cam.zoomY,
    // Phaser 4's .d.ts omits Camera#rotation (it is a runtime property).
    rotation: (cam as { rotation?: number }).rotation ?? 0,
  });
}

/** The camera properties that define its view transform (all public on Phaser's Camera). */
export type CameraView = {
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
  rotation: number;
};

/**
 * World → pointer (screen) space; the inverse of `Camera.getWorldPoint`.
 *
 * Computed from the camera's public properties instead of `Camera#matrix`, whose
 * meaning changed in Phaser 4 (it now already includes scroll, and position moved
 * to `matrixExternal`). Phaser's camera view transform is
 *   screen = camPos + origin + Rotate(Zoom(world - scroll - origin))
 * with origin = (width * originX, height * originY).
 */
export function cameraWorldToScreen(
  worldX: number,
  worldY: number,
  cam: CameraView,
): { x: number; y: number } {
  const ox = cam.width * cam.originX;
  const oy = cam.height * cam.originY;
  const dx = (worldX - cam.scrollX - ox) * cam.zoomX;
  const dy = (worldY - cam.scrollY - oy) * cam.zoomY;
  const c = Math.cos(cam.rotation);
  const s = Math.sin(cam.rotation);
  return {
    x: cam.x + ox + dx * c - dy * s,
    y: cam.y + oy + dx * s + dy * c,
  };
}

/** Hit areas anchored at (0,0) need origin adjustment; centered rects use negative x/y. */
function hitLocalToInputPx(
  wx: number,
  wy: number,
  localX: number,
  localY: number,
  originX: number,
  originY: number,
  scaleX: number,
  scaleY: number,
): { px: number; py: number } {
  const centered = localX < 0 || localY < 0;
  return {
    px: wx + (centered ? localX : localX - originX) * scaleX,
    py: wy + (centered ? localY : localY - originY) * scaleY,
  };
}

/**
 * Map a pointer position in a Game Object's local hit-test space to screen/canvas
 * coordinates (same space as `pointer.x` / `pointer.y`).
 */
export function hitAreaLocalPointToScreen(
  obj: Phaser.GameObjects.GameObject,
  localX: number,
  localY: number,
  camera?: Phaser.Cameras.Scene2D.Camera,
): { x: number; y: number } | null {
  const go = obj as TransformGo;
  if (!go.scene) return null;
  const cam = camera ?? go.scene.cameras.main;

  let wx = go.x;
  let wy = go.y;
  let scaleX = go.scaleX;
  let scaleY = go.scaleY;
  if (go.getWorldTransformMatrix) {
    const matrix = new Phaser.GameObjects.Components.TransformMatrix();
    go.getWorldTransformMatrix(matrix);
    wx = matrix.tx;
    wy = matrix.ty;
    scaleX = matrix.scaleX;
    scaleY = matrix.scaleY;
  }

  const sfx = (go as { scrollFactorX?: number }).scrollFactorX ?? 1;
  const sfy = (go as { scrollFactorY?: number }).scrollFactorY ?? 1;
  const { px, py } = hitLocalToInputPx(
    wx,
    wy,
    localX,
    localY,
    go.displayOriginX,
    go.displayOriginY,
    scaleX,
    scaleY,
  );
  if (sfx === 0 && sfy === 0) {
    return { x: px, y: py };
  }
  return inputSpaceToScreen(px, py, sfx, sfy, cam);
}

/**
 * Screen/canvas bounds of an interactive hit area — matches InputManager hit tests (same space as `pointer.x/y`).
 */
export function interactiveObjectScreenRect(
  obj: Phaser.GameObjects.GameObject,
  camera?: Phaser.Cameras.Scene2D.Camera,
): { x: number; y: number; width: number; height: number } | null {
  const go = obj as TransformGo;
  const input = go.input;
  if (!input?.hitArea) return null;
  const scene = obj.scene;
  if (!scene) return null;
  const cam = camera ?? scene.cameras.main;

  let wx = go.x;
  let wy = go.y;
  let scaleX = go.scaleX;
  let scaleY = go.scaleY;
  if (go.getWorldTransformMatrix) {
    const matrix = new Phaser.GameObjects.Components.TransformMatrix();
    go.getWorldTransformMatrix(matrix);
    wx = matrix.tx;
    wy = matrix.ty;
    scaleX = matrix.scaleX;
    scaleY = matrix.scaleY;
  }

  const shape = input.hitArea;
  const sfx = (go as { scrollFactorX?: number }).scrollFactorX ?? 1;
  const sfy = (go as { scrollFactorY?: number }).scrollFactorY ?? 1;

  const toScreen = (px: number, py: number): { x: number; y: number } => {
    if (sfx === 0 && sfy === 0) {
      return { x: px, y: py };
    }
    return inputSpaceToScreen(px, py, sfx, sfy, cam);
  };

  if (shape instanceof Phaser.Geom.Circle) {
    const { px, py } = hitLocalToInputPx(
      wx,
      wy,
      shape.x - shape.radius,
      shape.y - shape.radius,
      go.displayOriginX,
      go.displayOriginY,
      scaleX,
      scaleY,
    );
    const size = shape.radius * 2 * Math.abs(scaleX);
    const topLeft = toScreen(px, py);
    return {
      x: topLeft.x,
      y: topLeft.y,
      width: size,
      height: size,
    };
  }

  const rect = shape as Phaser.Geom.Rectangle;
  const { px: px0, py: py0 } = hitLocalToInputPx(
    wx,
    wy,
    rect.x,
    rect.y,
    go.displayOriginX,
    go.displayOriginY,
    scaleX,
    scaleY,
  );
  const hitW = rect.width * Math.abs(scaleX);
  const hitH = rect.height * Math.abs(scaleY);
  const tl = toScreen(px0, py0);
  const br = toScreen(px0 + hitW, py0 + hitH);
  return {
    x: Math.min(tl.x, br.x),
    y: Math.min(tl.y, br.y),
    width: Math.abs(br.x - tl.x),
    height: Math.abs(br.y - tl.y),
  };
}

/** Screen-space bounds for stick masking (interactive hit box in canvas coords). */
export function containerScreenRect(
  container: Phaser.GameObjects.Container,
  pad = 0,
): { x: number; y: number; width: number; height: number } {
  const fromInput = interactiveObjectScreenRect(container);
  const b = fromInput ?? container.getBounds();
  return {
    x: b.x - pad,
    y: b.y - pad,
    width: b.width + pad * 2,
    height: b.height + pad * 2,
  };
}

/** True while press-scale tween holds the button visually down (e2e assertions). */
export function isTouchButtonVisuallyPressed(
  container: Phaser.GameObjects.Container,
): boolean {
  return container.scaleX < 0.94 || container.scaleY < 0.94;
}

/** Screen-space hit test for UI that must block the movement stick. */
export function pointerInScreenRect(
  x: number,
  y: number,
  rect: { x: number; y: number; width: number; height: number },
): boolean {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}