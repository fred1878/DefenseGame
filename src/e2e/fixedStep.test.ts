import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type FixedStepGame,
  fixedStepActive,
  seededRandom,
  startFixedStep,
  stepGame,
  stopFixedStep,
} from "./fixedStep";

function fakeGame(): FixedStepGame & { steps: [number, number][] } {
  const steps: [number, number][] = [];
  return {
    steps,
    loop: { sleep: vi.fn(), wake: vi.fn(), time: 1000, delta: 0, frame: 0 },
    headlessStep: (t: number, d: number) => {
      steps.push([t, d]);
    },
    step: (t: number) => {
      steps.push([t, -1]);
    },
  };
}

describe("fixedStep", () => {
  const native = Math.random;
  afterEach(() => {
    Math.random = native;
  });

  it("seeds a repeatable random sequence", () => {
    const a = seededRandom(7);
    const b = seededRandom(7);
    const xs = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(xs);
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(seededRandom(8)()).not.toBe(xs[0]);
  });

  it("steps the game by fixed deltas with a seeded Math.random", () => {
    const g = fakeGame();
    expect(stepGame(g, 3)).toBe(1000);
    expect(g.steps).toEqual([]);
    startFixedStep(g, 10, 42);
    expect(fixedStepActive()).toBe(true);
    expect(g.loop.sleep).toHaveBeenCalledOnce();
    const r1 = Math.random();
    expect(stepGame(g, 3)).toBe(1030);
    expect(g.steps).toEqual([
      [1010, 10],
      [1020, 10],
      [1030, 10],
    ]);
    expect(g.loop).toMatchObject({ time: 1030, delta: 10, frame: 3 });
    // Restarting reseeds and keeps going from the current game time.
    startFixedStep(g, 10, 42);
    expect(Math.random()).toBe(r1);
    stopFixedStep(g);
    expect(fixedStepActive()).toBe(false);
    expect(Math.random).toBe(native);
    expect(g.loop.wake).toHaveBeenCalledWith(true);
    stopFixedStep(g);
    expect(g.loop.wake).toHaveBeenCalledTimes(2);
  });

  it("renders every Nth frame when asked", () => {
    const g = fakeGame();
    startFixedStep(g, 10, 1, 2);
    stepGame(g, 4);
    expect(g.steps.map(([, d]) => d)).toEqual([10, -1, 10, -1]);
    stopFixedStep(g);
  });
});
