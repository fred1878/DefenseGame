import { describe, expect, it } from "vitest";
import {
  readDefenseRunMode,
  resolveEndlessRunSelections,
  resolveWavePlannerGroups,
  setEndlessDefenseRun,
  setNightDefenseRun,
  setWavePlannerDefenseRun,
  DEFENSE_RUN_MODE_KEY,
} from "./defenseRunMode";
import {
  WAVE_PLANNER_DEFAULT_AT_MS,
  WAVE_PLANNER_DEFAULT_INTERVAL_MS,
} from "./wavePlannerTiming";

describe("readDefenseRunMode", () => {
  it("reads multi-select endless payload", () => {
    const registry = {
      get: (key: string) =>
        key === DEFENSE_RUN_MODE_KEY
          ? {
              kind: "endless",
              selections: [
                { enemyId: "grunt", concurrentCap: 10 },
                { enemyId: "javelineer", concurrentCap: 4 },
              ],
            }
          : undefined,
    } as Phaser.Data.DataManager;

    expect(readDefenseRunMode(registry)).toEqual({
      kind: "endless",
      selections: [
        { enemyId: "grunt", concurrentCap: 10 },
        { enemyId: "javelineer", concurrentCap: 4 },
      ],
    });
  });

  it("migrates legacy single enemyId payload", () => {
    const registry = {
      get: (key: string) =>
        key === DEFENSE_RUN_MODE_KEY
          ? { kind: "endless", enemyId: "grunt" }
          : undefined,
    } as Phaser.Data.DataManager;

    expect(readDefenseRunMode(registry)).toEqual({
      kind: "endless",
      selections: [{ enemyId: "grunt", concurrentCap: 0 }],
    });
  });
});

describe("resolveEndlessRunSelections", () => {
  it("clamps panel caps and does not invent defaults for zero", () => {
    expect(
      resolveEndlessRunSelections([
        { enemyId: "grunt", concurrentCap: 7 },
        { enemyId: "x", concurrentCap: 0 },
      ]),
    ).toEqual([
      { enemyId: "grunt", concurrentCap: 7 },
      { enemyId: "x", concurrentCap: 1 },
    ]);
  });
});

describe("wave planner run mode", () => {
  it("reads and clamps planner groups", () => {
    const registry = {
      get: (key: string) =>
        key === DEFENSE_RUN_MODE_KEY
          ? {
              kind: "wavePlanner",
              groups: [
                {
                  enemyId: "grunt",
                  count: 3,
                  atMs: 150,
                  intervalMs: 750,
                },
              ],
            }
          : undefined,
    } as Phaser.Data.DataManager;

    expect(readDefenseRunMode(registry)).toEqual({
      kind: "wavePlanner",
      groups: [
        {
          enemyId: "grunt",
          count: 3,
          atMs: 200,
          intervalMs: 800,
        },
      ],
    });
  });

  it("resolveWavePlannerGroups enforces 100ms steps", () => {
    expect(
      resolveWavePlannerGroups([
        {
          enemyId: "grunt",
          count: 0,
          atMs: 40,
          intervalMs: 860,
        },
      ]),
    ).toEqual([
      {
        enemyId: "grunt",
        count: 1,
        atMs: 0,
        intervalMs: 900,
      },
    ]);
  });

  it("persists planner payload", () => {
    const data: Record<string, unknown> = {};
    const registry = {
      set: (k: string, v: unknown) => {
        data[k] = v;
      },
      get: (k: string) => data[k],
    } as Phaser.Data.DataManager;

    setWavePlannerDefenseRun(registry, [
      {
        enemyId: "grunt",
        count: 5,
        atMs: 0,
        intervalMs: 800,
      },
    ]);

    expect(readDefenseRunMode(registry)).toEqual({
      kind: "wavePlanner",
      groups: [
        {
          enemyId: "grunt",
          count: 5,
          atMs: 0,
          intervalMs: 800,
        },
      ],
    });
  });
});

describe("setEndlessDefenseRun", () => {
  it("persists infiniteHp when enabled", () => {
    const data: Record<string, unknown> = {};
    const registry = {
      set: (k: string, v: unknown) => {
        data[k] = v;
      },
      get: (k: string) => data[k],
    } as Phaser.Data.DataManager;

    setEndlessDefenseRun(
      registry,
      [{ enemyId: "grunt", concurrentCap: 5 }],
      true,
    );

    expect(readDefenseRunMode(registry)).toEqual({
      kind: "endless",
      selections: [{ enemyId: "grunt", concurrentCap: 5 }],
      infiniteHp: true,
    });
  });

  it("writes selections array", () => {
    const data: Record<string, unknown> = {};
    const registry = {
      set: (k: string, v: unknown) => {
        data[k] = v;
      },
      get: (k: string) => data[k],
    } as Phaser.Data.DataManager;

    setEndlessDefenseRun(registry, [
      { enemyId: "grunt", concurrentCap: 9 },
      { enemyId: "bruiser", concurrentCap: 6 },
    ]);

    expect(readDefenseRunMode(registry)).toEqual({
      kind: "endless",
      selections: [
        { enemyId: "grunt", concurrentCap: 9 },
        { enemyId: "bruiser", concurrentCap: 6 },
      ],
    });
  });
});

describe("readDefenseRunMode leftover branches", () => {
  it("treats a missing or non-object payload as a night run", () => {
    const missing = {
      get: () => undefined,
    } as unknown as Phaser.Data.DataManager;
    expect(readDefenseRunMode(missing)).toEqual({ kind: "night" });
    const empty = {
      get: () => null,
    } as unknown as Phaser.Data.DataManager;
    expect(readDefenseRunMode(empty)).toEqual({ kind: "night" });
    const flag = {
      get: () => "endless",
    } as unknown as Phaser.Data.DataManager;
    expect(readDefenseRunMode(flag)).toEqual({ kind: "night" });
  });

  it("defaults planner times when atMs or intervalMs are missing", () => {
    const groups = resolveWavePlannerGroups([
      { enemyId: "grunt", count: 4 },
    ] as never);
    expect(groups[0]?.atMs).toBe(WAVE_PLANNER_DEFAULT_AT_MS);
    expect(groups[0]?.intervalMs).toBe(WAVE_PLANNER_DEFAULT_INTERVAL_MS);
  });

  it("ignores a legacy endless payload that has no enemyId", () => {
    const registry = {
      get: () => ({ kind: "endless" }),
    } as unknown as Phaser.Data.DataManager;
    expect(readDefenseRunMode(registry)).toEqual({ kind: "night" });
  });
});

describe("setNightDefenseRun", () => {
  it("writes a night run payload", () => {
    const data: Record<string, unknown> = {};
    const registry = {
      set: (k: string, v: unknown) => {
        data[k] = v;
      },
      get: (k: string) => data[k],
    } as Phaser.Data.DataManager;
    setNightDefenseRun(registry);
    expect(readDefenseRunMode(registry)).toEqual({ kind: "night" });
  });
});
