import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import Phaser from "phaser";
import { DEFENSE_RUN_MODE_KEY } from "../../core/defenseRunMode";
import {
  scheduleAfterPointerHandler,
  transitionDefenseToTown,
} from "./DefenseNightEnd";

function mockScene(opts: { defenseActive?: boolean; defensePaused?: boolean } = {}) {
  const defenseActive = opts.defenseActive ?? true;
  const defensePaused = opts.defensePaused ?? false;
  const delayedCalls: Array<() => void> = [];
  const scheduled: Array<{ delay: number; cb: () => void }> = [];
  const postStepHandlers: Array<() => void> = [];
  const stop = vi.fn();
  const start = vi.fn();
  const get = vi.fn((key: string) =>
    key === "DebugMenu"
      ? { scene: { isActive: () => false } }
      : null,
  );
  const registry = {
    data: new Map<string, unknown>(),
    remove(key: string) {
      this.data.delete(key);
    },
    get(key: string) {
      return this.data.get(key);
    },
    set(key: string, value: unknown) {
      this.data.set(key, value);
    },
  };
  registry.set(DEFENSE_RUN_MODE_KEY, { kind: "night" });

  const scene = {
    registry,
    scene: {
      get,
      isActive: (key?: string) => (key === "Defense" ? defenseActive : defenseActive),
      isPaused: (key: string) => (key === "Defense" ? defensePaused : false),
      start,
      stop,
      key: "Defense",
    },
    sys: {
      isActive: () => defenseActive && !defensePaused,
      game: {
        events: {
          once: (_event: string, cb: () => void) => {
            postStepHandlers.push(cb);
          },
        },
      },
    },
    time: {
      delayedCall: (delay: number, cb: () => void) => {
        scheduled.push({ delay, cb });
        delayedCalls.push(cb);
      },
    },
  } as unknown as Phaser.Scene;

  return { scene, start, stop, scheduled, delayedCalls, postStepHandlers, registry };
}

describe("scheduleAfterPointerHandler", () => {
  it("uses delayedCall when the scene timer is active", () => {
    const { scene, scheduled, postStepHandlers } = mockScene();
    const fn = vi.fn();
    scheduleAfterPointerHandler(scene, fn);
    expect(scheduled).toHaveLength(1);
    expect(postStepHandlers).toHaveLength(0);
    scheduled[0]!.cb();
    expect(fn).toHaveBeenCalled();
  });

  it("uses POST_STEP when the host scene is paused", () => {
    const { scene, scheduled, postStepHandlers } = mockScene({
      defenseActive: false,
      defensePaused: true,
    });
    const fn = vi.fn();
    scheduleAfterPointerHandler(scene, fn);
    expect(scheduled).toHaveLength(0);
    expect(postStepHandlers).toHaveLength(1);
    postStepHandlers[0]!();
    expect(fn).toHaveBeenCalled();
  });
});

describe("transitionDefenseToTown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("clears defense run mode and defers Town start", () => {
    const { scene, start, scheduled, delayedCalls, registry } = mockScene();
    transitionDefenseToTown(scene);
    expect(registry.get(DEFENSE_RUN_MODE_KEY)).toBeUndefined();
    expect(start).not.toHaveBeenCalled();
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0]!.delay).toBe(0);
    delayedCalls[0]!();
    expect(start).toHaveBeenCalledWith("Town");
  });

  it("starts Town from a paused Defense host via POST_STEP", () => {
    const { scene, start, scheduled, postStepHandlers, registry } = mockScene({
      defenseActive: false,
      defensePaused: true,
    });
    transitionDefenseToTown(scene);
    expect(registry.get(DEFENSE_RUN_MODE_KEY)).toBeUndefined();
    expect(start).not.toHaveBeenCalled();
    expect(scheduled).toHaveLength(0);
    expect(postStepHandlers).toHaveLength(1);
    postStepHandlers[0]!();
    expect(start).toHaveBeenCalledWith("Town");
  });
});