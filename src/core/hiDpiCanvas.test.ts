import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  computeBackingSize,
  installHiDpiCanvas,
  textResolutionForBackingScale,
} from "./hiDpiCanvas";
import { snapQuadLikePhaser3 } from "./phaser3PixelParity";

describe("computeBackingSize", () => {
  it("keeps the logical size at 1× CSS and DPR 1", () => {
    expect(computeBackingSize(540, 1200, 1)).toEqual({
      width: 540,
      height: 1200,
      scale: 1,
    });
  });

  it("matches CSS size × DPR (Pixel 7 style 2.625)", () => {
    const s = computeBackingSize(540, 1200, 2.625);
    expect(s.width).toBe(1418);
    expect(s.height).toBe(3150);
    expect(s.scale).toBeCloseTo(1418 / 540, 5);
  });

  it("uses the FIT scale of a smaller CSS box", () => {
    // 412×915 phone viewport (FIT limited by width) at DPR 2.
    const s = computeBackingSize(412, 915.6, 2);
    expect(s.width).toBe(824);
    expect(s.height).toBe(1831);
  });

  it("caps DPR at the render resolution cap", () => {
    const s = computeBackingSize(540, 1200, 4, 3);
    expect(s.width).toBe(1620);
  });

  it("never drops below half the logical size", () => {
    expect(computeBackingSize(54, 120, 1).width).toBe(270);
  });
});

describe("snapQuadLikePhaser3 backing scale", () => {
  it("snaps to whole game pixels at scale 1", () => {
    const q = [10.4, 5.6, 20.4, 5.6, 20.4, 15.6, 10.4, 15.6];
    snapQuadLikePhaser3(q, 1);
    expect(q[0]).toBeCloseTo(10);
    expect(q[1]).toBeCloseTo(6);
    expect(q[2]).toBeCloseTo(20);
  });

  it("snaps to whole backing pixels at a fractional scale", () => {
    const scale = 2.625;
    const q = [10.4, 5.6, 20.4, 5.6, 20.4, 15.6, 10.4, 15.6];
    snapQuadLikePhaser3(q, scale);
    const px = (q[0] ?? 0) * scale;
    expect(Math.abs(px - Math.round(px))).toBeLessThan(1e-6);
    // Quad size is preserved.
    expect((q[2] ?? 0) - (q[0] ?? 0)).toBeCloseTo(10);
  });
});

/** Minimal stand-in for Phaser 4's DrawingContext (only what the patch touches). */
class FakeDrawingContext {
  width = 0;
  height = 0;
  state = { scissor: { box: [0, 0, 0, 0] }, viewport: [0, 0, 0, 0] };
  constructor(readonly useCanvas: boolean) {}
  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.state.scissor.box = [0, 0, width, height];
    this.state.viewport = [0, 0, width, height];
  }
  setScissorBox(x: number, y: number, width: number, height: number): void {
    this.state.scissor.box = [x, this.height - y - height, width, height];
  }
}

function fakeGame(opts: {
  css: { width: number; height: number };
  withBase?: boolean;
}) {
  const store: Record<string, unknown> = {};
  const text = {
    type: "Text",
    style: { resolution: 1 },
    setResolution: vi.fn(function (
      this: { style: { resolution: number } },
      r: number,
    ) {
      this.style.resolution = r;
    }),
  };
  const nested = { ...text, style: { resolution: 1 }, setResolution: vi.fn() };
  const container = { type: "Container", list: [nested] };
  const base = new FakeDrawingContext(true);
  base.resize(540, 1200);
  let texturesReady: (() => void) | null = null;
  const updateScale = vi.fn();
  const game = {
    canvas: {
      style: { imageRendering: "pixelated" },
      width: 540,
      height: 1200,
      getBoundingClientRect: () => opts.css,
    },
    renderer: {
      gl: { drawingBufferHeight: 0 },
      drawingBufferHeight: 0,
      baseDrawingContext: opts.withBase === false ? null : base,
    },
    scale: { displaySize: opts.css, updateScale },
    registry: {
      get: (k: string) => store[k],
      set: (k: string, v: unknown) => {
        store[k] = v;
      },
    },
    scene: {
      scenes: [{ sys: { displayList: { list: [text, container] } } }],
    },
    textures: {
      once: (_e: string, fn: () => void) => {
        texturesReady = fn;
      },
    },
  };
  return {
    game,
    base,
    text,
    nested,
    store,
    updateScale,
    fireTexturesReady: () => texturesReady?.(),
  };
}

