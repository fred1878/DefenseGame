import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";
import Phaser from "phaser";
import {
  type CameraView,
  cameraWorldToScreen,
  hitAreaLocalPointToScreen,
  interactiveObjectScreenRect,
} from "./touchButtonGeometry";

function identityCamera(
  scroll: { x: number; y: number } = { x: 0, y: 0 },
): Phaser.Cameras.Scene2D.Camera {
  return {
    x: 0,
    y: 0,
    width: 540,
    height: 1200,
    originX: 0.5,
    originY: 0.5,
    scrollX: scroll.x,
    scrollY: scroll.y,
    rotation: 0,
    zoomX: 1,
    zoomY: 1,
    getWorldPoint(x: number, y: number) {
      return new Phaser.Math.Vector2(x, y);
    },
  } as unknown as Phaser.Cameras.Scene2D.Camera;
}

type PhaserTransformMatrix = {
  matrix: Float32Array;
  applyITRS(
    x: number,
    y: number,
    rotation: number,
    scaleX: number,
    scaleY: number,
  ): PhaserTransformMatrix;
  translate(x: number, y: number): PhaserTransformMatrix;
  multiply(
    rhs: PhaserTransformMatrix,
    out: PhaserTransformMatrix,
  ): PhaserTransformMatrix;
};

/**
 * Phaser's real TransformMatrix (the Vitest `phaser` alias is a stub, so load the source directly).
 * The full Camera class needs a browser (device detection), so `realCamera` rebuilds its view
 * matrix the same way `Camera#preRender` does in Phaser 4 and inverts it like `getWorldPoint`.
 */
const TransformMatrix = createRequire(import.meta.url)(
  path.join(
    process.cwd(),
    "node_modules/phaser/src/gameobjects/components/TransformMatrix.js",
  ),
) as new () => PhaserTransformMatrix;

function realCamera(opts: {
  x?: number;
  y?: number;
  scrollX?: number;
  scrollY?: number;
  zoom?: number;
  rotation?: number;
}): Phaser.Cameras.Scene2D.Camera {
  const cam = {
    x: opts.x ?? 0,
    y: opts.y ?? 0,
    width: 540,
    height: 1200,
    originX: 0.5,
    originY: 0.5,
    scrollX: opts.scrollX ?? 0,
    scrollY: opts.scrollY ?? 0,
    zoomX: opts.zoom ?? 1,
    zoomY: opts.zoom ?? 1,
    rotation: opts.rotation ?? 0,
  };
  const ox = cam.width * cam.originX;
  const oy = cam.height * cam.originY;
  // Camera#preRender (Phaser 4.2.1): matrix = ITRS(origin, rot, zoom) · T(-scroll - origin);
  // matrixExternal = T(camera position); matrixCombined = matrixExternal · matrix.
  const matrix = new TransformMatrix();
  matrix.applyITRS(ox, oy, cam.rotation, cam.zoomX, cam.zoomY);
  matrix.translate(-cam.scrollX - ox, -cam.scrollY - oy);
  const external = new TransformMatrix();
  external.applyITRS(cam.x, cam.y, 0, 1, 1);
  const combined = new TransformMatrix();
  external.multiply(matrix, combined);
  return {
    ...cam,
    matrix,
    // BaseCamera#getWorldPoint: invert matrixCombined.
    getWorldPoint(x: number, y: number) {
      const [a = 1, b = 0, c = 0, d = 1, e = 0, f = 0] = combined.matrix;
      const det = 1 / (a * d - b * c);
      return new Phaser.Math.Vector2(
        x * d * det + y * -c * det + (c * f - d * e) * det,
        x * -b * det + y * a * det + (b * e - a * f) * det,
      );
    },
  } as unknown as Phaser.Cameras.Scene2D.Camera;
}

function fakeScene(camera: Phaser.Cameras.Scene2D.Camera): Phaser.Scene {
  return { cameras: { main: camera } } as unknown as Phaser.Scene;
}

