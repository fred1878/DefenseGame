import { describe, expect, it, vi } from "vitest";
import * as WaveSpawner from "../../systems/WaveSpawner";
import { asScene, fakeScene } from "../../test/fakeScene";
import { scheduleDefenseWave } from "./DefenseWaveSpawner";

describe("scheduleDefenseWave", () => {
  it("delegates to scheduleWave", () => {
    const spy = vi
      .spyOn(WaveSpawner, "scheduleWave")
      .mockImplementation(() => {});
    const scene = fakeScene();
    const store = {} as never;
    const wave = { rewardGold: 1, groups: [] };
    const callbacks = {
      spawnEnemy: vi.fn(),
      markSpawnPlanComplete: vi.fn(),
    };
    scheduleDefenseWave(asScene(scene), store, wave, callbacks, false);
    expect(spy).toHaveBeenCalledWith(scene, store, wave, callbacks, false);
    spy.mockRestore();
  });
});
