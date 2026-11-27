import { describe, expect, it } from "vitest";
import {
  countLivingWithDefId,
  endlessSpawnDeficit,
  planEndlessSpawns,
} from "./endlessSpawnScheduler";
import {
  clampEndlessConcurrent,
  ENDLESS_CONCURRENT_MAX,
  ENDLESS_CONCURRENT_MIN,
} from "../core/endlessLimits";

describe("clampEndlessConcurrent", () => {
  it("clamps to 1–99", () => {
    expect(clampEndlessConcurrent(0)).toBe(ENDLESS_CONCURRENT_MIN);
    expect(clampEndlessConcurrent(1)).toBe(ENDLESS_CONCURRENT_MIN);
    expect(clampEndlessConcurrent(99)).toBe(ENDLESS_CONCURRENT_MAX);
    expect(clampEndlessConcurrent(120)).toBe(ENDLESS_CONCURRENT_MAX);
    expect(clampEndlessConcurrent(7.4)).toBe(7);
  });
});

describe("endlessSpawnDeficit", () => {
  it("returns zero when at or above cap", () => {
    expect(endlessSpawnDeficit(10, 10)).toBe(0);
    expect(endlessSpawnDeficit(11, 10)).toBe(0);
  });

  it("returns missing headcount", () => {
    expect(endlessSpawnDeficit(7, 10)).toBe(3);
    expect(endlessSpawnDeficit(0, 3)).toBe(3);
  });
});

describe("countLivingWithDefId", () => {
  it("counts only matching living def ids", () => {
    const entries = [
      { defId: "grunt", damageable: { alive: true } },
      { defId: "grunt", damageable: { alive: true } },
      { defId: "grunt", damageable: { alive: false } },
      { defId: "javelineer", damageable: { alive: true } },
    ];
    expect(countLivingWithDefId(entries, "grunt")).toBe(2);
    expect(countLivingWithDefId(entries, "javelineer")).toBe(1);
  });
});

describe("planEndlessSpawns", () => {
  it("plans per-type deficits independently", () => {
    const plan = planEndlessSpawns(
      [
        { enemyId: "grunt", concurrentCap: 10 },
        { enemyId: "javelineer", concurrentCap: 3 },
      ],
      { grunt: 8, javelineer: 3 },
    );
    expect(plan).toEqual([
      { enemyId: "grunt", spawnCount: 2 },
      { enemyId: "javelineer", spawnCount: 0 },
    ]);
  });

  it("treats non-finite caps as the minimum and missing counts as zero", () => {
    expect(clampEndlessConcurrent(Number.NaN)).toBe(ENDLESS_CONCURRENT_MIN);
    expect(clampEndlessConcurrent(Number.POSITIVE_INFINITY)).toBe(
      ENDLESS_CONCURRENT_MIN,
    );
    const fromMap = planEndlessSpawns(
      [{ enemyId: "grunt", concurrentCap: 5 }],
      new Map(),
    );
    expect(fromMap).toEqual([{ enemyId: "grunt", spawnCount: 5 }]);
    const fromRecord = planEndlessSpawns(
      [{ enemyId: "grunt", concurrentCap: 4 }],
      {},
    );
    expect(fromRecord).toEqual([{ enemyId: "grunt", spawnCount: 4 }]);
  });
});
