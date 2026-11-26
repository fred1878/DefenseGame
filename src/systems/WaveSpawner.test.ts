import { describe, expect, it, vi } from "vitest";
import type { DataStore, EnemyDef, WaveDef } from "../core/DataStore";
import { asScene, fakeScene } from "../test/fakeScene";
import {
  ELITE_HP_MUL,
  groupHpMul,
  scaledEnemyDef,
  scheduleWave,
} from "./WaveSpawner";

const grunt: EnemyDef = {
  hp: 10,
  speedWu: 40,
  damage: 3,
  behavior: "melee",
  textureKey: "enemy_grunt",
  displayName: "Grunt",
} as EnemyDef;

function store(enemies: Record<string, EnemyDef>): DataStore {
  return { enemies } as DataStore;
}

describe("scheduleWave", () => {
  it("marks the spawn plan complete immediately when no groups resolve", () => {
    const scene = fakeScene();
    const markSpawnPlanComplete = vi.fn();
    const wave: WaveDef = {
      groups: [{ enemyId: "missing", count: 3, atMs: 0, intervalMs: 100 }],
    } as WaveDef;
    scheduleWave(
      asScene(scene),
      store({}),
      wave,
      { spawnEnemy: vi.fn(), markSpawnPlanComplete },
      true,
    );
    expect(scene.delayed).toHaveLength(0);
    expect(markSpawnPlanComplete).toHaveBeenCalledOnce();
  });

  it("schedules each enemy and a completion callback after the last spawn", () => {
    const scene = fakeScene();
    const spawnEnemy = vi.fn();
    const markSpawnPlanComplete = vi.fn();
    const wave: WaveDef = {
      groups: [
        { enemyId: "grunt", count: 2, atMs: 100, intervalMs: 50 },
        { enemyId: "missing", count: 9, atMs: 0, intervalMs: 10 },
      ],
    } as WaveDef;
    scheduleWave(
      asScene(scene),
      store({ grunt }),
      wave,
      { spawnEnemy, markSpawnPlanComplete },
      true,
    );
    // two spawns at 100 and 150, plus completion at maxAt + 50 = 200
    expect(scene.delayed.map((d) => d.delay)).toEqual([100, 150, 200]);
    expect(markSpawnPlanComplete).not.toHaveBeenCalled();
    scene.delayed[0]!.fn();
    scene.delayed[1]!.fn();
    expect(spawnEnemy).toHaveBeenCalledTimes(2);
    expect(spawnEnemy.mock.calls[0]![2]).toBe(grunt);
    expect(spawnEnemy.mock.calls[0]![3]).toBe("grunt");
    // e2e spawn is on the south edge, x = 0
    expect(spawnEnemy.mock.calls[0]![0]).toBe(0);
    scene.delayed[2]!.fn();
    expect(markSpawnPlanComplete).toHaveBeenCalledOnce();
  });

  it("uses jittered spawn points outside e2e mode", () => {
    const scene = fakeScene();
    const spawnEnemy = vi.fn();
    const wave: WaveDef = {
      groups: [{ enemyId: "grunt", count: 1, atMs: 0, intervalMs: 0 }],
    } as WaveDef;
    scheduleWave(
      asScene(scene),
      store({ grunt }),
      wave,
      { spawnEnemy, markSpawnPlanComplete: vi.fn() },
      false,
    );
    scene.delayed[0]!.fn();
    const [x, y] = spawnEnemy.mock.calls[0]!;
    expect(typeof x).toBe("number");
    expect(typeof y).toBe("number");
  });

  it("spawns hpMul groups with scaled HP, Elite-labelled at 2× and up", () => {
    const scene = fakeScene();
    const spawnEnemy = vi.fn();
    const wave: WaveDef = {
      groups: [
        { enemyId: "grunt", count: 1, atMs: 0, intervalMs: 0, hpMul: 1.25 },
        { enemyId: "grunt", count: 1, atMs: 10, intervalMs: 0, hpMul: 2.5 },
      ],
    } as WaveDef;
    scheduleWave(
      asScene(scene),
      store({ grunt }),
      wave,
      { spawnEnemy, markSpawnPlanComplete: vi.fn() },
      true,
    );
    scene.delayed[0]!.fn();
    scene.delayed[1]!.fn();
    expect(spawnEnemy.mock.calls[0]![2]).toMatchObject({
      hp: 13,
      displayName: "Grunt",
    });
    expect(spawnEnemy.mock.calls[1]![2]).toMatchObject({
      hp: 25,
      displayName: "Elite Grunt",
    });
  });
});

describe("wave hpMul helpers", () => {
  const g = (hpMul?: number) => ({
    enemyId: "grunt",
    count: 1,
    atMs: 0,
    intervalMs: 0,
    ...(hpMul === undefined ? {} : { hpMul }),
  });

  it("treats missing or invalid multipliers as 1", () => {
    expect(groupHpMul(g())).toBe(1);
    expect(groupHpMul(g(0))).toBe(1);
    expect(groupHpMul(g(-2))).toBe(1);
    expect(groupHpMul(g(Number.NaN))).toBe(1);
    expect(groupHpMul(g(1.5))).toBe(1.5);
  });

  it("returns the same def at 1× and never drops below 1 HP", () => {
    expect(scaledEnemyDef(grunt, 1)).toBe(grunt);
    expect(scaledEnemyDef(grunt, 0.01).hp).toBe(1);
    expect(scaledEnemyDef(grunt, ELITE_HP_MUL).displayName).toBe("Elite Grunt");
    expect(grunt.hp).toBe(10);
  });
});
