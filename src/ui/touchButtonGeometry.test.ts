import { describe, expect, it } from "vitest";
import Phaser from "phaser";
import { interactiveObjectScreenRect } from "./touchButtonGeometry";

function identityCamera(
  scroll: { x: number; y: number } = { x: 0, y: 0 },
): Phaser.Cameras.Scene2D.Camera {
  const matrix = new Float32Array([1, 0, 0, 1, 0, 0, 0, 0, 1]);
  return {
    scrollX: scroll.x,
    scrollY: scroll.y,
    rotation: 0,
    zoomX: 1,
    zoomY: 1,
    matrix: { matrix },
    getWorldPoint(x: number, y: number) {
      return new Phaser.Math.Vector2(x, y);
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
});