import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import Phaser from "phaser";
import { DEFENSE_RUN_MODE_KEY } from "../../core/defenseRunMode";
import { transitionDefenseToTown } from "./DefenseNightEnd";

function mockScene() {
  const delayedCalls: Array<() => void> = [];
  const scheduled: Array<{ delay: number; cb: () => void }> = [];
  const stop = vi.fn();
  const start = vi.fn();
  const get = vi.fn(() => null);
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
    scene: { get, isActive: () => true, start, stop, key: "Defense" },
    sys: { isActive: () => true },
    time: {
      delayedCall: (delay: number, cb: () => void) => {
        scheduled.push({ delay, cb });
        delayedCalls.push(cb);
      },
    },
  } as unknown as Phaser.Scene;

  return { scene, start, stop, scheduled, delayedCalls, registry };
}

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
});