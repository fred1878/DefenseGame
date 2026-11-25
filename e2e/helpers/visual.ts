import type { Page } from "@playwright/test";

/**
 * Deterministic visual-check setup (see e2e/visual-screens.spec.ts).
 *
 * - `Math.random` is replaced with a fixed-seed PRNG before any game code runs,
 *   so spawn jitter / FX randomness is the same on every run.
 * - `requestAnimationFrame` is wrapped so a test can freeze Phaser's game loop
 *   (`freezeGameLoop`) once the scene has settled. The WebGL canvas keeps its
 *   last frame (`preserveDrawingBuffer` is on in e2e builds), so screenshots are
 *   stable even with looping tweens / sprite animations.
 *
 * Call before `gotoE2E` (both use `addInitScript`, which only affects the next navigation).
 */
export async function installVisualDeterminism(
  page: Page,
  seed = 0x5eed1234,
): Promise<void> {
  await page.addInitScript((initialSeed: number) => {
    let state = initialSeed >>> 0;
    // mulberry32
    Math.random = () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    const w = window as unknown as {
      __visualFrozen?: boolean;
      __visualHeld?: FrameRequestCallback[];
      __visualFrames?: number;
    };
    w.__visualFrozen = false;
    w.__visualHeld = [];
    w.__visualFrames = 0;
    const nativeRaf = window.requestAnimationFrame.bind(window);
    // Independent frame counter: keeps ticking while the game loop is frozen.
    const tick = () => {
      w.__visualFrames = (w.__visualFrames ?? 0) + 1;
      nativeRaf(tick);
    };
    nativeRaf(tick);
    window.requestAnimationFrame = (cb: FrameRequestCallback): number =>
      nativeRaf((t) => {
        if (w.__visualFrozen) {
          w.__visualHeld?.push(cb);
          return;
        }
        cb(t);
      });
  }, seed);
}

/** Let `frames` more animation frames render (game loop running). */
export async function waitFrames(page: Page, frames: number): Promise<void> {
  const start = await page.evaluate(
    () =>
      (window as unknown as { __visualFrames?: number }).__visualFrames ?? 0,
  );
  await page.waitForFunction(
    (target) =>
      ((window as unknown as { __visualFrames?: number }).__visualFrames ??
        0) >= target,
    start + frames,
    { timeout: 30_000, polling: 50 },
  );
}

/** Stop Phaser's loop after the current frame; the canvas keeps the last rendered frame. */
export async function freezeGameLoop(page: Page): Promise<void> {
  await waitFrames(page, 2);
  await page.evaluate(() => {
    (window as unknown as { __visualFrozen?: boolean }).__visualFrozen = true;
  });
  // One more browser frame so any in-flight Phaser step finishes and is held.
  await waitFrames(page, 2);
}