describe("interactiveObjectScreenRect", () => {
  it("maps a scrollFactor-0 rectangle hit area to screen coords", () => {
    const camera = identityCamera();
    const hitW = 80;
    const hitH = 44;
    const go = {
      x: 120,
      y: 200,
      scaleX: 1,
      scaleY: 1,
      displayOriginX: hitW / 2,
      displayOriginY: hitH / 2,
      scrollFactorX: 0,
      scrollFactorY: 0,
      scene: fakeScene(camera),
      input: {
        hitArea: new Phaser.Geom.Rectangle(-hitW / 2, -hitH / 2, hitW, hitH),
      },
    } as unknown as Phaser.GameObjects.GameObject;

    const r = interactiveObjectScreenRect(go, camera);
    expect(r).not.toBeNull();
    expect(r!.x).toBeCloseTo(80, 4);
    expect(r!.y).toBeCloseTo(178, 4);
    expect(r!.width).toBeCloseTo(hitW, 4);
    expect(r!.height).toBeCloseTo(hitH, 4);
  });

  it("includes parent container translation for nested interactives (endless list rows)", () => {
    const camera = identityCamera();
    const hitW = 60;
    const hitH = 40;
    const child = {
      x: 50,
      y: 30,
      scaleX: 1,
      scaleY: 1,
      displayOriginX: hitW / 2,
      displayOriginY: hitH / 2,
      scrollFactorX: 1,
      scrollFactorY: 1,
      parentContainer: {} as Phaser.GameObjects.Container,
      getWorldTransformMatrix(temp: unknown) {
        const matrix = temp as {
          tx: number;
          ty: number;
          scaleX: number;
          scaleY: number;
        };
        matrix.tx = 50;
        matrix.ty = 130;
        matrix.scaleX = 1;
        matrix.scaleY = 1;
        return temp as Phaser.GameObjects.Components.TransformMatrix;
      },
      scene: fakeScene(camera),
      input: {
        hitArea: new Phaser.Geom.Rectangle(-hitW / 2, -hitH / 2, hitW, hitH),
      },
    } as unknown as Phaser.GameObjects.GameObject;

    const r = interactiveObjectScreenRect(child, camera);
    expect(r).not.toBeNull();
    expect(r!.x).toBeCloseTo(20, 4);
    expect(r!.y).toBeCloseTo(110, 4);
    expect(r!.width).toBeCloseTo(hitW, 4);
    expect(r!.height).toBeCloseTo(hitH, 4);
  });

  it("supports createTouchButton hit areas anchored at (0,0)", () => {
    const camera = identityCamera();
    const hitW = 100;
    const hitH = 48;
    const go = {
      x: 90,
      y: 1100,
      scaleX: 1,
      scaleY: 1,
      displayOriginX: hitW / 2,
      displayOriginY: hitH / 2,
      scrollFactorX: 0,
      scrollFactorY: 0,
      scene: fakeScene(camera),
      input: {
        hitArea: new Phaser.Geom.Rectangle(0, 0, hitW, hitH),
      },
    } as unknown as Phaser.GameObjects.GameObject;

    const r = interactiveObjectScreenRect(go, camera);
    expect(r).not.toBeNull();
    expect(r!.x).toBeCloseTo(40, 4);
    expect(r!.y).toBeCloseTo(1076, 4);
    expect(r!.width).toBeCloseTo(hitW, 4);
    expect(r!.height).toBeCloseTo(hitH, 4);
  });

  it("maps scrollFactor-1 hit areas to screen coords (InputManager space, not getWorldPoint input)", () => {
    const camera = identityCamera();
    const hit = new Phaser.Geom.Rectangle(-20, -10, 40, 20);
    const go = {
      x: 200,
      y: 300,
      scaleX: 1,
      scaleY: 1,
      displayOriginX: 20,
      displayOriginY: 10,
      scrollFactorX: 1,
      scrollFactorY: 1,
      scene: fakeScene(camera),
      input: { hitArea: hit },
    } as unknown as Phaser.GameObjects.GameObject;

    const r = interactiveObjectScreenRect(go, camera);
    expect(r).not.toBeNull();
    expect(r!.x).toBeCloseTo(180, 3);
    expect(r!.y).toBeCloseTo(290, 3);
    expect(r!.width).toBeCloseTo(40, 3);
    expect(r!.height).toBeCloseTo(20, 3);
  });

  it("maps scrollFactor-1 hit areas under a scrolled camera (defense world view)", () => {
    const camera = realCamera({ scrollY: 350 });
    const go = {
      x: 200,
      y: 900,
      scaleX: 1,
      scaleY: 1,
      displayOriginX: 20,
      displayOriginY: 10,
      scrollFactorX: 1,
      scrollFactorY: 1,
      scene: fakeScene(camera),
      input: { hitArea: new Phaser.Geom.Rectangle(-20, -10, 40, 20) },
    } as unknown as Phaser.GameObjects.GameObject;

    const r = interactiveObjectScreenRect(go, camera);
    expect(r).not.toBeNull();
    // World y 890 seen through a camera scrolled 350 down lands at screen y 540 (scroll counted once).
    expect(r!.x).toBeCloseTo(180, 3);
    expect(r!.y).toBeCloseTo(540, 3);
    expect(r!.width).toBeCloseTo(40, 3);
    expect(r!.height).toBeCloseTo(20, 3);
  });

  it("keeps scrollFactor-0 HUD hit areas fixed when the camera is scrolled", () => {
    const camera = realCamera({ scrollY: 350 });
    const go = {
      x: 120,
      y: 200,
      scaleX: 1,
      scaleY: 1,
      displayOriginX: 40,
      displayOriginY: 22,
      scrollFactorX: 0,
      scrollFactorY: 0,
      scene: fakeScene(camera),
      input: { hitArea: new Phaser.Geom.Rectangle(-40, -22, 80, 44) },
    } as unknown as Phaser.GameObjects.GameObject;

    const r = interactiveObjectScreenRect(go, camera);
    expect(r!.x).toBeCloseTo(80, 4);
    expect(r!.y).toBeCloseTo(178, 4);
  });
});

