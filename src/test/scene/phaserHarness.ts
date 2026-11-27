import Phaser from "phaser";
import { GAME } from "../../config";

/** Fixed frame length: every test sees the same simulated clock. */
export const FRAME_MS = 1000 / 60;

export interface HeadlessGame {
  game: Phaser.Game;
  /** Simulated ms since the manual clock started. */
  readonly now: number;
  /** Advance `frames` fixed-length frames synchronously. */
  step(frames?: number, deltaMs?: number): void;
  /**
   * Step frames until `pred()` is true. Yields to the event loop between
   * frames so real I/O (HTTP loader, image decode) can complete; simulated
   * time still advances exactly FRAME_MS per frame.
   */
  /**
   * Step (yielding to the event loop each frame) until `pred` holds. Bounded
   * by `maxFrames` (default 600), or by wall-clock `timeoutMs` when given.
   */
  stepUntil(
    pred: () => boolean,
    opts?: { maxFrames?: number; timeoutMs?: number },
  ): Promise<void>;
  /**
   * Real DOM mouse tap at game coordinates: mousedown on the canvas, one
   * frame, mouseup, one frame. Goes through Phaser's InputManager and hit
   * testing exactly like a browser click (needs a CANVAS game).
   */
  tap(x: number, y: number): void;
  /**
   * Press at `path[0]`, hold `holdFrames` frames, move through the rest (one
   * frame each) and release at the last point: drags and long presses.
   */
  drag(
    path: ReadonlyArray<{ x: number; y: number }>,
    opts?: { holdFrames?: number; beforeRelease?: () => void },
  ): void;
  /**
   * Run one frame and return the canvas as PNG bytes.
   */
  renderPng(): Buffer;
  destroy(): void;
}

/**
 * Boots a real Phaser.Game (vendored build) with the HEADLESS renderer, then
 * stops its rAF loop so the test owns the clock via `headlessStep`.
 */
export async function bootHeadlessGame(
  config: Partial<Phaser.Types.Core.GameConfig> = {},
): Promise<HeadlessGame> {
  const parent = document.createElement("div");
  parent.id = "game";
  document.body.appendChild(parent);
  const type = config.type ?? Phaser.CANVAS;
  const game = new Phaser.Game({
    // CANVAS (rendered by @napi-rs/canvas through jsdom) gives a real canvas
    // for input + pixels; pass `type: Phaser.HEADLESS` to skip rendering.
    type,
    // Phaser's feature sniff looks for window.CanvasRenderingContext2D, which
    // jsdom doesn't expose; handing it a canvas skips the sniff.
    ...(type === Phaser.HEADLESS
      ? {}
      : { canvas: document.createElement("canvas") }),
    parent,
    width: GAME.width,
    height: GAME.height,
    banner: false,
    autoFocus: false,
    audio: { noAudio: true },
    // jsdom has no URL.createObjectURL; let <img src> fetch over HTTP instead.
    loader: { imageLoadType: "HTMLImageElement" },
    physics: { default: "arcade", arcade: { gravity: { x: 0, y: 0 } } },
    input: { activePointers: 2 },
    ...config,
  });
  await new Promise<void>((resolve) =>
    game.events.once(Phaser.Core.Events.READY, () => resolve()),
  );
  // READY fires just before loop.start(); take the clock away from rAF.
  game.loop.stop();
  if (game.canvas) {
    // jsdom has no layout: report the canvas at 1:1 so pointer maths works.
    game.canvas.getBoundingClientRect = () =>
      DOMRect.fromRect({ x: 0, y: 0, width: GAME.width, height: GAME.height });
    game.scale.refresh();
  }

  /** Dispatch a DOM mouse event on the canvas at game coordinates. */
  const mouse = (type: string, x: number, y: number): void => {
    const canvas = game.canvas;
    if (!canvas) throw new Error("pointer input needs a CANVAS game");
    const ev = new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      button: 0,
      clientX: x,
      clientY: y,
    });
    // jsdom leaves pageX/Y at 0; Phaser reads them.
    Object.defineProperties(ev, { pageX: { value: x }, pageY: { value: y } });
    canvas.dispatchEvent(ev);
  };

  let now = 0;
  // Update-only frames (drawing every frame would ~3x test time), but run
  // each camera's preRender like the renderer would: follow / scroll / matrix
  // are applied there, and screen<->world maths depends on them.
  const tick = (t: number, d: number): void => {
    game.headlessStep(t, d);
    for (const scene of game.scene.getScenes(true)) {
      for (const cam of scene.cameras.cameras) cam.preRender();
    }
  };
  const step = (frames = 1, deltaMs = FRAME_MS): void => {
    for (let i = 0; i < frames; i++) {
      now += deltaMs;
      tick(now, deltaMs);
    }
  };
  return {
    game,
    get now() {
      return now;
    },
    step,
    async stepUntil(pred, { maxFrames = 600, timeoutMs } = {}) {
      if (timeoutMs !== undefined) {
        // Wall-clock bound for waits on real I/O (HTTP, image decode) that
        // can be slow on a loaded machine; ~1 frame per 4 ms of real time.
        const deadline = performance.now() + timeoutMs;
        while (performance.now() < deadline) {
          if (pred()) return;
          step();
          await new Promise((r) => setTimeout(r, 4));
        }
      } else {
        for (let i = 0; i < maxFrames; i++) {
          if (pred()) return;
          step();
          await new Promise((r) => setTimeout(r, 0));
        }
      }
      if (!pred()) {
        throw new Error(
          timeoutMs !== undefined
            ? `stepUntil: condition not met after ${timeoutMs} ms`
            : `stepUntil: condition not met after ${maxFrames} frames`,
        );
      }
    },
    tap(x, y) {
      mouse("mousemove", x, y);
      step();
      mouse("mousedown", x, y);
      step();
      mouse("mouseup", x, y);
      step();
    },
    drag(path, { holdFrames = 1, beforeRelease } = {}) {
      const [first, ...rest] = path;
      if (!first) return;
      mouse("mousemove", first.x, first.y);
      step();
      mouse("mousedown", first.x, first.y);
      step(holdFrames);
      let last = first;
      for (const p of rest) {
        mouse("mousemove", p.x, p.y);
        step();
        last = p;
      }
      beforeRelease?.();
      mouse("mouseup", last.x, last.y);
      step();
    },
    renderPng() {
      const canvas = game.canvas;
      if (!canvas) throw new Error("renderPng() needs a CANVAS game");
      now += FRAME_MS;
      game.step(now, FRAME_MS);
      const url = canvas.toDataURL("image/png");
      return Buffer.from(url.slice(url.indexOf(",") + 1), "base64");
    },
    destroy() {
      game.destroy(true, false);
      // Let Phaser's pending destroy run on one more step.
      game.headlessStep(now + FRAME_MS, FRAME_MS);
      parent.remove();
    },
  };
}
