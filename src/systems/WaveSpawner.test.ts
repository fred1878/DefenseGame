import { describe, expect, it, vi } from "vitest";
import type { DataStore, EnemyDef, WaveDef } from "../core/data/DataStore";
import { asScene, fakeScene } from "../test/fakeScene";
import {
  eliteHpMul,
  groupDamageMul,
  groupHpMul,
  scaledEnemyDef,
  scheduleWave,
} from "./WaveSpawner";

const grunt: EnemyDef = {
  hp: 10,
  speedWu: 40,
  damage: 3,
  behavior: "meleeChaser",
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
        { enemyId: "grunt", count: 1, atMs: 20, intervalMs: 0, damageMul: 2 },
      ],
    } as unknown as WaveDef;
    scheduleWave(
      asScene(scene),
      store({ grunt }),
      wave,
      { spawnEnemy, markSpawnPlanComplete: vi.fn() },
      true,
    );
    scene.delayed[0]!.fn();
    scene.delayed[1]!.fn();
    scene.delayed[2]!.fn();
    expect(spawnEnemy.mock.calls[0]![2]).toMatchObject({
      hp: 13,
      displayName: "Grunt",
      damage: 3,
    });
    expect(spawnEnemy.mock.calls[2]![2]).toMatchObject({ hp: 10, damage: 6 });
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
    expect(groupDamageMul(g())).toBe(1);
    expect(groupDamageMul({ ...g(), damageMul: 0 })).toBe(1);
    expect(groupDamageMul({ ...g(), damageMul: 1.4 })).toBe(1.4);
  });

  it("scales damage and nested combat damage keys, not other numbers", () => {
    const brute = {
      ...grunt,
      combat: {
        melee: { damage: 4, cooldownMs: 900 },
        wall: { wallDamage: 10, playerDamageScale: 0.5 },
        attacks: [{ damage: 1 }, "x"],
        tag: null,
      },
    } as unknown as EnemyDef;
    const s = scaledEnemyDef(brute, 1, 1.5);
    expect(s).toMatchObject({ hp: 10, damage: 5, displayName: "Grunt" });
    expect(s.combat).toEqual({
      melee: { damage: 6, cooldownMs: 900 },
      wall: { wallDamage: 15, playerDamageScale: 0.5 },
      attacks: [{ damage: 2 }, "x"],
      tag: null,
    });
    expect(scaledEnemyDef(brute, 1, 0.01).damage).toBe(1);
    expect(brute.damage).toBe(3);
  });

  it("returns the same def at 1× and never drops below 1 HP", () => {
    expect(scaledEnemyDef(grunt, 1)).toBe(grunt);
    expect(scaledEnemyDef(grunt, 0.01).hp).toBe(1);
    expect(scaledEnemyDef(grunt, eliteHpMul()).displayName).toBe("Elite Grunt");
    expect(grunt.hp).toBe(10);
  });
});
