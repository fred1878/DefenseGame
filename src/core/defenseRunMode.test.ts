import { describe, expect, it } from "vitest";
import {
  readDefenseRunMode,
  resolveEndlessRunSelections,
  setEndlessDefenseRun,
  DEFENSE_RUN_MODE_KEY,
} from "./defenseRunMode";

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
  it("fills caps from resolver when zero", () => {
    expect(
      resolveEndlessRunSelections(
        [
          { enemyId: "grunt", concurrentCap: 7 },
          { enemyId: "x", concurrentCap: 0 },
        ],
        (id) => (id === "x" ? 5 : 10),
      ),
    ).toEqual([
      { enemyId: "grunt", concurrentCap: 7 },
      { enemyId: "x", concurrentCap: 5 },
    ]);
  });
});

describe("setEndlessDefenseRun", () => {
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