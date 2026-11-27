import { describe, expect, it } from "vitest";
import type { DataStore } from "../../core/data/DataStore";
import { DEFENSE_RUN_MODE_KEY } from "../../core/defenseRunMode";
import { createNewSave } from "../../core/save/GameState";
import {
  ensureDefenseSaveSpellBar,
  resolveDefenseRunSetup,
} from "./DefenseRunSetup";
import { fakeScene } from "../../test/fakeScene";

const store = {
  getWaveForNight: (night: number) =>
    night === 2
      ? { rewardGold: 32, groups: [] }
      : { rewardGold: 10, groups: [] },
} as unknown as DataStore;

describe("resolveDefenseRunSetup", () => {
  it("resolves endless mode with zero reward", () => {
    const { registry } = fakeScene();
    registry.set(DEFENSE_RUN_MODE_KEY, {
      kind: "endless",
      selections: [{ enemyId: "grunt", concurrentCap: 2 }],
      infiniteHp: true,
    });
    const setup = resolveDefenseRunSetup(
      registry as import("phaser").Data.DataManager,
      store,
      3,
    );
    expect(setup.endless).toBe(true);
    expect(setup.wavePlanner).toBe(false);
    expect(setup.rewardGold).toBe(0);
    expect(setup.endlessInfiniteHp).toBe(true);
    expect(setup.wave).toBeUndefined();
  });

  it("resolves wave planner custom groups", () => {
    const { registry } = fakeScene();
    registry.set(DEFENSE_RUN_MODE_KEY, {
      kind: "wavePlanner",
      groups: [{ atMs: 0, enemyId: "grunt", count: 1, intervalMs: 100 }],
    });
    const setup = resolveDefenseRunSetup(
      registry as import("phaser").Data.DataManager,
      store,
      1,
    );
    expect(setup.wavePlanner).toBe(true);
    expect(setup.wave?.groups).toHaveLength(1);
    expect(setup.rewardGold).toBe(0);
  });

  it("loads campaign wave and reward gold by night", () => {
    const registry = fakeScene().registry;
    const setup = resolveDefenseRunSetup(
      registry as import("phaser").Data.DataManager,
      store,
      2,
    );
    expect(setup.endless).toBe(false);
    expect(setup.rewardGold).toBe(32);
    expect(setup.wave?.rewardGold).toBe(32);
  });
});

describe("ensureDefenseSaveSpellBar", () => {
  it("fills default spell bar when slots are missing", () => {
    const save = createNewSave();
    save.spellBar = { slots: [], autoCastSpellIds: [] };
    ensureDefenseSaveSpellBar(save);
    expect(save.spellBar.slots.filter(Boolean).length).toBe(8);
  });
});