describe("installHiDpiCanvas", () => {
  let listeners: Array<() => void> = [];
  beforeEach(() => {
    listeners = [];
    vi.stubGlobal("window", {
      devicePixelRatio: 2,
      matchMedia: () => ({
        addEventListener: (_e: string, fn: () => void) => listeners.push(fn),
        removeEventListener: vi.fn(),
      }),
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sizes the backing store and scales viewport + scissor, keeping logical size", () => {
    const g = fakeGame({ css: { width: 540, height: 1200 } });
    const dispose = installHiDpiCanvas(g.game as never);
    expect(g.game.canvas.width).toBe(1080);
    expect(g.game.canvas.height).toBe(2400);
    expect(g.game.canvas.style.imageRendering).toBe("auto");
    expect(g.base.width).toBe(540);
    expect(g.base.state.viewport).toEqual([0, 0, 1080, 2400]);
    g.base.setScissorBox(10, 20, 100, 50);
    expect(g.base.state.scissor.box).toEqual([20, 2260, 200, 100]);
    expect(g.store.renderResolution).toBe(2);
    expect(g.text.setResolution).toHaveBeenCalledWith(2);
    expect(g.nested.setResolution).toHaveBeenCalledWith(2);
    dispose();
  });

  it("leaves framebuffer contexts in logical pixels", () => {
    const g = fakeGame({ css: { width: 540, height: 1200 } });
    installHiDpiCanvas(g.game as never);
    const fb = new FakeDrawingContext(false);
    fb.resize(300, 200);
    fb.setScissorBox(0, 0, 300, 200);
    expect(fb.state.viewport).toEqual([0, 0, 300, 200]);
    expect(fb.state.scissor.box).toEqual([0, 0, 300, 200]);
  });

  it("re-sizes after the scale manager updates and on DPR change", () => {
    const g = fakeGame({ css: { width: 540, height: 1200 } });
    installHiDpiCanvas(g.game as never);
    const css = g.game.canvas.getBoundingClientRect();
    css.width = 270;
    css.height = 600;
    g.game.scale.updateScale();
    expect(g.updateScale).toHaveBeenCalled();
    expect(g.game.canvas.width).toBe(540);
    (window as { devicePixelRatio: number }).devicePixelRatio = 3;
    for (const fn of [...listeners]) fn();
    expect(g.game.canvas.width).toBe(810);
  });

  it("waits for the renderer's drawing context", () => {
    const g = fakeGame({ css: { width: 540, height: 1200 }, withBase: false });
    installHiDpiCanvas(g.game as never);
    expect(g.game.canvas.width).toBe(540);
    g.game.renderer.baseDrawingContext = g.base;
    g.fireTexturesReady();
    expect(g.game.canvas.width).toBe(1080);
  });

  it("is a no-op without WebGL", () => {
    const g = fakeGame({ css: { width: 540, height: 1200 } });
    (g.game.renderer as { gl: unknown }).gl = undefined;
    installHiDpiCanvas(g.game as never)();
    expect(g.game.canvas.width).toBe(540);
  });
});

describe("textResolutionForBackingScale", () => {
  it("rounds to 3 decimals", () => {
    expect(textResolutionForBackingScale(1418 / 540)).toBe(2.626);
  });
});
