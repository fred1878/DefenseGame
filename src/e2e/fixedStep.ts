/**
 * E2E-only fixed-timestep driver for the real-fight harness: the browser's
 * animation-frame loop is put to sleep and the harness advances the game
 * itself, `stepMs` of game time per frame, as fast as the CPU allows. Game
 * time, spawns and physics then no longer depend on the machine's frame
 * rate, and Math.random is seeded so a replay can repeat a fight. Frames are
 * stepped headless (update only, no rendering) unless asked to render.
 */
export type FixedStepGame = {
  loop: {
    sleep(): void;
    wake(seamless?: boolean): void;
    time: number;
    delta: number;
    frame: number;
  };
  headlessStep(time: number, delta: number): void;
  /** Update and render one frame. */
  step(time: number, delta: number): void;
};

/** Small seeded PRNG (mulberry32), returns floats in [0, 1). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type State = {
  time: number;
  stepMs: number;
  renderEvery: number;
  frames: number;
  random: () => number;
};

let state: State | null = null;
let nativeRandom: (() => number) | null = null;

export function fixedStepActive(): boolean {
  return state !== null;
}

/**
 * Stop the animation-frame loop and seed Math.random. `renderEvery` > 0
 * also renders every that many frames (0: never render).
 */
export function startFixedStep(
  game: FixedStepGame,
  stepMs: number,
  seed: number,
  renderEvery = 0,
): void {
  if (state) stopFixedStep(game);
  game.loop.sleep();
  nativeRandom = Math.random;
  const random = seededRandom(seed);
  Math.random = random;
  state = { time: game.loop.time, stepMs, renderEvery, frames: 0, random };
}

/** Advance `frames` fixed steps; returns the game time reached. */
export function stepGame(game: FixedStepGame, frames: number): number {
  if (!state) return game.loop.time;
  for (let i = 0; i < frames; i++) {
    state.time += state.stepMs;
    game.loop.time = state.time;
    game.loop.delta = state.stepMs;
    game.loop.frame += 1;
    state.frames += 1;
    const render =
      state.renderEvery > 0 && state.frames % state.renderEvery === 0;
    if (render) game.step(state.time, state.stepMs);
    else game.headlessStep(state.time, state.stepMs);
  }
  return state.time;
}

/** Restore Math.random and the animation-frame loop. */
export function stopFixedStep(game: FixedStepGame): void {
  if (!state) return;
  if (nativeRandom) Math.random = nativeRandom;
  nativeRandom = null;
  state = null;
  game.loop.wake(true);
}
