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
  return worldPointToScreen(worldPtrX, worldPtrY, cam);
}

/** Inverse of Camera.getWorldPoint — world → pointer (screen) space. */
function worldPointToScreen(
  worldX: number,
  worldY: number,
  cam: Phaser.Cameras.Scene2D.Camera,
): { x: number; y: number } {
  const camXf = cam as Phaser.Cameras.Scene2D.Camera & {
    matrix?: Phaser.GameObjects.Components.TransformMatrix;
    rotation: number;
    zoomX: number;
    zoomY: number;
  };
  const cameraMatrix = camXf.matrix?.matrix;
  if (!cameraMatrix) {
    return { x: worldX, y: worldY };
  }
  const mva = cameraMatrix[0] ?? 1;
  const mvb = cameraMatrix[1] ?? 0;
  const mvc = cameraMatrix[2] ?? 0;
  const mvd = cameraMatrix[3] ?? 1;
  const mve = cameraMatrix[4] ?? 0;
  const mvf = cameraMatrix[5] ?? 0;

  const sx = worldX * mva + worldY * mvc + mve;
  const sy = worldX * mvb + worldY * mvd + mvf;

  const c = Math.cos(camXf.rotation);
  const s = Math.sin(camXf.rotation);
  const scrollX = cam.scrollX;
  const scrollY = cam.scrollY;
  const zoomX = camXf.zoomX;
  const zoomY = camXf.zoomY;

  return {
    x: sx - (scrollX * c - scrollY * s) * zoomX,
    y: sy - (scrollX * s + scrollY * c) * zoomY,
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