describe("cameraWorldToScreen", () => {
  const cases = [
    { name: "scrolled", cam: { scrollY: 350 } },
    {
      name: "scrolled + offset viewport",
      cam: { x: 12, y: 30, scrollX: -40, scrollY: 610 },
    },
    {
      name: "scrolled + zoomed",
      cam: { scrollX: 25, scrollY: 420, zoom: 1.75 },
    },
    {
      name: "scrolled + zoomed + rotated",
      cam: { scrollY: 200, zoom: 0.8, rotation: 0.35 },
    },
  ];
  const points: Array<[number, number]> = [
    [0, 0],
    [270, 600],
    [-120, 1480],
    [533, 77],
  ];

  for (const { name, cam: opts } of cases) {
    it(`is the inverse of Camera.getWorldPoint (${name})`, () => {
      const cam = realCamera(opts);
      for (const [wx, wy] of points) {
        const screen = cameraWorldToScreen(
          wx,
          wy,
          cam as unknown as CameraView,
        );
        const back = cam.getWorldPoint(screen.x, screen.y);
        expect(back.x).toBeCloseTo(wx, 3);
        expect(back.y).toBeCloseTo(wy, 3);
      }
    });
  }
});

describe("hitAreaLocalPointToScreen", () => {
  it("matches the center of a scrollFactor-0 touch button", () => {
    const camera = identityCamera();
    const hitW = 100;
    const hitH = 48;
    const go = {
      x: 90,
      y: 1100,
      scaleX: 1,
      scaleY: 1,
      displayOriginX: hitW / 2,
      displayOriginY: hitH / 2,
      scrollFactorX: 0,
      scrollFactorY: 0,
      scene: fakeScene(camera),
      input: {
        hitArea: new Phaser.Geom.Rectangle(0, 0, hitW, hitH),
      },
    } as unknown as Phaser.GameObjects.GameObject;

    const center = hitAreaLocalPointToScreen(go, hitW / 2, hitH / 2, camera);
    expect(center).not.toBeNull();
    expect(center!.x).toBeCloseTo(90, 4);
    expect(center!.y).toBeCloseTo(1100, 4);
  });
});

describe("interactiveObjectScreenRect fallbacks", () => {
  it("returns null when the object has no scene", () => {
    const obj = {
      x: 10,
      y: 10,
      scaleX: 1,
      scaleY: 1,
      input: { hitArea: { x: 0, y: 0, width: 20, height: 10 } },
    };
    expect(
      interactiveObjectScreenRect(
        obj as unknown as Phaser.GameObjects.GameObject,
      ),
    ).toBeNull();
  });
});
