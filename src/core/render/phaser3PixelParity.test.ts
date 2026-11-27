import { describe, expect, it, vi } from "vitest";
import Phaser from "phaser";
import {
  installPhaser3VertexRounding,
  snapCameraLikePhaser3,
  snapQuadLikePhaser3,
} from "./phaser3PixelParity";

describe("snapQuadLikePhaser3", () => {
  it("snaps the top-left corner and keeps the quad size (Phaser 3 setQuad)", () => {
    // 85×24.5 quad whose top-left sits on a half pixel.
    const quad = [169.5, 247.5, 169.5, 272, 254.5, 272, 254.5, 247.5];
    snapQuadLikePhaser3(quad);
    expect(quad).toEqual([170, 248, 170, 272.5, 255, 272.5, 255, 248]);
  });

  it("leaves an already snapped quad alone", () => {
    const quad = [10, 20, 10, 44, 95, 44, 95, 20];
    snapQuadLikePhaser3(quad);
    expect(quad).toEqual([10, 20, 10, 44, 95, 44, 95, 20]);
  });

  it("treats a short or sparse quad as zeros", () => {
    const quad: number[] = [];
    snapQuadLikePhaser3(quad);
    expect(quad.slice(0, 2)).toEqual([0, 0]);
  });
});

describe("installPhaser3VertexRounding", () => {
  it("treats safeAuto as fullAuto and snaps image quads after transform", () => {
    const original = vi.fn(() => false);
    const proto = Phaser.GameObjects.GameObject.prototype as unknown as {
      willRoundVertices?: (
        camera: { roundPixels: boolean },
        onlyTranslated: boolean,
      ) => boolean;
      vertexRoundMode?: string;
      __phaser3Rounding?: boolean;
    };
    proto.willRoundVertices = original;
    proto.vertexRoundMode = "safeAuto";
    proto.__phaser3Rounding = false;

    const quad = new Float32Array([1.6, 2.4, 1.6, 10, 8, 10, 8, 2.4]);
    const gameObject = { x: 4.7, y: 5.2 };
    let capturedRound = false;
    const transformer = {
      quad,
      run(this: { quad: Float32Array }, ...args: unknown[]) {
        const go = Phaser.GameObjects.GameObject.prototype as unknown as {
          willRoundVertices(
            camera: { roundPixels: boolean },
            onlyTranslated: boolean,
          ): boolean;
        };
        capturedRound = go.willRoundVertices.call(
          { vertexRoundMode: "safeAuto" },
          (args[0] as { camera: { roundPixels: boolean } }).camera,
          true,
        );
      },
    };

    const phaser = Phaser as unknown as typeof Phaser & {
      Renderer: {
        WebGL: {
          RenderNodes: { TransformerImage: { prototype: typeof transformer } };
        };
      };
    };
    phaser.Renderer = {
      WebGL: {
        RenderNodes: {
          TransformerImage: { prototype: transformer },
        },
      },
    } as never;

    installPhaser3VertexRounding(phaser);
    // Second install is a no-op.
    installPhaser3VertexRounding(phaser);

    transformer.run({ camera: { roundPixels: true } }, gameObject);
    expect(gameObject).toEqual({ x: 4.7, y: 5.2 });
    expect(capturedRound).toBe(false);
    // Quad snapped like Phaser 3 from the deferred roundingWanted flag.
    expect(Array.from(quad).slice(0, 2)).toEqual([2, 2]);

    // Non-safeAuto defers to the original implementation when not in a run.
    proto.vertexRoundMode = "none";
    const outside = (
      Phaser.GameObjects.GameObject.prototype as unknown as {
        willRoundVertices(
          camera: { roundPixels: boolean },
          onlyTranslated: boolean,
        ): boolean;
      }
    ).willRoundVertices({ roundPixels: true }, false);
    expect(outside).toBe(false);
    expect(original).toHaveBeenCalled();
  });
});

describe("snapCameraLikePhaser3", () => {
  it("floors scroll and snaps the origin like Phaser 3, then can restore", () => {
    const applyITRS = vi.fn();
    const translate = vi.fn();
    const multiply = vi.fn();
    const preRender = vi.fn();
    const camera = {
      x: 0,
      y: 0.25,
      width: 540,
      height: 801,
      originX: 0.5,
      originY: 0.5,
      scrollX: 10.7,
      scrollY: 20.4,
      zoomX: 1,
      zoomY: 1,
      roundPixels: true,
      matrix: { applyITRS, translate, multiply },
      matrixExternal: { applyITRS, translate, multiply },
      matrixCombined: { applyITRS, translate, multiply },
      preRender,
    };
    snapCameraLikePhaser3(camera as never);
    snapCameraLikePhaser3(camera as never); // no-op second wrap
    camera.preRender();
    expect(preRender).toHaveBeenCalledOnce();
    expect(camera.scrollX).not.toBe(10.7);
    const shownX = camera.scrollX;
    expect(typeof camera.scrollY).toBe("number");
    expect(applyITRS).toHaveBeenCalled();
    expect(translate).toHaveBeenCalled();
    expect(multiply).toHaveBeenCalled();

    // Next frame, if game code didn't move scroll, restore logical then resnap.
    camera.preRender();
    expect(preRender).toHaveBeenCalledTimes(2);

    // Game code moved the camera: don't restore the old logical scroll.
    camera.scrollX = 40.2;
    camera.scrollY = 50.6;
    camera.preRender();
    expect(camera.scrollX).not.toBe(shownX);

    camera.roundPixels = false;
    camera.preRender();
    // Leave fractional scroll alone when rounding is off.
    camera.scrollX = 3.3;
    camera.scrollY = 4.4;
    camera.preRender();
    expect(camera.scrollX).toBe(3.3);
    expect(camera.scrollY).toBe(4.4);
  });
});
